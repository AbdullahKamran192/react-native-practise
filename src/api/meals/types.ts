import type { ProductRow, GenericProductRow } from "@/api/products";

export type Meal = {
  image_path?: string | null;
  id: number;
  user_id: string;
  meal_name: string;
  description: string | null;
  instructions: string | null;
  created_at: string;
  updated_at: string;
};

export type MealItem = {
  id: number;
  meal_id: number;
  product_barcode: string | null;
  generic_product_id: number | null;
  amount: number;
  created_at: string;
  updated_at: string;
  product: ProductRow | null;
  generic_product: GenericProductRow | null;
};

export type MealWithItems = Meal & { items: MealItem[] };
export type MealInput = Pick<Meal, "meal_name" | "description" | "instructions">;
export type MealProduct =
  | { product_barcode: string; generic_product_id: null }
  | { product_barcode: null; generic_product_id: number };
export type AddMealItemInput = MealProduct & { mealId: string; amount: number };
