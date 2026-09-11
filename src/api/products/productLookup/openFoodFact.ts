import {
  LookupProduct,
  createEmptyProduct,
  normalisePackageAmount,
  normaliseQuantityText,
  toEditableValue,
} from "./utils";

/*
 * Open Food Facts uses its own response structure and
 * field names.
 *
 * These types describe only the fields required by
 * our application. We do not need to represent the
 * entire Open Food Facts response.
 */
type OpenFoodFactsNutriments = {
  energy_kcal_100g?: unknown;
  proteins_100g?: unknown;
  carbohydrates_100g?: unknown;
  fat_100g?: unknown;
  sugars_100g?: unknown;
  salt_100g?: unknown;
  fiber_100g?: unknown;
};

type OpenFoodFactsProduct = {
  product_name?: unknown;
  brands?: unknown;

  /*
   * Open Food Facts may provide structured package
   * information using these two fields.
   */
  product_quantity?: unknown;
  product_quantity_unit?: unknown;

  /*
   * Some products only contain a package description,
   * such as "500 g" or "1 L".
   */
  quantity?: unknown;

  nutriments?: OpenFoodFactsNutriments;
};

type OpenFoodFactsResponse = {
  status?: number;
  product?: OpenFoodFactsProduct;
};

/*
 * Converts the Open Food Facts product into the
 * common product shape used by our application.
 *
 * After this function runs, the rest of the app does
 * not need to understand Open Food Facts field names.
 */
function mapOpenFoodFactsProduct(
  product: OpenFoodFactsProduct
): LookupProduct {
  const emptyProduct =
    createEmptyProduct();

  /*
   * Prefer the structured package amount and unit.
   *
   * If they are unavailable, use the simple quantity
   * description as a fallback.
   */
  const packageDetails =
    normalisePackageAmount(
      product.product_quantity as
        | string
        | number
        | null
        | undefined,

      typeof product.product_quantity_unit ===
        "string"
        ? product.product_quantity_unit
        : null
    ) ??
    normaliseQuantityText(product.quantity);

  const nutriments =
    product.nutriments ?? {};

  return {
    product_name:
      toEditableValue(product.product_name),

    brands:
      toEditableValue(product.brands),

    product_amount:
      packageDetails?.amount ?? "",

    /*
     * When no package unit is available, the form
     * starts with grams selected. The user can change
     * it to millilitres before submitting.
     */
    measurement_unit:
      packageDetails?.unit ??
      emptyProduct.measurement_unit,

    nutriments: {
      energy_kcal_100g:
        toEditableValue(
          nutriments.energy_kcal_100g
        ),

      proteins_100g:
        toEditableValue(
          nutriments.proteins_100g
        ),

      carbohydrates_100g:
        toEditableValue(
          nutriments.carbohydrates_100g
        ),

      fat_100g:
        toEditableValue(
          nutriments.fat_100g
        ),

      sugars_100g:
        toEditableValue(
          nutriments.sugars_100g
        ),

      salt_100g:
        toEditableValue(
          nutriments.salt_100g
        ),

      fiber_100g:
        toEditableValue(
          nutriments.fiber_100g
        ),
    },
  };
}

/*
 * Searches Open Food Facts for the supplied barcode.
 *
 * A successful HTTP response does not necessarily
 * mean that the product exists. Open Food Facts uses
 * status 1 when the barcode was found.
 */
export async function lookupOpenFoodFactsProduct(
  barcode: string
): Promise<LookupProduct | null> {
  const cleanedBarcode = barcode.trim();

  if (!cleanedBarcode) {
    return null;
  }

  /*
   * Request only the fields used by the application.
   * This avoids downloading the much larger complete
   * Open Food Facts product object.
   */
  const requestedFields = [
    "product_name",
    "brands",
    "product_quantity",
    "product_quantity_unit",
    "quantity",
    "nutriments",
  ].join(",");

  const url =
    "https://world.openfoodfacts.org" +
    `/api/v2/product/${encodeURIComponent(
      cleanedBarcode
    )}.json` +
    `?fields=${requestedFields}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Open Food Facts request failed with " +
        `status ${response.status}.`
    );
  }

  const data =
    (await response.json()) as
      OpenFoodFactsResponse;

  /*
   * Returning null tells the main lookup coordinator
   * that this source did not contain the product.
   *
   * The coordinator can then try another source or
   * return an empty editable product.
   */
  if (
    data.status !== 1 ||
    !data.product
  ) {
    return null;
  }

  return mapOpenFoodFactsProduct(
    data.product
  );
}