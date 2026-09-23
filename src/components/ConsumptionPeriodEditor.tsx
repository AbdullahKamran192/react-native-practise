import { useAppTheme } from "@/theme/AppThemeProvider";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import MealPeriodSelector from "./MealPeriodSelector";
import { setConsumptionMealPeriod } from "@/api/consumption/mealPeriod";
import type { HistoryRow } from "@/utils/consumptionHistory";
import type { MealPeriod } from "@/utils/mealPeriod";
import { brand } from "@/components/brand/theme";

export default function ConsumptionPeriodEditor({ row }: { row: HistoryRow }) {
  const appTheme = useAppTheme();

  const client = useQueryClient();
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function change(period: MealPeriod) {
    if (lock.current || period === row.meal_period) return;
    lock.current = true; setSaving(true); setError("");
    try {
      await setConsumptionMealPeriod(row.consumption_group_id, period);
      await client.cancelQueries({ queryKey: ["food-consumption"] });
      client.setQueriesData<HistoryRow[]>({ queryKey: ["food-consumption"] }, rows =>
        rows?.map(item => item.consumption_group_id === row.consumption_group_id
          ? { ...item, meal_period: period } : item));
      void client.invalidateQueries({ queryKey: ["food-consumption"] });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update meal period."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <View style={{ gap: 10 }}>
    <MealPeriodSelector value={row.meal_period ?? "Snack"} disabled={saving} onChange={period => void change(period)} />
    {saving && <Text accessibilityLiveRegion="polite" style={{ color: appTheme.color(brand.muted, "text") }}>Saving meal period…</Text>}
    {!!error && <Text accessibilityLiveRegion="polite" style={{ color: appTheme.color(brand.red, "text") }}>{error}</Text>}
  </View>;
}
