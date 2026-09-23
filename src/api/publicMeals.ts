import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { GenericProductRow, ProductRow } from "@/api/products";

export type PublicIngredient = {
  name: string | null;
  id: number; generic_product_id: number; amount: number; measurement_unit: "g" | "ml";
  is_optional: boolean; sort_order: number; generic_product: GenericProductRow;
};
export type PublicMeal = {
  id: number; meal_name: string; description: string | null; instructions: string | null;
  meal_type: string; image_path: string | null; ingredients: PublicIngredient[];
};
export type RecipeSelection = {
  ingredient_id: number; product_barcode: string | null; generic_product_id: number | null;
  amount: number; product: ProductRow | GenericProductRow;
};
export type PublicMealDraft = { selections: RecipeSelection[]; checked: boolean };
export const selectionPayload = (items: RecipeSelection[]) => items.map(({ ingredient_id, product_barcode, generic_product_id, amount }) => ({ ingredient_id, product_barcode, generic_product_id, amount }));
export function usePublicMeal(id: string) {
  return useQuery({ queryKey: ["public-meals", id], enabled: !!id, queryFn: async () => {
    const { data, error } = await supabase.from("public_meals")
      .select("*, ingredients:public_meal_ingredients(*, generic_product:generic_products(*, food_group:food_groups(id,is_active),food_family:food_families(id,family_name,food_group_id,is_active)))").eq("id", id).single();
    if (error) throw new Error(error.message);
    const meal = data as unknown as PublicMeal;
    meal.ingredients.sort((a,b) => a.sort_order-b.sort_order || a.id-b.id);
    return meal;
  } });
}
// Screen-to-screen draft only; no personal meal or pantry records are created.
export function usePublicMealDraft(id: string) {
  const client = useQueryClient();
  const key = ["public-meal-draft", "whole-meal", id];
  const query = useQuery<PublicMealDraft | null>({ queryKey: key, queryFn: () => null, enabled: false, initialData: null, gcTime: Infinity });
  return { draft: query.data, setDraft: (draft: PublicMealDraft) => client.setQueryData(key, draft) };
}
export async function savePublicMeal(id: string, draft: PublicMealDraft) {
  const { data, error } = await supabase.rpc("save_public_meal", { p_meal_id: id, p_items: selectionPayload(draft.selections) });
  if (error?.code === "PGRST202") throw new Error("Run 20260919_public_meal_types.sql in Supabase before saving public recipes.");
  if (error) throw new Error(error.code === "23505" ? "A meal with this name is already in My Meals. Open it there to edit your saved version." : error.message);
  return String(data);
}
