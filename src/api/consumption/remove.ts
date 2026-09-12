import { supabase } from "@/lib/supabase";
export async function removeConsumption(groupId: string): Promise<void> {
  const {error} = await supabase.rpc("delete_food_consumption", {p_group_id:groupId});
  if (error) throw new Error(error.code === "PGRST202"
    ? "Run 20260912_remove_consumption_entry.sql in Supabase first." : error.message);
}

