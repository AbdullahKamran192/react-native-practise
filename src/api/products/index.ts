import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { addPantryAmount } from "./addPantryAmount";
import { validatePantryAddition } from "@/utils/pantryAmounts";

import type {
  ProductSubmission,
} from "@/utils/productSubmission";

export type MeasurementUnit =
  | "g"
  | "ml";

export type ProductRow = {
  image_url?: string | null;
  barcode_number: string;
  product_name: string | null;
  created_at: string;
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

export type GenericProductRow = {
  image_path?: string | null;
  id: number;
  product_name: string;
  created_at: string;
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

export type PantryItem = {
  id: number;
  user_id: string;
  created_at: string;
  amount_remaining: number;

  /*
   * Exactly one of these identifiers will contain
   * a value for each pantry row.
   */
  product_barcode: string | null;
  generic_product_id: number | null;

  /*
   * Exactly one of these related products will be
   * returned by the pantry query.
   */
  product: ProductRow | null;
  generic_product: GenericProductRow | null;
};

type ProductCorrectionRow = {
  image_url?: string | null;
  product_barcode: string;
  user_id: string;
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

export type AddProductToPantryResult = {
  barcode: string;
  amount_remaining: number;
  measurement_unit: MeasurementUnit;
  productWasCreated: boolean;
};

export type AddGenericProductToPantryInput = {
  genericProductId: number;
  amountToAdd?: number;
};

export type AddProductToPantryInput = ProductSubmission & { amountToAdd?: number };

export type AddGenericProductToPantryResult = {
  genericProductId: number;
  amount_remaining: number;
  measurement_unit: MeasurementUnit;
};

/*
 * Retrieves the shared barcode-product catalogue.
 */
export const useProductList = () => {
  return useQuery<ProductRow[]>({
    queryKey: ["products"],

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("products")
          .select("*")
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw new Error(error.message);
      }

      return data as ProductRow[];
    },
  });
};

/*
 * Retrieves the signed-in user's pantry rows.
 *
 * A pantry row may be connected to:
 *
 * - products through product_barcode, or
 * - generic_products through generic_product_id.
 *
 * One related product will contain an object and the
 * other will be null.
 */
export const usePantryList = () => {
  return useQuery<PantryItem[]>({
    queryKey: ["pantry", "amount-remaining"],

    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(
          userError.message
        );
      }

      if (!user) {
        throw new Error(
          "User is not signed in."
        );
      }

      const { data, error } =
        await supabase
          .from("pantry")
          .select(`
            id,
            created_at,
            user_id,
            product_barcode,
            generic_product_id,
            amount_remaining,
            product:products (
              *
            ),
            generic_product:generic_products (
              *
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as PantryItem[];
    },
  });
};

/*
 * Submits barcode-product information without changing pantry stock.
 * Shared by pantry entry and meal ingredient entry.
 *
 * The app does not write directly to products.
 * The submission is saved in product_corrections,
 * and the database trigger creates or updates the
 * shared products row.
 */
export async function saveBarcodeProduct(productSubmission: ProductSubmission) {
  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError) {
    throw new Error(
      userError.message
    );
  }

  if (!user) {
    throw new Error(
      "User is not signed in."
    );
  }

  const barcode =
    productSubmission
      .barcode_number
      .trim();

  /*
   * Check the shared unit before submitting corrections, and
   * report whether the trigger creates a new shared product.
   */
  const {
    data: existingProduct,
    error: productLookupError,
  } = await supabase
    .from("products")
    .select("barcode_number, measurement_unit")
    .eq(
      "barcode_number",
      barcode
    )
    .maybeSingle();

  if (productLookupError) {
    throw new Error(
      productLookupError.message
    );
  }

  if (existingProduct && existingProduct.measurement_unit !== productSubmission.measurement_unit) {
    throw new Error("The unit differs from the shared product. Reload the product before adding it; pantry amounts cannot be mixed between g and ml.");
  }

  const productWasCreated =
    existingProduct === null;

  /*
   * Retrieve the current user's previous
   * contribution for this barcode.
   *
   * Empty fields in a later submission should
   * not remove their existing non-null values.
   */
  const {
    data:
      existingCorrectionData,

    error:
      correctionLookupError,
  } = await supabase
    .from(
      "product_corrections"
    )
    .select(`
      product_barcode,
      image_url,
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
    .eq(
      "product_barcode",
      barcode
    )
    .maybeSingle();

  if (correctionLookupError) {
    throw new Error(
      correctionLookupError.message
    );
  }

  const existingCorrection =
    existingCorrectionData as
      | ProductCorrectionRow
      | null;

  const unitChanged =
    existingCorrection !== null &&
    existingCorrection
      .measurement_unit !==
      productSubmission
        .measurement_unit;

  /*
   * Preserve a previous numeric value when the
   * newly submitted value is null.
   *
   * If the unit changes, old values must not be
   * retained because a value per 100g cannot be
   * treated as a value per 100ml.
   */
  const previousValue = (
    value: number | null,
    existingValue:
      | number
      | null
      | undefined
  ) => {
    if (value !== null) {
      return value;
    }

    if (unitChanged) {
      return null;
    }

    return (
      existingValue ?? null
    );
  };

  const correctionToSave:
    ProductCorrectionRow = {
    image_url: productSubmission.image_url ?? existingCorrection?.image_url ?? null,
    user_id: user.id,
    product_barcode:
      barcode,

    product_name:
      productSubmission
        .product_name ??
      existingCorrection
        ?.product_name ??
      null,

    measurement_unit:
      productSubmission
        .measurement_unit,

    product_amount:
      previousValue(
        productSubmission
          .product_amount,

        existingCorrection
          ?.product_amount
      ),

    calories_per_100:
      previousValue(
        productSubmission
          .calories_per_100,

        existingCorrection
          ?.calories_per_100
      ),

    protein_per_100:
      previousValue(
        productSubmission
          .protein_per_100,

        existingCorrection
          ?.protein_per_100
      ),

    carbs_per_100:
      previousValue(
        productSubmission
          .carbs_per_100,

        existingCorrection
          ?.carbs_per_100
      ),

    fat_per_100:
      previousValue(
        productSubmission
          .fat_per_100,

        existingCorrection
          ?.fat_per_100
      ),

    sugars_per_100:
      previousValue(
        productSubmission
          .sugars_per_100,

        existingCorrection
          ?.sugars_per_100
      ),

    salt_per_100:
      previousValue(
        productSubmission
          .salt_per_100,

        existingCorrection
          ?.salt_per_100
      ),

    fibre_per_100:
      previousValue(
        productSubmission
          .fibre_per_100,

        existingCorrection
          ?.fibre_per_100
      ),
  };

  /*
   * product_corrections still uses:
   *
   * user_id + product_barcode
   *
   * as its composite primary key.
   */
  const {
    error:
      correctionUpsertError,
  } = await supabase
    .from(
      "product_corrections"
    )
    .upsert(
      correctionToSave,
      {
        onConflict:
          "user_id,product_barcode",
      }
    );

  if (correctionUpsertError) {
    throw new Error(
      correctionUpsertError.message
    );
  }

  // The trigger may choose a different unit from other users' corrections.
  const { data: sharedProduct, error: sharedError } = await supabase
    .from("products")
    .select("measurement_unit")
    .eq("barcode_number", barcode)
    .single();
  if (sharedError) throw new Error(sharedError.message);
  if (sharedProduct.measurement_unit !== productSubmission.measurement_unit) {
    throw new Error("The shared product unit changed. Reload the product before adding it to your pantry.");
  }

  return { userId: user.id, barcode, productWasCreated };
}

export const useAddProductToPantry =
  () => {
    const queryClient =
      useQueryClient();

    return useMutation<
      AddProductToPantryResult,
      Error,
      AddProductToPantryInput
    >({
      mutationFn: async (
        productSubmission
      ) => {
        const amountToAdd = validatePantryAddition(
          productSubmission.amountToAdd ?? Number(productSubmission.product_amount)
        );
        const { userId, barcode, productWasCreated } = await saveBarcodeProduct(productSubmission);

        const amountRemaining = await addPantryAmount(
          userId,
          { product_barcode: barcode, generic_product_id: null },
          amountToAdd
        );

        return {
          barcode,
          amount_remaining: amountRemaining,
          measurement_unit: productSubmission.measurement_unit,
          productWasCreated,
        };
      },

      onSuccess: async () => {
        await Promise.all([
          queryClient
            .invalidateQueries({
              queryKey: [
                "pantry",
              ],
            }),

          queryClient
            .invalidateQueries({
              queryKey: [
                "products",
              ],
            }),
        ]);
      },
    });
  };

/*
 * Adds a curated generic product to the signed-in
 * user's pantry.
 *
 * Generic products do not use product_corrections
 * because generic_products is currently maintained
 * as a curated, read-only catalogue.
 */
export const useAddGenericProductToPantry =
  () => {
    const queryClient =
      useQueryClient();

    return useMutation<
      AddGenericProductToPantryResult,
      Error,
      AddGenericProductToPantryInput
    >({
      mutationFn: async ({
        genericProductId,
        amountToAdd,
      }) => {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError) {
          throw new Error(
            userError.message
          );
        }

        if (!user) {
          throw new Error(
            "User is not signed in."
          );
        }

        /*
         * Confirm that the selected generic product
         * exists before creating a pantry row.
         */
        const {
          data: genericProduct,
          error:
            genericProductError,
        } = await supabase
          .from(
            "generic_products"
          )
          .select("id, default_amount, measurement_unit")
          .eq(
            "id",
            genericProductId
          )
          .maybeSingle();

        if (genericProductError) {
          throw new Error(
            genericProductError.message
          );
        }

        if (!genericProduct) {
          throw new Error(
            "The generic product could not be found."
          );
        }

        const amountRemaining = await addPantryAmount(
          user.id,
          { product_barcode: null, generic_product_id: genericProductId },
          amountToAdd ?? Number(genericProduct.default_amount)
        );

        return {
          genericProductId,
          amount_remaining: amountRemaining,
          measurement_unit: genericProduct.measurement_unit as MeasurementUnit,
        };
      },

      onSuccess: async () => {
        await queryClient
          .invalidateQueries({
            queryKey: ["pantry"],
          });
      },
    });
  };
