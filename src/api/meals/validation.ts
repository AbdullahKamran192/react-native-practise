import type { MealInput, MealItem } from "./types";

export const MAX_MEALS = 10;
export const MAX_MEAL_ITEMS = 50;

export function validateMeal(input: MealInput): MealInput {
  const name = input.meal_name.trim();
  if (!name || Array.from(name).length > 100) throw new Error("Enter a meal name between 1 and 100 characters.");
  if (Array.from(input.description ?? "").length > 500) throw new Error("Keep the description within 500 characters.");
  if (Array.from(input.instructions ?? "").length > 5000) throw new Error("Keep the instructions within 5000 characters.");
  return { meal_name: name, description: input.description?.trim() || null, instructions: input.instructions?.trim() || null };
}

export function validateMealAmount(amount: number): number {
  const rounded = Math.round(amount * 1000) / 1000;
  if (!Number.isFinite(amount) || rounded <= 0 || amount > 100000) {
    throw new Error("Ingredient amounts must be between 0.001 and 100000 g or ml.");
  }
  return rounded;
}

export function validateMealId(id: string): string {
  if (!/^[1-9][0-9]*$/.test(id)) throw new Error("This meal could not be identified. Open it again from Meals.");
  return id;
}

export const nutrientKeys = ["calories", "protein", "carbs", "fat", "sugars", "salt", "fibre"] as const;
export function getMealNutrition(items: MealItem[]) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0, salt: 0, fibre: 0 };
  let incomplete = false;
  for (const item of items) {
    const product = item.product ?? item.generic_product;
    for (const key of nutrientKeys) {
      const value = product?.[`${key}_per_100`];
      if (value === null || value === undefined) incomplete = true;
      totals[key] += Number(value ?? 0) * Number(item.amount) / 100;
    }
  }
  return { totals, incomplete };
}
