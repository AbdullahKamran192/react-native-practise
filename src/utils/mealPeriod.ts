export const mealPeriods = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
export type MealPeriod = typeof mealPeriods[number];

export function defaultMealPeriod(date = new Date()): MealPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "Breakfast";
  if (hour >= 11 && hour < 15) return "Lunch";
  if (hour >= 17 && hour < 22) return "Dinner";
  return "Snack";
}

export function isMealPeriod(value: unknown): value is MealPeriod {
  return mealPeriods.some(period => period === value);
}
