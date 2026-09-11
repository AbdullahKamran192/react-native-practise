import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import type {
  ProductSubmission,
} from "@/utils/productSubmission";

export type MeasurementUnit =
  | "g"
  | "ml";

export type ProductRow = {
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
  quantity: number;

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
  quantity: number;
  productWasCreated: boolean;
};

export type AddGenericProductToPantryInput = {
  genericProductId: number;
};

export type AddGenericProductToPantryResult = {
  genericProductId: number;
  quantity: number;
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
    queryKey: ["pantry"],

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
            quantity,
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
 * Submits barcode-product information and adds the
 * product to the signed-in user's pantry.
 *
 * The app does not write directly to products.
 * The submission is saved in product_corrections,
 * and the database trigger creates or updates the
 * shared products row.
 */
export const useAddProductToPantry =
  () => {
    const queryClient =
      useQueryClient();

    return useMutation<
      AddProductToPantryResult,
      Error,
      ProductSubmission
    >({
      mutationFn: async (
        productSubmission
      ) => {
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
         * This lookup is used only to report whether
         * the database trigger created a new shared
         * product.
         */
        const {
          data: existingProduct,
          error: productLookupError,
        } = await supabase
          .from("products")
          .select("barcode_number")
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

        /*
         * The product-corrections trigger has now
         * created or updated the matching products
         * row, so it is safe to add the pantry row.
         */
        const {
          data: existingPantryItem,
          error:
            pantryLookupError,
        } = await supabase
          .from("pantry")
          .select("quantity")
          .eq("user_id", user.id)
          .eq(
            "product_barcode",
            barcode
          )
          .maybeSingle();

        if (pantryLookupError) {
          throw new Error(
            pantryLookupError.message
          );
        }

        const newQuantity =
          Number(
            existingPantryItem
              ?.quantity ?? 0
          ) + 1;

        /*
         * Setting generic_product_id to null makes
         * the selected product type explicit and
         * satisfies the pantry CHECK constraint.
         */
        const {
          error: pantryUpsertError,
        } = await supabase
          .from("pantry")
          .upsert(
            {
              user_id: user.id,
              product_barcode:
                barcode,

              generic_product_id:
                null,

              quantity:
                newQuantity,
            },
            {
              onConflict:
                "user_id,product_barcode",
            }
          );

        if (pantryUpsertError) {
          throw new Error(
            pantryUpsertError.message
          );
        }

        return {
          barcode,
          quantity: newQuantity,
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
          .select("id")
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

        /*
         * Find the user's existing pantry row so its
         * quantity can be increased.
         */
        const {
          data: existingPantryItem,
          error:
            pantryLookupError,
        } = await supabase
          .from("pantry")
          .select("quantity")
          .eq("user_id", user.id)
          .eq(
            "generic_product_id",
            genericProductId
          )
          .maybeSingle();

        if (pantryLookupError) {
          throw new Error(
            pantryLookupError.message
          );
        }

        const newQuantity =
          Number(
            existingPantryItem
              ?.quantity ?? 0
          ) + 1;

        /*
         * product_barcode must be null for a generic
         * product pantry row.
         */
        const {
          error: pantryUpsertError,
        } = await supabase
          .from("pantry")
          .upsert(
            {
              user_id: user.id,

              product_barcode:
                null,

              generic_product_id:
                genericProductId,

              quantity:
                newQuantity,
            },
            {
              onConflict:
                "user_id,generic_product_id",
            }
          );

        if (pantryUpsertError) {
          throw new Error(
            pantryUpsertError.message
          );
        }

        return {
          genericProductId,
          quantity: newQuantity,
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