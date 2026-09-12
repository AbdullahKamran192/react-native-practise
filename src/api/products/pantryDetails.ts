import { supabase } from "@/lib/supabase";
import type { PantryItem } from "@/api/products";
import { validatePantryAddition } from "@/utils/pantryAmounts";

async function currentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("Sign in to view your pantry.");
  return user.id;
}

export async function getPantryItem(id: string): Promise<PantryItem | null> {
  if (!/^[1-9]\d*$/.test(id)) throw new Error("Choose a pantry item.");
  const userId = await currentUser();
  const { data, error } = await supabase.from("pantry")
    .select("id,created_at,user_id,product_barcode,generic_product_id,amount_remaining,product:products(*),generic_product:generic_products(*)")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as PantryItem | null;
}

export async function setPantryRemaining(item: PantryItem, amount: number): Promise<void> {
  const remaining = validatePantryAddition(amount);
  const userId = await currentUser();
  // Compare the original amount in the UPDATE itself so concurrent stock changes
  // cannot be overwritten by an editor that was opened earlier.
  const { data, error } = await supabase.from("pantry")
    .update({ amount_remaining: remaining })
    .eq("id", item.id).eq("user_id", userId)
    .eq("amount_remaining", item.amount_remaining)
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This pantry item changed or was removed. Reload the item before editing again.");
}
