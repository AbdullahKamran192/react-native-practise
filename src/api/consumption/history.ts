import { supabase } from "@/lib/supabase";
import type { HistoryRow } from "@/utils/consumptionHistory";

const imageRelations = "product:products(image_url,image_path),generic_product:generic_products(image_path),meal:meals(id,user_id,image_path,public_image_path)";

export async function getConsumptionDetails(groupId: string): Promise<HistoryRow[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
    throw new Error("Choose a valid consumption entry.");
  }
  const {data:{user},error:authError} = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!user) throw new Error("Sign in to view this food log.");
  const {data,error} = await supabase.from("food_consumption").select(`*,${imageRelations}`)
    .eq("user_id",user.id).eq("consumption_group_id",groupId).order("id",{ascending:true});
  if (error) throw new Error(error.message);
  return data as unknown as HistoryRow[];
}

export async function getConsumptionHistory(firstDate: string, lastDate: string): Promise<HistoryRow[]> {
  const { data: {user}, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!user) throw new Error("Sign in to view your food history.");
  const rows: HistoryRow[] = [];
  // Supabase caps rows per response. Continue until the complete window is read.
  let lastId: number | null = null;
  while (true) {
    let query = supabase.from("food_consumption")
      .select(`id,consumption_group_id,consumed_on,meal_period,created_at,meal_name_snapshot,product_name_snapshot,brand_snapshot,amount_consumed,measurement_unit,calories_consumed,protein_consumed,carbs_consumed,fat_consumed,sugars_consumed,salt_consumed,fibre_consumed,${imageRelations}`)
      .eq("user_id",user.id).gte("consumed_on",firstDate).lte("consumed_on",lastDate)
      .order("id", {ascending:true}).limit(500);
    if (lastId !== null) query = query.gt("id",lastId);
    const {data,error} = await query;
    if (error) throw new Error(error.code === "PGRST205" ? "The food consumption table is not installed yet." : error.message);
    if (!data?.length) break;
    rows.push(...data as unknown as HistoryRow[]);
    lastId = data[data.length-1].id;
  }
  return rows;
}

