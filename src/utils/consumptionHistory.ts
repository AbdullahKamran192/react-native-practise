import type { MealPeriod } from "./mealPeriod";
export const nutrients = ["calories", "protein", "carbs", "fat", "sugars", "salt", "fibre"] as const;
export type Nutrient = typeof nutrients[number];
export type HistoryRow = {
  meal_period: MealPeriod;
  product?: { image_url: string | null; image_path?: string | null } | null;
  generic_product?: { image_path: string | null } | null;
  meal?: { public_image_path?: string | null; id: number; user_id: string; image_path: string | null } | null;
  id: number; consumption_group_id: string; consumed_on: string; created_at: string;
  meal_name_snapshot: string | null; product_name_snapshot: string;
  brand_snapshot: string | null; amount_consumed: number; measurement_unit: string;
} & Record<`${Nutrient}_consumed`, number | null>;
export function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
}
export function parseDay(key: string): Date {
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y,m-1,d,12);
}
export function recentDates(today: string): string[] {
  return Array.from({length:30}, (_,i) => {
    const day = parseDay(today); day.setDate(day.getDate()-i); return dateKey(day);
  });
}
export function summarize(rows: HistoryRow[]) {
  const totals = Object.fromEntries(nutrients.map(n => [n,0])) as Record<Nutrient, number>;
  const missing = Object.fromEntries(nutrients.map(n => [n,false])) as Record<Nutrient, boolean>;
  for (const row of rows) for (const n of nutrients) {
    const value = row[`${n}_consumed`];
    if (value === null || value === undefined || !Number.isFinite(Number(value))) missing[n] = true;
    else totals[n] += Number(value);
  }
  return {totals,missing};
}
export function groupConsumptions(rows: HistoryRow[]) {
  const groups = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const key = row.consumed_on + ":" + row.consumption_group_id;
    groups.set(key,[...(groups.get(key) ?? []),row]);
  }
  return [...groups.entries()].map(([id, items]) => ({
    id, items, name: items[0].meal_name_snapshot ?? items[0].product_name_snapshot,
    isMeal: items[0].meal_name_snapshot !== null,
    mealPeriod: items[0].meal_period ?? "Snack",
    createdAt: items[0].created_at, ...summarize(items),
  })).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export const dayColours = {
  neutral: { background: "#EDEDED", text: "#666", label: "No score" },
  green: { background: "#D9F2E2", text: "#205D3A", label: "Both targets met" },
  yellow: { background: "#FFF1B8", text: "#715600", label: "Both targets at least 75%" },
  orange: { background: "#FFE0C2", text: "#884315", label: "Both targets at least 50%" },
  red: { background: "#FBE0DF", text: "#922F30", label: "One or both targets below 50%" },
};
export function dayScore(rows: HistoryRow[], caloriesTarget: number, proteinTarget: number): keyof typeof dayColours {
  const {totals,missing} = summarize(rows);
  if (!rows.length || missing.calories || missing.protein || caloriesTarget <= 0 || proteinTarget <= 0) return "neutral";
  const ratio = Math.min(totals.calories/caloriesTarget, totals.protein/proteinTarget);
  return ratio >= 1 ? "green" : ratio >= .75 ? "yellow" : ratio >= .5 ? "orange" : "red";
}

