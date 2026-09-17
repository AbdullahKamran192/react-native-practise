import type { PantryItem } from "@/api/products";
import type { MealItem } from "@/api/meals";

export type RecipeAmount = Pick<MealItem, "product_barcode" | "generic_product_id" | "amount">;
export function ingredientAvailability(item: RecipeAmount, pantry: PantryItem[]): number {
  const required = Number(item.amount);
  if (!Number.isFinite(required) || required <= 0) return 0;
  const available = pantry.reduce((total, row) => {
    const matches = item.product_barcode !== null
      ? row.product_barcode === item.product_barcode
      : item.generic_product_id !== null && row.generic_product_id === item.generic_product_id;
    const amount = Number(row.amount_remaining);
    return total + (matches && Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
  return Math.min(1, available / required);
}
export function mealAvailability(items: RecipeAmount[], pantry: PantryItem[]) {
  const available = items.filter(item => ingredientAvailability(item, pantry) >= 1).length;
  return { available, total: items.length, progress: items.length ? available / items.length : 0 };
}
