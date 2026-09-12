import { supabase } from "@/lib/supabase";
import type { AddMealItemInput, Meal, MealInput, MealWithItems } from "./types";
import { MAX_MEALS, MAX_MEAL_ITEMS, validateMeal, validateMealAmount, validateMealId } from "./validation";

function fail(error: { code?: string; message: string }, duplicate = "This ingredient is already in the meal."): never {
  if (error.code === "23505") throw new Error(duplicate);
  if (error.code === "23503") throw new Error("The meal or product is no longer available. Refresh and try again.");
  if (error.code === "42501") throw new Error("You do not have permission to change this meal. Try signing in again.");
  throw new Error(error.message);
}

async function userId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) fail(error);
  if (!user) throw new Error("Sign in to manage your meals.");
  return user.id;
}

export async function getMeals(): Promise<Meal[]> {
  const user = await userId();
  const { data, error } = await supabase.from("meals").select("*").eq("user_id", user).order("created_at", { ascending: false });
  if (error) fail(error);
  return data as Meal[];
}

export async function getMeal(id: string): Promise<MealWithItems> {
  validateMealId(id);
  const user = await userId();
  const { data, error } = await supabase.from("meals")
    .select("*, items:meal_items(*, product:products(*), generic_product:generic_products(*))")
    .eq("id", id).eq("user_id", user).maybeSingle();
  if (error) fail(error);
  if (!data) throw new Error("This meal is no longer available.");
  const meal = data as unknown as MealWithItems;
  meal.items.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  return meal;
}

export async function createMeal(input: MealInput): Promise<Meal> {
  const values = validateMeal(input);
  const user = await userId();
  const { count, error: countError } = await supabase.from("meals").select("id", { count: "exact", head: true }).eq("user_id", user);
  if (countError) fail(countError);
  if ((count ?? 0) >= MAX_MEALS) throw new Error("You can create a maximum of 10 meals.");
  const { data, error } = await supabase.from("meals").insert({ ...values, user_id: user }).select("*").single();
  if (error) fail(error, "You already have a meal with this name.");
  return data as Meal;
}

export async function updateMeal(id: string, input: MealInput): Promise<Meal> {
  validateMealId(id);
  const values = validateMeal(input);
  const user = await userId();
  const { data, error } = await supabase.from("meals").update(values).eq("id", id).eq("user_id", user).select("*").single();
  if (error) fail(error, "You already have a meal with this name.");
  return data as Meal;
}

export async function deleteMeal(id: string) {
  validateMealId(id);
  const user = await userId();
  const { error } = await supabase.from("meals").delete().eq("id", id).eq("user_id", user);
  if (error) fail(error);
}

export async function addMealItem(input: AddMealItemInput) {
  validateMealId(input.mealId);
  const addition = validateMealAmount(input.amount);
  if ((input.product_barcode === null) === (input.generic_product_id === null)) throw new Error("Choose exactly one product.");
  // Explicitly look up existing ingredients: PostgREST upsert cannot infer
  // the partial unique indexes in this schema without their predicates.
  for (let attempt = 0; attempt < 5; attempt++) {
    const meal = await getMeal(input.mealId);
    const existing = meal.items.find((item) => input.product_barcode !== null
      ? item.product_barcode === input.product_barcode
      : item.generic_product_id === input.generic_product_id);
    if (existing) {
      const total = validateMealAmount(Number(existing.amount) + addition);
      const { data, error } = await supabase.from("meal_items").update({ amount: total })
        .eq("id", existing.id).eq("meal_id", input.mealId).eq("amount", existing.amount).select("id").maybeSingle();
      if (error) fail(error);
      if (data) return;
      continue;
    }
    if (meal.items.length >= MAX_MEAL_ITEMS) throw new Error("A meal can contain a maximum of 50 ingredients. You can still increase an existing ingredient.");
    const { error } = await supabase.from("meal_items").insert({
      meal_id: input.mealId, product_barcode: input.product_barcode,
      generic_product_id: input.generic_product_id, amount: addition,
    });
    if (error?.code === "23505") continue;
    if (error) fail(error);
    return;
  }
  throw new Error("This meal changed while adding the ingredient. Please try again.");
}

export async function updateMealItemAmount(mealId: string, itemId: number, amount: number) {
  validateMealId(mealId);
  const value = validateMealAmount(amount);
  await userId();
  const { error } = await supabase.from("meal_items").update({ amount: value })
    .eq("id", itemId).eq("meal_id", mealId).select("id").single();
  if (error) fail(error);
}

export async function removeMealItem(mealId: string, itemId: number) {
  validateMealId(mealId);
  await userId();
  const { error } = await supabase.from("meal_items").delete().eq("id", itemId).eq("meal_id", mealId);
  if (error) fail(error);
}
