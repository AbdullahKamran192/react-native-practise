import { supabase } from "@/lib/supabase";
import { addPantryAmounts, validatePantryAddition } from "@/utils/pantryAmounts";

type PantryProduct =
  | { product_barcode: string; generic_product_id: null }
  | { product_barcode: null; generic_product_id: number };

// Compare the previously read amount when updating. Retry if another
// addition changed it, rather than overwriting the other addition.
export async function addPantryAmount(
  userId: string,
  product: PantryProduct,
  amount: number
): Promise<number> {
  const addition = validatePantryAddition(amount);
  const column = product.product_barcode !== null
    ? "product_barcode" : "generic_product_id";
  const identifier = product.product_barcode ?? product.generic_product_id;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing, error: lookupError } = await supabase
      .from("pantry")
      .select("id, amount_remaining")
      .eq("user_id", userId)
      .eq(column, identifier)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);

    const amountRemaining = addPantryAmounts(
      existing ? Number(existing.amount_remaining) : 0,
      addition
    );

    if (existing) {
      const { data, error } = await supabase
        .from("pantry")
        .update({ amount_remaining: amountRemaining })
        .eq("id", existing.id)
        .eq("user_id", userId)
        .eq("amount_remaining", existing.amount_remaining)
        .select("amount_remaining")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (data) return Number(data.amount_remaining);
    } else {
      const { data, error } = await supabase
        .from("pantry")
        .insert({ user_id: userId, ...product, amount_remaining: amountRemaining })
        .select("amount_remaining")
        .single();

      // A concurrent insert can win the unique user/product constraint.
      if (error?.code === "23505") continue;
      if (error) throw new Error(error.message);
      return Number(data.amount_remaining);
    }
  }

  throw new Error("Your pantry changed while adding this product. Please try again.");
}
