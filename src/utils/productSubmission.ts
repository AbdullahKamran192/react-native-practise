import { normaliseImageUrl } from "./productImage";
export type MeasurementUnit = "g" | "ml";

export type EditableValue =
  | string
  | number
  | null
  | undefined;

export type EditableProduct = {
  image_url?: string | null;
  product_name?: string | null;

  /*
   * Numeric package amount expressed in either
   * grams or millilitres.
   */
  product_amount?: EditableValue;

  measurement_unit?: MeasurementUnit;

  nutriments?: {
    energy_kcal_100g?: EditableValue;
    proteins_100g?: EditableValue;
    carbohydrates_100g?: EditableValue;
    fat_100g?: EditableValue;
    sugars_100g?: EditableValue;
    salt_100g?: EditableValue;
    fiber_100g?: EditableValue;
  };
};

export type ProductSubmission = {
  image_url?: string | null;
  barcode_number: string;
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

export type ProductSubmissionResult =
  | {
      success: true;
      data: ProductSubmission;
    }
  | {
      success: false;
      error: string;
    };

type NumberResult =
  | {
      success: true;
      value: number | null;
    }
  | {
      success: false;
      error: string;
    };

/*
 * Converts an editable form value into a database
 * number.
 *
 * Empty values become null. Numeric zero remains a
 * valid value.
 */
function parseNumber(
  value: EditableValue,
  label: string,
  maximum?: number
): NumberResult {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return {
      success: true,
      value: null,
    };
  }

  const convertedValue = Number(
    String(value).trim().replace(",", ".")
  );

  if (!Number.isFinite(convertedValue)) {
    return {
      success: false,
      error: `${label} must be a valid number.`,
    };
  }

  if (convertedValue < 0) {
    return {
      success: false,
      error: `${label} cannot be negative.`,
    };
  }

  if (
    maximum !== undefined &&
    convertedValue > maximum
  ) {
    return {
      success: false,
      error:
        `${label} cannot be higher than ` +
        `${maximum}.`,
    };
  }

  return {
    success: true,
    value: convertedValue,
  };
}

/*
 * Checks that the scanned barcode contains only
 * digits and uses one of the supported lengths.
 */
function validateBarcode(
  barcode: string
): string | null {
  const cleanedBarcode = barcode.trim();

  if (!cleanedBarcode) {
    return "The product barcode is missing.";
  }

  if (!/^\d+$/.test(cleanedBarcode)) {
    return "The barcode must contain numbers only.";
  }

  const supportedLengths = [
    8,
    12,
    13,
    14,
  ];

  if (
    !supportedLengths.includes(
      cleanedBarcode.length
    )
  ) {
    return (
      "The barcode must contain 8, 12, 13, " +
      "or 14 digits."
    );
  }

  return null;
}

/*
 * Converts and validates the editable product before
 * it is sent to useAddProductToPantry().
 *
 * Lookup-source validation prepares data for the
 * form. This function performs the final validation
 * after the user has reviewed or changed the values.
 */
export function createProductSubmission(
  barcode: string,
  product: EditableProduct
): ProductSubmissionResult {
  const barcodeError =
    validateBarcode(barcode);

  if (barcodeError) {
    return {
      success: false,
      error: barcodeError,
    };
  }

  const measurementUnit =
    product.measurement_unit;

  if (
    measurementUnit !== "g" &&
    measurementUnit !== "ml"
  ) {
    return {
      success: false,
      error:
        "Select grams or millilitres for the product.",
    };
  }

  /*
   * product_amount is the numeric package amount
   * edited by ProductNutritionDashboard.
   *
   * It replaces the old product.quantity field.
   */
  const productAmount = parseNumber(
    product.product_amount,
    `Package amount in ${measurementUnit}`,
    100000
  );

  if (!productAmount.success) {
    return productAmount;
  }

  if (
    productAmount.value !== null &&
    productAmount.value <= 0
  ) {
    return {
      success: false,
      error:
        `Package amount must be greater than ` +
        `0${measurementUnit}.`,
    };
  }

  const nutriments =
    product.nutriments ?? {};

  const calories = parseNumber(
    nutriments.energy_kcal_100g,
    `Calories per 100${measurementUnit}`,
    1000
  );

  if (!calories.success) {
    return calories;
  }

  const protein = parseNumber(
    nutriments.proteins_100g,
    `Protein per 100${measurementUnit}`,
    100
  );

  if (!protein.success) {
    return protein;
  }

  const carbs = parseNumber(
    nutriments.carbohydrates_100g,
    `Carbohydrates per 100${measurementUnit}`,
    100
  );

  if (!carbs.success) {
    return carbs;
  }

  const fat = parseNumber(
    nutriments.fat_100g,
    `Fat per 100${measurementUnit}`,
    100
  );

  if (!fat.success) {
    return fat;
  }

  const sugars = parseNumber(
    nutriments.sugars_100g,
    `Sugars per 100${measurementUnit}`,
    100
  );

  if (!sugars.success) {
    return sugars;
  }

  const salt = parseNumber(
    nutriments.salt_100g,
    `Salt per 100${measurementUnit}`,
    100
  );

  if (!salt.success) {
    return salt;
  }

  const fibre = parseNumber(
    nutriments.fiber_100g,
    `Fibre per 100${measurementUnit}`,
    100
  );

  if (!fibre.success) {
    return fibre;
  }

  return {
    success: true,

    data: {
      /*
       * Keep the barcode as text so any leading zero
       * is preserved.
       */
      barcode_number: barcode.trim(),
      image_url: normaliseImageUrl(product.image_url),

      product_name:
        product.product_name?.trim() ||
        null,

      product_amount:
        productAmount.value,

      measurement_unit:
        measurementUnit,

      calories_per_100:
        calories.value,

      protein_per_100:
        protein.value,

      carbs_per_100:
        carbs.value,

      fat_per_100:
        fat.value,

      sugars_per_100:
        sugars.value,

      salt_per_100:
        salt.value,

      fibre_per_100:
        fibre.value,
    },
  };
}