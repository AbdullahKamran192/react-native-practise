import { supabase } from "@/lib/supabase";
import { validateMealId } from "./validation";

export type PantryConsumption = {
  pantry_items_deducted: number;
  pantry_items_exhausted: number;
  pantry_items_short: number;
};

export async function consumeMeal(mealId: string): Promise<PantryConsumption> {
  validateMealId(mealId);
  const { data, error } = await supabase.rpc("consume_meal_from_pantry", {
    p_meal_id: mealId,
  }).single();
  if (error) {
    if (error.code === "PGRST202") {
      throw new Error("Pantry consumption needs the Supabase function setup. Run 20260912_consume_meal_from_pantry.sql first.");
    }
    throw new Error(error.message);
  }
  return data as PantryConsumption;
}
