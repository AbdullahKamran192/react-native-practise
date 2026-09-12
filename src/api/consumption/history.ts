import { supabase } from "@/lib/supabase";
import type { HistoryRow } from "@/utils/consumptionHistory";

export async function getConsumptionHistory(firstDate: string, lastDate: string): Promise<HistoryRow[]> {
  const { data: {user}, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!user) throw new Error("Sign in to view your food history.");
  const rows: HistoryRow[] = [];
  // Supabase caps rows per response. Continue until the complete window is read.
  let lastId: number | null = null;
  while (true) {
    let query = supabase.from("food_consumption")
      .select("id,consumption_group_id,consumed_on,created_at,meal_name_snapshot,product_name_snapshot,brand_snapshot,amount_consumed,measurement_unit,calories_consumed,protein_consumed,carbs_consumed,fat_consumed,sugars_consumed,salt_consumed,fibre_consumed")
      .eq("user_id",user.id).gte("consumed_on",firstDate).lte("consumed_on",lastDate)
      .order("id", {ascending:true}).limit(500);
    if (lastId !== null) query = query.gt("id",lastId);
    const {data,error} = await query;
    if (error) throw new Error(error.code === "PGRST205" ? "The food consumption table is not installed yet." : error.message);
    if (!data?.length) break;
    rows.push(...data as HistoryRow[]);
    lastId = data[data.length-1].id;
  }
  return rows;
}

