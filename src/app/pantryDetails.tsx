import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { formatNumber } from "@/utils/formatNumber";
import DeletePantryButton from "@/components/pantry/DeletePantryButton";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand, nutrients as nutrientTheme } from "@/components/brand/theme";
import ProductImage from "@/components/products/ProductImage";
import { genericProductImageUrl, barcodeProductImageUrl } from "@/utils/productImage";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPantryItem, setPantryRemaining } from "@/api/products/pantryDetails";
import type { PantryItem } from "@/api/products";
import AmountToAdd from "@/components/pantry/AmountToAdd";
import { MealStatus } from "@/components/meals/ui";
import { getPantryAmounts, resolvePantryAddition } from "@/utils/pantryAmounts";
import type { PantryAmountSelection } from "@/utils/pantryAmounts";

const nutrients = ["calories", "protein", "carbs", "fat", "sugars", "salt", "fibre"] as const;
const labels = { calories: "Calories", protein: "Protein", carbs: "Carbohydrates", fat: "Fat", sugars: "Sugars", salt: "Salt", fibre: "Fibre" };
const format = (value: number) => formatNumber(value);

export default function PantryDetails() {

  const { pantryId } = useLocalSearchParams<{ pantryId?: string }>();
  const query = useQuery({ queryKey: ["pantry", "detail", pantryId], queryFn: () => getPantryItem(pantryId ?? "") });
  if (query.isPending) return <MealStatus loading />;
  if (query.error) return <MealStatus error={query.error.message} retry={() => void query.refetch()} />;
  if (!query.data) return <MealStatus error="This item is no longer in your pantry." />;
  return <PantryEditor key={pantryId} initialItem={query.data} />;
}

function PantryEditor({ initialItem }: { initialItem: PantryItem }) {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  const client = useQueryClient();
  // Keep the editing baseline stable even if the query refreshes in the background.
  const [item, setItem] = useState(initialItem);
  const [selection, setSelection] = useState<PantryAmountSelection>({ mode: "amount", value: String(item.amount_remaining) });
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const product = item.product ?? item.generic_product;
  const { productAmount } = getPantryAmounts(item);
  const packageSize = Number.isFinite(productAmount) && productAmount > 0 ? productAmount : null;
  const amount = resolvePantryAddition(selection, packageSize);
  const changed = amount !== null && amount !== Number(item.amount_remaining);
  const unit = product?.measurement_unit ?? "g";

  async function save() {
    if (amount === null || !changed || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null); setSaved(false);
    try {
      await setPantryRemaining(item, amount);
      setItem({ ...item, amount_remaining: amount });
      setSaved(true);
      await client.invalidateQueries({ queryKey: ["pantry"] });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the amount."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function reload() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setSaved(false);
    try {
      const latest = await getPantryItem(String(item.id));
      client.setQueryData(["pantry", "detail", String(item.id)], latest);
      if (latest) {
        setItem(latest);
        setSelection({ mode: "amount", value: String(latest.amount_remaining) });
        setError(null);
      }
      await client.invalidateQueries({ queryKey: ["pantry", "amount-remaining"] });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reload this item."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <SafeAreaView style={s.screen} edges={["left", "right", "bottom"]}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <ProductImage name={product?.product_name ?? "Product"} uri={item.generic_product
        ? genericProductImageUrl(item.generic_product.image_path) : barcodeProductImageUrl(item.product)} />
      <Text style={s.caption}>{item.generic_product ? "Generic food" : "Packaged product"}</Text>
      <Text style={s.title}>{product?.product_name ?? "Unknown product"}</Text>
      <Text style={s.note}>{packageSize === null ? "Item size unavailable" : `1 item = ${format(packageSize)} ${unit}`}</Text>
      {item.product_barcode && <Text style={s.note}>Barcode: {item.product_barcode}</Text>}
      <AmountToAdd purpose="remaining" selection={selection} onChange={value => { setSelection(value); setSaved(false); }}
        packageSize={packageSize} unit={unit} disabled={busy || deleting} />
      <Text style={s.note}>Set the total you have left. Changes are applied when you save.</Text>
      <Pressable onPress={() => void save()} disabled={busy || deleting || !changed}
        accessibilityRole="button" accessibilityState={{ disabled: busy || deleting || !changed }}
        style={[s.button, (busy || deleting || !changed) && s.disabled]}>
        <Text style={s.buttonText}>{busy ? "Please wait…" : "Save changes"}</Text>
      </Pressable>
      {saved && <Text style={s.success} accessibilityLiveRegion="polite">Amount remaining updated.</Text>}
      {error && <View><Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>
        <Pressable onPress={() => void reload()} disabled={busy} style={s.reload} accessibilityRole="button">
          <Text style={s.reloadText}>Reload item and reset edits</Text>
        </Pressable></View>}
      <View style={s.card}>
        <Text style={s.heading}>Nutrition for amount remaining</Text>
        <Text style={s.note}>{amount === null ? "Enter a valid amount to preview nutrition." : `For ${format(amount)} ${unit}${changed ? " (unsaved)" : ""}`}</Text>
        {nutrients.map(nutrient => {
          const per100 = product?.[`${nutrient}_per_100`];
          return <View key={nutrient} style={s.row}>
            <View style={s.nutrientLabel}>
              <AppIcon name={nutrientTheme[nutrient].icon} size={20} color={appTheme.color(nutrientTheme[nutrient].color, "text")} accessible={false} />
              <Text style={[s.text, s.labelText]}>{labels[nutrient]}</Text>
            </View>
            <Text style={s.value}>{per100 == null ? "Not recorded" : amount === null ? "—" : `${format(Number(per100) * amount / 100)} ${nutrient === "calories" ? "kcal" : "g"}`}</Text>
          </View>;
        })}
      </View>
      <DeletePantryButton item={item} fullWidth disabled={busy} onBusyChange={setDeleting}
        onDeleted={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/pantry"); }} />
    </ScrollView>
  </SafeAreaView>;
}

const baseS = StyleSheet.create({
  nutrientLabel: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  labelText: { flexShrink: 1 },
  screen: { flex: 1, backgroundColor: brand.background }, content: { padding: 20, paddingBottom: 40 },
  caption: { fontSize: 13, color: brand.teal, marginBottom: 6 }, title: { fontSize: 26, fontWeight: "700", color: brand.ink },
  note: { fontSize: 13, lineHeight: 20, color: brand.muted, marginTop: 8 },
  button: { backgroundColor: brand.teal, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 16 },
  buttonText: { color: brand.surface, fontSize: 16, fontWeight: "600" }, disabled: { opacity: 0.45 },
  success: { color: nutrientTheme.protein.color, marginTop: 12 }, error: { color: brand.red, marginTop: 12 },
  reload: { paddingVertical: 14 }, reloadText: { color: brand.teal, fontWeight: "600", textDecorationLine: "underline" },
  card: { backgroundColor: brand.surface, padding: 18, borderRadius: 18, marginTop: 22 },
  heading: { fontSize: 18, fontWeight: "600", color: brand.ink }, text: { fontSize: 15, color: brand.muted },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: brand.border },
  value: { fontSize: 15, fontWeight: "600", color: brand.ink, flexShrink: 1, textAlign: "right" },
});
