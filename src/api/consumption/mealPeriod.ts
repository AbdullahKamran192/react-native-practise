import { supabase } from "@/lib/supabase";
import { isMealPeriod, type MealPeriod } from "@/utils/mealPeriod";

export async function setConsumptionMealPeriod(groupId: string, period: MealPeriod) {
  if (!isMealPeriod(period)) throw new Error("Choose a valid meal period.");
  const { error } = await supabase.rpc("set_consumption_meal_period", {
    p_group_id: groupId, p_meal_period: period,
  });
  if (error) throw new Error(error.code === "PGRST202"
    ? "Run 20260916_consumption_meal_period.sql in Supabase first." : error.message);
}
