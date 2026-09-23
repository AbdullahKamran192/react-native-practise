import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { formatNumber } from "@/utils/formatNumber";
﻿import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteShoppingItem, purchaseDetails, type Purchase } from "@/api/shopping";
import { targetStatus, overallCoverage, coverageGrade, type ValueGrade } from "@/utils/productValue";
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";
import ProductImage from "@/components/products/ProductImage";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";

const gradeColours: Record<ValueGrade, { background: string; text: string }> = {
  A: { background: "#DDF3E4", text: "#246B3A" },
  B: { background: "#EAF4D3", text: "#587520" },
  C: { background: "#FFF3C4", text: "#806815" },
  D: { background: "#FFE0B2", text: "#925A13" },
  E: { background: "#FFD6D6", text: "#A12F2F" },
};
function GradeBadge({ label, grade, percentage }: { label: string; grade: ValueGrade | null; percentage?: number | null }) {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

  const colour = grade ? gradeColours[grade] : { background: brand.background, text: brand.muted };
  return <View style={[styles.grade, { backgroundColor: appTheme.color(colour.background, "surface") }]}>
    <Text style={[styles.gradeLabel, { color: appTheme.color(colour.text, "text") }]}>{label}</Text>
    <Text style={[styles.letter, { color: appTheme.color(colour.text, "text") }]}>{grade ?? "—"}</Text>
    <Text style={[styles.gradeCaption, { color: appTheme.color(colour.text, "text") }]}>{!grade ? "Unknown" : percentage != null ? `${percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : "Value"}</Text>
    {targetStatus(percentage) && <Text style={[styles.gradeCaption, { color: appTheme.color(colour.text, "text") }]}>{targetStatus(percentage)}</Text>}
  </View>;
}
export default function ShoppingTrip() {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);
  const styles = useThemeStyles(baseStyles);

  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ["shopping-history", "detail", id], queryFn: () => purchaseDetails(id) });
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function remove() {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await deleteShoppingItem(id, selected.id);
      await client.cancelQueries({ queryKey: ["shopping-history"] });
      client.setQueryData<Purchase[]>(["shopping-history", "detail", id], rows => rows?.filter(item => item.id !== selected.id));
      setSelected(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["shopping-history"] }),
        client.invalidateQueries({ queryKey: ["shopping-spending"] }),
      ]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not delete this item. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (query.isLoading) return <MealStatus loading />;
  if (query.error) return <MealStatus error={query.error.message} retry={() => query.refetch()} />;
  const items = query.data ?? [];
  const total = items.reduce((sum, item) => sum + Math.round(Number(item.price_paid) * 100), 0) / 100;
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={styles.row}>
      <Text style={[s.title, { flex: 1 }]}>Purchased items</Text>
      <MealButton title={editing ? "Done" : "Edit"} icon={editing ? "close" : "create-outline"} disabled={busy || !items.length} onPress={() => setEditing(value => !value)} />
    </View>
    <View style={styles.summary}>
      <View style={{ flex: 1 }}><Text style={s.muted}>{items.length} purchased {items.length === 1 ? "item" : "items"}</Text><Text style={s.heading}>Shopping total</Text></View>
      <Text style={styles.total}>£{formatNumber(total)}</Text>
    </View>
    <Text style={s.muted}>Value grades saved at checkout. Product images show the current available photo.</Text>
    {!items.length && <Text style={s.text}>No purchased items remain in this trip.</Text>}
    {items.map(item => {
      const calories = item.calorie_percentage === null ? null : Number(item.calorie_percentage);
      const protein = item.protein_percentage === null ? null : Number(item.protein_percentage);
      const overallPercentage = overallCoverage(calories, protein);
      const overall = coverageGrade(overallPercentage);
      return <View style={s.card} key={item.id}>
        <View style={styles.row}>
          <ProductImage thumbnail thumbnailSize={68} uri={item.image_url} name={item.product_name_snapshot} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.heading}>{item.product_name_snapshot}</Text>
            {!!item.brand_snapshot && <Text style={s.muted}>{item.brand_snapshot}</Text>}
          </View>
          {editing && <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.product_name_snapshot} from purchase history`}
            disabled={busy} style={styles.bin} onPress={() => { setError(""); setSelected(item); }}>
            <AppIcon name="trash-outline" size={23} color={appTheme.color(brand.red, "text")} />
          </Pressable>}
        </View>
        <View style={styles.purchaseRow}>
          <View style={{ flex: 1 }}><Text style={s.muted}>Purchased</Text><Text style={styles.amount}>{formatNumber(item.amount_purchased)}{item.measurement_unit}</Text></View>
          <View style={{ alignItems: "flex-end" }}><Text style={s.muted}>Paid</Text><Text style={styles.amount}>£{formatNumber(item.price_paid)}</Text></View>
        </View>
        <View style={styles.badges}>
          <GradeBadge label="Calories" grade={coverageGrade(calories)} percentage={calories} />
          <GradeBadge label="Protein" grade={coverageGrade(protein)} percentage={protein} />
          <GradeBadge label="Overall" grade={overall} percentage={overallPercentage} />
        </View>
      </View>;
    })}
    <Text style={s.muted}>A: excellent · B: very good · C: good · D: low · E: poor value. Unknown means the price, nutrition or targets were unavailable.</Text>
    <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setSelected(null); }}>
      <View style={styles.backdrop}><View style={[s.card, { width: "100%", maxWidth: 420 }]} accessibilityViewIsModal>
        <Text style={s.heading}>Delete purchased item?</Text>
        <Text style={s.text}>{selected?.product_name_snapshot}</Text>
        <Text style={s.muted}>Remove this item from purchase history and spending totals? Pantry stock stays unchanged. Removing the last item also removes the empty shopping trip.</Text>
        {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
        <View style={s.actionRow}>
          <MealButton title="Cancel" secondary equalWidth disabled={busy} onPress={() => setSelected(null)} />
          <MealButton title={busy ? "Deleting…" : "Delete"} destructive equalWidth disabled={busy} onPress={remove} />
        </View>
      </View></View>
    </Modal>
  </ScrollView>;
}
const baseStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  summary: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16, padding: 20, borderRadius: 22, backgroundColor: brand.paleTeal },
  total: { fontSize: 28, fontWeight: "700", color: brand.deepTeal },
  purchaseRow: { flexDirection: "row", gap: 16, borderTopWidth: 1, borderTopColor: brand.border, paddingTop: 14 },
  amount: { fontSize: 20, fontWeight: "700", color: brand.deepTeal, marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grade: { flexGrow: 1, flexBasis: 80, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 14, borderRadius: 16, gap: 4 },
  gradeLabel: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  letter: { fontSize: 30, fontWeight: "800" },
  gradeCaption: { fontSize: 12, textAlign: "center" },
  bin: { minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: brand.paleRed, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, padding: 24, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
});
