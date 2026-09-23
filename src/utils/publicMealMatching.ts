import { foodMatchTier } from "./foodMatch";
import type { PublicMeal, PublicMealDraft, RecipeSelection } from "@/api/publicMeals";
import type { PantryItem } from "@/api/products";
export const roundRecipeAmount = (value: number) => Math.round(value * 1000) / 1000;
export const selectionKey = (item: { product_barcode: string | null; generic_product_id: number | null }) => item.product_barcode ? "b:" + item.product_barcode : "g:" + item.generic_product_id;
export function initialPublicMeal(meal: PublicMeal): PublicMealDraft {
  return { checked: false, selections: meal.ingredients.map(i => ({ ingredient_id: i.id,
    product_barcode: null, generic_product_id: i.generic_product_id,
    amount: roundRecipeAmount(Number(i.amount)), product: i.generic_product })) };
}
export function matchPublicMeal(meal: PublicMeal, pantry: PantryItem[]): PublicMealDraft {
  const draft = initialPublicMeal(meal);
  const available = new Map(pantry.map(p => [p.id, Math.max(0, Number(p.amount_remaining))]));
  const oldest = [...new Map(pantry.map(row => [row.id, row])).values()].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id-b.id);
  draft.selections = draft.selections.flatMap(original => {
    const parts: RecipeSelection[] = [];
    let remaining = original.amount;
    const tier = (row: PantryItem) => foodMatchTier(original.generic_product_id,
      meal.ingredients.find(i => i.id === original.ingredient_id)?.generic_product,
      row.generic_product_id ?? row.product?.generic_product_id, row.generic_product ?? row.product?.generic_product);
    const candidates = oldest.filter(row => ["exact_generic", "same_family"].includes(tier(row)))
      .sort((a, b) => Number(tier(a) !== "exact_generic") - Number(tier(b) !== "exact_generic"));
    for (const row of candidates) {
      const product = row.product ?? row.generic_product;
      if (!product || !Number.isFinite(Number(row.amount_remaining)) || product.measurement_unit !== original.product.measurement_unit) continue;
      const amount = roundRecipeAmount(Math.min(remaining, available.get(row.id) ?? 0));
      if (amount <= 0) continue;
      parts.push({ ingredient_id: original.ingredient_id, product_barcode: row.product_barcode,
        generic_product_id: row.generic_product_id, product, amount });
      available.set(row.id, roundRecipeAmount((available.get(row.id) ?? 0)-amount));
      remaining = roundRecipeAmount(remaining-amount);
    }
    // Keep the missing portion generic, so it is still visible, replaceable and loggable.
    if (remaining > 0) parts.push({ ...original, amount: remaining });
    return parts;
  });
  draft.checked = true;
  return draft;
}
export function selectionCoverage(selections: RecipeSelection[], pantry: PantryItem[]) {
  const stock = new Map<string,number>();
  pantry.forEach(p => stock.set(selectionKey(p), (stock.get(selectionKey(p)) ?? 0)+Number(p.amount_remaining)));
  const coverage = new Map<number,{ needed: number; available: number }>();
  selections.forEach(s => {
    const key=selectionKey(s), available=Math.max(0,Math.min(s.amount,stock.get(key) ?? 0));
    stock.set(key,Math.max(0,(stock.get(key) ?? 0)-available));
    const previous=coverage.get(s.ingredient_id) ?? { needed: 0, available: 0 };
    coverage.set(s.ingredient_id,{ needed: previous.needed+s.amount, available: previous.available+available });
  });
  return coverage;
}
