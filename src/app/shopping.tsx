import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { formatNumber } from "@/utils/formatNumber";
import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { completeShopping, priceNumber, shoppingId, useCart, type CartItem } from "@/api/shopping";
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";
import ProductImage from "@/components/products/ProductImage";
import AmountToAdd from "@/components/pantry/AmountToAdd";
import { resolvePantryAddition, type PantryAmountSelection } from "@/utils/pantryAmounts";
import { toNumber } from "@/api/products/productLookup/utils";
import { useUserSettings } from "@/api/user-settings";
import { targetStatus, coverageGrade, nutritionPerPound, overallCoverage, targetCoverage } from "@/utils/productValue";
import { brand } from "@/components/brand/theme";

const gradeColours = {
  A: { backgroundColor: "#DDF3E4", color: "#246B3A" },
  B: { backgroundColor: "#EAF4D3", color: "#587520" },
  C: { backgroundColor: "#FFF3C4", color: "#806815" },
  D: { backgroundColor: "#FFE0B2", color: "#925A13" },
  E: { backgroundColor: "#FFD6D6", color: "#A12F2F" },
};

function CartLine({ item, locked, update, remove }: {
  item: CartItem; locked: boolean; update: (patch: Partial<CartItem>) => void; remove: () => void;
}) {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  const [price, setPrice] = useState(item.price);
  const [amount, setAmount] = useState<PantryAmountSelection>({ mode: "amount", value: String(item.amount) });
  const settings = useUserSettings().data;
  const size = toNumber(item.product.product_amount);
  const grade = (nutrition: string, target?: number) => targetCoverage(
    nutritionPerPound(toNumber(nutrition), item.amount, priceNumber(price) ?? 0),
    settings?.cost_target_per_day ?? null, target ?? null)?.percentage ?? null;
  const calories = grade(item.product.nutriments.energy_kcal_100g, settings?.calories_target_per_day);
  const protein = grade(item.product.nutriments.proteins_100g, settings?.protein_target_per_day);
  return <View style={s.card}>
    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      <ProductImage thumbnail uri={item.product.image_url} name={item.product.product_name} />
      <Text style={[s.heading, { flex: 1 }]}>{item.product.product_name}</Text>
    </View>
    <AmountToAdd selection={amount} packageSize={size} unit={item.product.measurement_unit} disabled={locked}
      onChange={selection => { setAmount(selection); update({ amount: resolvePantryAddition(selection, size) ?? 0 }); }} />
    <Text style={s.text}>Total price paid (£)</Text>
    <TextInput accessibilityLabel={`Total price paid for ${item.product.product_name}`} style={s.input}
      keyboardType="decimal-pad" value={price} editable={!locked} placeholder="0.00"
      onChangeText={text => { setPrice(text); update({ price: text }); }} />
    <View style={{ flexDirection: "row", gap: 8 }}>
      {([["Calories", calories], ["Protein", protein],
        ["Overall", overallCoverage(calories, protein)]] as const).map(([label, percentage]) => {
        const value = coverageGrade(percentage);
        const percentageText = percentage === null ? "—" : `${formatNumber(percentage)}%`;
        const colours = value ? gradeColours[value] : { backgroundColor: appTheme.color(brand.background, "surface"), color: appTheme.color(brand.muted, "text") };
        return <View key={label} accessible accessibilityLabel={`${label} value: ${value ?? "Unknown"}${percentage === null ? "" : `, ${percentageText} budget-based target coverage`}`}
          style={{ flex: 1, minWidth: 0, paddingHorizontal: 6, paddingVertical: 10, borderRadius: 12,
            alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: appTheme.color(colours.backgroundColor, "surface") }}>
          <Text style={{ fontSize: 12, fontWeight: "600", textAlign: "center", color: appTheme.color(colours.color, "text") }}>{label}</Text>
          <Text style={{ fontSize: value ? 24 : 12, fontWeight: "800", textAlign: "center", color: appTheme.color(colours.color, "text") }}>{value ?? "Unknown"}</Text>
          <Text style={{ fontSize: 12, fontWeight: "600", textAlign: "center", color: appTheme.color(colours.color, "text") }}>{percentageText}</Text>
          {targetStatus(percentage) && <Text style={{ fontSize: 11, textAlign: "center", color: appTheme.color(colours.color, "text") }}>{targetStatus(percentage)}</Text>}
        </View>;
      })}
    </View>
    <MealButton title="Remove from cart" destructive disabled={locked} onPress={remove} />
  </View>;
}

