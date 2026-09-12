import { useLocalSearchParams } from "expo-router";
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
const format = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 3 });

export default function PantryDetails() {
  const { pantryId } = useLocalSearchParams<{ pantryId?: string }>();
  const query = useQuery({ queryKey: ["pantry", "detail", pantryId], queryFn: () => getPantryItem(pantryId ?? "") });
  if (query.isPending) return <MealStatus loading />;
  if (query.error) return <MealStatus error={query.error.message} retry={() => void query.refetch()} />;
  if (!query.data) return <MealStatus error="This item is no longer in your pantry." />;
  return <PantryEditor key={pantryId} initialItem={query.data} />;
}

function PantryEditor({ initialItem }: { initialItem: PantryItem }) {
  const client = useQueryClient();
  // Keep the editing baseline stable even if the query refreshes in the background.
  const [item, setItem] = useState(initialItem);
  const [selection, setSelection] = useState<PantryAmountSelection>({ mode: "amount", value: String(item.amount_remaining) });
  const [busy, setBusy] = useState(false);
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
      <Text style={s.caption}>{item.generic_product ? "Generic food" : "Packaged product"}</Text>
      <Text style={s.title}>{product?.product_name ?? "Unknown product"}</Text>
      <Text style={s.note}>{packageSize === null ? "Item size unavailable" : `1 item = ${format(packageSize)} ${unit}`}</Text>
      {item.product_barcode && <Text style={s.note}>Barcode: {item.product_barcode}</Text>}
      <AmountToAdd purpose="remaining" selection={selection} onChange={value => { setSelection(value); setSaved(false); }}
        packageSize={packageSize} unit={unit} disabled={busy} />
      <Text style={s.note}>Set the total you have left. Changes are applied when you save.</Text>
      <Pressable onPress={() => void save()} disabled={busy || !changed}
        accessibilityRole="button" accessibilityState={{ disabled: busy || !changed }}
        style={[s.button, (busy || !changed) && s.disabled]}>
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
            <Text style={s.text}>{labels[nutrient]}</Text>
            <Text style={s.value}>{per100 == null ? "Not recorded" : amount === null ? "—" : `${format(Number(per100) * amount / 100)} ${nutrient === "calories" ? "kcal" : "g"}`}</Text>
          </View>;
        })}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" }, content: { padding: 20, paddingBottom: 40 },
  caption: { fontSize: 13, color: "#777", marginBottom: 6 }, title: { fontSize: 26, fontWeight: "700", color: "#222" },
  note: { fontSize: 13, lineHeight: 20, color: "#777", marginTop: 8 },
  button: { backgroundColor: "#222", borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 16 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" }, disabled: { opacity: 0.45 },
  success: { color: "#365A40", marginTop: 12 }, error: { color: "#B3261E", marginTop: 12 },
  reload: { paddingVertical: 14 }, reloadText: { color: "#222", fontWeight: "600", textDecorationLine: "underline" },
  card: { backgroundColor: "#fff", padding: 18, borderRadius: 18, marginTop: 22 },
  heading: { fontSize: 18, fontWeight: "600", color: "#222" }, text: { fontSize: 15, color: "#555" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  value: { fontSize: 15, fontWeight: "600", color: "#222", flexShrink: 1, textAlign: "right" },
});
