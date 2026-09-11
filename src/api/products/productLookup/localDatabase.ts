import { supabase } from "@/lib/supabase";

import {
  LookupProduct,
  MeasurementUnit,
  createEmptyProduct,
  mergeMissingProductValues,
  toEditableValue,
} from "./utils";

/*
 * These are the database fields shared by products
 * and product_corrections.
 *
 * Barcode and user identification fields are not
 * included because they are not needed by the
 * editable product form.
 */
type DatabaseProductValues = {
  product_name: string | null;
  product_amount: number | null;
  measurement_unit: MeasurementUnit;
  calories_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  sugars_per_100: number | null;
  salt_per_100: number | null;
  fibre_per_100: number | null;
};

type SharedProductRow =
  DatabaseProductValues & {
    barcode_number: string;
  };

type ProductCorrectionRow =
  DatabaseProductValues & {
    product_barcode: string;
    user_id: string;
  };

/*
 * Converts a products or product_corrections row
 * into the common product shape used by the form.
 *
 * Database numbers become strings because React
 * Native TextInput values are edited as strings.
 */
function mapDatabaseProduct(
  product: DatabaseProductValues
): LookupProduct {
  return {
    product_name:
      toEditableValue(product.product_name),

    /*
     * Brands are not currently stored in either
     * database table.
     */
    brands: "",

    product_amount:
      toEditableValue(product.product_amount),

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

/*
 * Retrieves the aggregated product visible to all
 * users from the shared products table.
 *
 * This table is read-only for normal users. Its rows
 * are created and updated by the database trigger.
 */
async function getSharedProduct(
  barcode: string
): Promise<LookupProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      barcode_number,
      product_name,
      product_amount,
      measurement_unit,
      calories_per_100,
      protein_per_100,
      carbs_per_100,
      fat_per_100,
      sugars_per_100,
      salt_per_100,
      fibre_per_100
    `)
    .eq("barcode_number", barcode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const sharedProduct =
    data as SharedProductRow;

  return mapDatabaseProduct(
    sharedProduct
  );
}

/*
 * Retrieves only the signed-in user's contribution
 * for this barcode.
 *
 * Row Level Security ensures the user cannot read
 * another user's individual correction.
 */
async function getUserCorrection(
  barcode: string
): Promise<LookupProduct | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  /*
   * An unauthenticated user has no personal
   * correction, but the shared product lookup can
   * still be used.
   */
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("product_corrections")
    .select(`
      product_barcode,
      user_id,
      product_name,
      product_amount,
      measurement_unit,
      calories_per_100,
      protein_per_100,
      carbs_per_100,
      fat_per_100,
      sugars_per_100,
      salt_per_100,
      fibre_per_100
    `)
    .eq("user_id", user.id)
    .eq("product_barcode", barcode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const correction =
    data as ProductCorrectionRow;

  return mapDatabaseProduct(correction);
}

/*
 * Loads the shared product and the current user's
 * correction concurrently.
 *
 * Running them concurrently avoids waiting for one
 * complete database request before beginning the
 * other.
 */
export async function lookupLocalProduct(
  barcode: string
): Promise<LookupProduct | null> {
  const cleanedBarcode = barcode.trim();

  if (!cleanedBarcode) {
    return null;
  }

  const [
    sharedProduct,
    userCorrection,
  ] = await Promise.all([
    getSharedProduct(cleanedBarcode),
    getUserCorrection(cleanedBarcode),
  ]);

  /*
   * If neither database table contains information,
   * the next lookup source can be attempted.
   */
  if (!sharedProduct && !userCorrection) {
    return null;
  }

  /*
   * When there is no personal correction, return the
   * shared product without performing a merge.
   */
  if (!userCorrection) {
    return sharedProduct;
  }

  /*
   * The personal correction is used as the starting
   * object, giving its non-empty values priority.
   *
   * Shared product values fill fields that the user
   * left empty.
   */
  return mergeMissingProductValues(
    userCorrection,
    sharedProduct ?? createEmptyProduct()
  );
}