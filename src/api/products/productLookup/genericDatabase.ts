import { supabase } from "@/lib/supabase";

import type {
  LookupProduct,
  MeasurementUnit,
} from "./utils";

import {
  toEditableValue,
} from "./utils";

type GenericProductRow = {
  id: number;
  product_name: string;
  default_amount: number;
  measurement_unit: MeasurementUnit;
  calories_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  sugars_per_100: number | null;
  salt_per_100: number | null;
  fibre_per_100: number | null;
};

/*
 * Retrieves one curated generic product using its
 * generated database ID.
 *
 * Generic products are ordinary foods or drinks
 * without barcodes, such as an apple, egg or glass
 * of milk.
 */
export async function lookupGenericProduct(
  genericProductId: string | number
): Promise<LookupProduct | null> {
  const parsedProductId =
    Number(genericProductId);

  /*
   * Avoid sending an invalid ID to Supabase.
   */
  if (
    !Number.isInteger(parsedProductId) ||
    parsedProductId <= 0
  ) {
    return null;
  }

  const { data, error } =
    await supabase
      .from("generic_products")
      .select(`
        id,
        product_name,
        default_amount,
        measurement_unit,
        calories_per_100,
        protein_per_100,
        carbs_per_100,
        fat_per_100,
        sugars_per_100,
        salt_per_100,
        fibre_per_100
      `)
      .eq("id", parsedProductId)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const product =
    data as GenericProductRow;

  /*
   * Convert the database row into LookupProduct.
   *
   * This gives generic and barcode products the same
   * structure before they reach the product screen.
   *
   * The nutrition property names still contain
   * "_100g" for compatibility with the existing
   * nutrition form. measurement_unit determines
   * whether the values are actually per 100g or
   * per 100ml.
   */
  return {
    product_name:
      product.product_name,

    /*
     * Generic products do not currently have brands.
     */
    brands: "",

    product_amount:
      toEditableValue(
        product.default_amount
      ),

    measurement_unit:
      product.measurement_unit,

    nutriments: {
      energy_kcal_100g:
        toEditableValue(
          product.calories_per_100
        ),

      proteins_100g:
        toEditableValue(
          product.protein_per_100
        ),

      carbohydrates_100g:
        toEditableValue(
          product.carbs_per_100
        ),

      fat_100g:
        toEditableValue(
          product.fat_per_100
        ),

      sugars_100g:
        toEditableValue(
          product.sugars_per_100
        ),

      salt_100g:
        toEditableValue(
          product.salt_per_100
        ),

      fiber_100g:
        toEditableValue(
          product.fibre_per_100
        ),
    },
  };
}