import {
  lookupLocalProduct,
} from "./localDatabase";

import { lookupOpenFoodFactsProduct } from "./openFoodFact";

import {
  LookupProduct,
  createEmptyProduct,
  isProductComplete,
  mergeMissingProductValues,
} from "./utils";

export type ProductLookupResult = {
  product: LookupProduct;
  found: boolean;
  hadLookupError: boolean;
};

/*
 * Looks for product information across the available
 * data sources.
 *
 * Source priority:
 *
 * 1. The shared product and user's own correction
 *    from Supabase.
 * 2. Open Food Facts.
 * 3. Additional APIs can be added later.
 *
 * A higher-priority source is never overwritten by a
 * lower-priority source.
 */
export async function lookupProduct(
  barcode: string
): Promise<ProductLookupResult> {
  const cleanedBarcode = barcode.trim();

  /*
   * A missing barcode cannot be queried.
   *
   * Return an empty editable product so the product
   * page always receives the expected object shape.
   */
  if (!cleanedBarcode) {
    return {
      product: createEmptyProduct(),
      found: false,
      hadLookupError: false,
    };
  }

  let product = createEmptyProduct();
  let found = false;
  let hadLookupError = false;

  /*
   * Check the local database first.
   *
   * localDatabase.ts already combines the shared
   * products row with the current user's correction.
   * The user's non-empty correction values have
   * priority over the shared values.
   */
  try {
    const localProduct =
      await lookupLocalProduct(
        cleanedBarcode
      );

    if (localProduct) {
      product = mergeMissingProductValues(
        product,
        localProduct
      );

      found = true;
    }
  } catch (error) {
    hadLookupError = true;

    console.error(
      "Could not retrieve the local product:",
      error
    );
  }

  /*
   * Open Food Facts is queried only when useful
   * fields remain empty.
   *
   * Any local values already found keep priority.
   * Open Food Facts can only fill missing fields.
   */
  if (!isProductComplete(product) || !product.image_url) {
    try {
      const openFoodFactsProduct =
        await lookupOpenFoodFactsProduct(
          cleanedBarcode
        );

      if (openFoodFactsProduct) {
        product = mergeMissingProductValues(
          product,
          openFoodFactsProduct
        );

        found = true;
      }
    } catch (error) {
      hadLookupError = true;

      console.error(
        "Could not retrieve the Open Food Facts product:",
        error
      );
    }
  }

  /*
   * When neither source finds the barcode, product
   * remains the empty editable product.
   *
   * The product page can therefore display the form
   * and allow the user to enter the information
   * manually.
   */
  return {
    product,
    found,
    hadLookupError,
  };
}

/*
 * Re-export the common product types so other files
 * can import them from the productLookup folder
 * without knowing which internal file defines them.
 */
export type {
  LookupProduct,
  MeasurementUnit,
} from "./utils";