export default function Shopping() {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  const cart = useCart();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const guard = useRef(false);
  const locked = busy || !!cart.data?.attempted;
  const total = cart.data?.items.reduce((sum, item) => sum + Math.round((priceNumber(item.price) ?? 0) * 100), 0) ?? 0;
  async function edit(id: string, patch?: Partial<CartItem>) {
    setSuccess("");
    try { await cart.change(current => {
      if (current.attempted) throw new Error("Retry checkout before changing this cart.");
      return { ...current, items: patch ? current.items.map(item => item.id === id ? { ...item, ...patch } : item)
        : current.items.filter(item => item.id !== id) };
    }); } catch (failure) {
      setSaveFailed(true);
      setError(failure instanceof Error ? failure.message : "Could not save your cart.");
    }
  }
  async function checkout() {
    if (guard.current || saveFailed) return;
    guard.current = true; setBusy(true); setError(""); setSuccess("");
    let recorded = false;
    try {
      const pending = await cart.change(current => {
        if (!current.items.length || current.items.some(i => i.amount <= 0 || priceNumber(i.price) === null))
          throw new Error("Enter a valid amount and total price for every item.");
        return { ...current, attempted: true };
      });
      await completeShopping(pending);
      recorded = true;
      await cart.change(() => ({ id: shoppingId(), attempted: false, items: [] }));
      await Promise.all(["pantry", "meals", "shopping-history", "shopping-spending"].map(key =>
        client.invalidateQueries({ queryKey: [key] })));
      setSuccess("Shopping saved. Your purchases have been added to the pantry.");
    } catch (failure) {
      // SQL exceptions are a confirmed rollback. Network failures may have committed:
      // keep that cart frozen and retry using its original ID.
      const code = (failure as { code?: string }).code;
      if (!recorded && code && /^[0-9A-Z]{5}$/.test(code)) {
        await cart.change(current => ({ ...current, attempted: false })).catch(() => undefined);
      }
      setError(recorded ? "Shopping was saved, but the local cart could not be cleared. Retry safely to finish."
        : (failure as { message?: string }).message ?? "Checkout could not be confirmed. Retry with this cart.");
    } finally { guard.current = false; setBusy(false); }
  }
  if (cart.isLoading) return <MealStatus loading />;
  if (cart.error || !cart.data) return <MealStatus error={cart.error?.message ?? "Could not load cart."} retry={() => cart.refetch()} />;
  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Shopping</Text>
    <Text style={s.muted}>Record purchases here. Items enter your pantry when you complete shopping.</Text>
    <View style={s.actionRow}>
      <MealButton title="Scan food" icon="barcode-outline" equalWidth disabled={locked} onPress={() => router.push({ pathname: "/camera", params: { intent: "shopping" } })} />
      <MealButton title="Search food" icon="search-outline" equalWidth secondary disabled={locked} onPress={() => router.push("/shoppingSearch")} />
    </View>
    {cart.data.attempted && <Text style={s.muted}>Checkout is awaiting confirmation. Retry below; items will not be added twice.</Text>}
    {!!success && <Text accessibilityRole="alert" style={[s.text, { color: appTheme.color("#247440", "text") }]}>✓ {success}</Text>}
    {!cart.data.items.length && <Text style={s.muted}>Your cart is empty. Scan or search to add a product.</Text>}
    {cart.data.items.map(item => <CartLine key={`${item.id}:${revision}`} item={item} locked={locked || saveFailed}
      update={patch => { void edit(item.id, patch); }} remove={() => { void edit(item.id); }} />)}
    <Text style={s.heading}>Total · £{formatNumber(total / 100)}</Text>
    <Text style={s.muted}>Value grades use your current food budget and nutrition targets. Missing information or a zero price gives an unknown grade.</Text>
    {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
    {saveFailed && <MealButton title="Reload saved cart" secondary onPress={async () => {
      // Run after queued writes, then remount inputs to show only persisted values.
      try { await cart.change(current => current); setRevision(value => value + 1); setSaveFailed(false); setError(""); }
      catch { setError("Could not reload your saved cart. Please try again."); }
    }} />}
    <MealButton title={busy ? "Saving shopping…" : cart.data.attempted ? "Retry checkout" : `Complete shopping · Add ${cart.data.items.length} items · £${formatNumber(total / 100)}`}
      disabled={busy || saveFailed || !cart.data.items.length} onPress={checkout} />
  </ScrollView>;
}
