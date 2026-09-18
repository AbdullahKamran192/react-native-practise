import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LookupProduct } from "@/api/products/productLookup/utils";
import { barcodeProductImageUrl, genericProductImageUrl } from "@/utils/productImage";

export type CartItem = {
  id: string; product_barcode: string | null; generic_product_id: number | null;
  product: LookupProduct; amount: number; price: string;
};
export type Cart = { id: string; attempted: boolean; items: CartItem[] };
export type Trip = { id: string; completed_at: string; total_spent: number };
export type Purchase = {
  product_barcode: string | null; generic_product_id: number | null; image_url?: string | null;
  id: number; product_name_snapshot: string; brand_snapshot: string | null;
  amount_purchased: number; measurement_unit: string; price_paid: number;
  calorie_percentage: number | null; protein_percentage: number | null; overall_grade: string | null;
};
// Identifiers, not authentication tokens. The server also scopes every operation to auth.uid().
export function shoppingId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16); return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
export async function shoppingUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Sign in to shop.");
  return user.id;
}
const key = (user: string) => `shopping-cart:${user}`;
export async function readCart(user: string): Promise<Cart> {
  const saved = await AsyncStorage.getItem(key(user));
  if (saved) return JSON.parse(saved) as Cart;
  return { id: shoppingId(), attempted: false, items: [] };
}
let writes: Promise<unknown> = Promise.resolve();
export function changeCart(user: string, change: (cart: Cart) => Cart): Promise<Cart> {
  const next = writes.then(async () => {
    const cart = change(await readCart(user));
    await AsyncStorage.setItem(key(user), JSON.stringify(cart));
    return cart;
  });
  writes = next.catch(() => undefined);
  return next;
}
export function useCart() {
  const client = useQueryClient();
  const owner = useQuery({ queryKey: ["shopping-user"], queryFn: shoppingUser });
  const user = owner.data;
  const query = useQuery({ queryKey: ["shopping-cart", user], queryFn: () => readCart(user!), enabled: !!user });
  return { ...query, error: owner.error ?? query.error, isLoading: owner.isLoading || query.isLoading, user,
    async change(change: (cart: Cart) => Cart) {
      if (!user) throw new Error("Sign in to shop.");
      const next = await changeCart(user, change);
      client.setQueryData(["shopping-cart", user], next);
      return next;
    } };
}
export function priceNumber(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const price = Number(value);
  return price <= 1000000 ? price : null;
}
export async function completeShopping(cart: Cart) {
  const { data, error } = await supabase.rpc("complete_shopping", {
    p_trip_id: cart.id,
    p_items: cart.items.map(item => ({ product_barcode: item.product_barcode, generic_product_id: item.generic_product_id,
      amount: item.amount, price: priceNumber(item.price), measurement_unit: item.product.measurement_unit,
      brand: item.product.brands || null })),
  });
  if (error) throw error;
  if (data !== cart.id) throw new Error("Checkout could not be confirmed. Retry with this cart.");
  return data as string;
}
export async function shoppingHistory(page: number): Promise<Trip[]> {
  const user = await shoppingUser();
  const { data, error } = await supabase.from("shopping_trips").select("id,completed_at,total_spent")
    .eq("user_id", user).order("completed_at", { ascending: false }).order("id").range(page * 20, page * 20 + 20);
  if (error) throw error;
  return data as Trip[];
}
export async function purchaseDetails(id: string): Promise<Purchase[]> {
  const { data, error } = await supabase.from("shopping_trip_items").select("*")
    .eq("shopping_trip_id", id).order("id");
  if (error) throw error;
  const items = data as Purchase[];
  const barcodes = [...new Set(items.flatMap(item => item.product_barcode ? [item.product_barcode] : []))];
  const genericIds = [...new Set(items.flatMap(item => item.generic_product_id !== null ? [item.generic_product_id] : []))];
  // These historical references are not foreign keys. Missing/inaccessible
  // catalogue images must not prevent the purchase snapshots from displaying.
  const [products, generic] = await Promise.allSettled([
    barcodes.length ? supabase.from("products").select("barcode_number,image_path,image_url").in("barcode_number", barcodes) : Promise.resolve({ data: [] }),
    genericIds.length ? supabase.from("generic_products").select("id,image_path").in("id", genericIds) : Promise.resolve({ data: [] }),
  ]);
  const productImages = new Map(products.status === "fulfilled" ? (products.value.data ?? []).map(p => [p.barcode_number, barcodeProductImageUrl(p)]) : []);
  const genericImages = new Map(generic.status === "fulfilled" ? (generic.value.data ?? []).map(p => [Number(p.id), genericProductImageUrl(p.image_path)]) : []);
  return items.map(item => ({ ...item, image_url: item.product_barcode ? productImages.get(item.product_barcode) ?? null : genericImages.get(Number(item.generic_product_id)) ?? null }));
}
export async function deleteShoppingItem(tripId: string, itemId: number) {
  const user = await shoppingUser();
  const cart = await readCart(user);
  if (cart.id === tripId && cart.attempted) {
    throw new Error("Confirm this purchase with Retry checkout on the shopping page before deleting its items.");
  }
  const { error } = await supabase.rpc("delete_shopping_item", { p_trip_id: tripId, p_item_id: itemId });
  if (error) throw new Error(error.message);
}
export type DeleteTripResult = { trip_deleted: boolean; pantry_items_updated: number; pantry_items_unavailable: number; pantry_items_short: number };
export async function deleteShoppingTrip(id: string, removeFromPantry = false): Promise<DeleteTripResult> {
  const user = await shoppingUser();
  const cart = await readCart(user);
  if (cart.id === id && cart.attempted) {
    throw new Error("Finish confirming this purchase with Retry checkout on the shopping page before deleting it.");
  }
  const { data, error } = await supabase.rpc("delete_shopping_trip", { p_trip_id: id, p_remove_from_pantry: removeFromPantry });
  if (error) throw new Error(error.message);
  if (!data?.[0]) throw new Error("Deletion could not be confirmed. Please retry.");
  return data[0] as DeleteTripResult;
}
export async function yearlySpending(year: number): Promise<Trip[]> {
  const user = await shoppingUser();
  const trips: Trip[] = [];
  // Read in bounded pages so Supabase's response cap cannot silently truncate totals.
  for (let page = 0; ; page++) {
    const { data, error } = await supabase.from("shopping_trips").select("id,completed_at,total_spent")
      .eq("user_id", user).gte("completed_at", new Date(year, 0, 1).toISOString())
      .lt("completed_at", new Date(year + 1, 0, 1).toISOString())
      .order("completed_at").order("id").range(page * 500, page * 500 + 499);
    if (error) throw error;
    trips.push(...data as Trip[]);
    if (data.length < 500) return trips;
  }
}
