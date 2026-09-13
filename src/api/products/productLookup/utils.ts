export type MeasurementUnit = "g" | "ml";

export type EditableValue =
  | string
  | number
  | null
  | undefined;

export type LookupProduct = {
  image_url?: string | null;
  product_name: string;
  brands: string;
  product_amount: string;
  measurement_unit: MeasurementUnit;

  /*
   * These names match the current editable form.
   *
   * The measurement_unit determines whether the
   * values mean per 100g or per 100ml.
   */
  nutriments: {
    energy_kcal_100g: string;
    proteins_100g: string;
    carbohydrates_100g: string;
    fat_100g: string;
    sugars_100g: string;
    salt_100g: string;
    fiber_100g: string;
  };
};

export type PackageDetails = {
  amount: string;
  unit: MeasurementUnit;
};

/*
 * Creates the empty product displayed when none of
 * the lookup sources provide information.
 */
export function createEmptyProduct(): LookupProduct {
  return {
    image_url: null,
    product_name: "",
    brands: "",
    product_amount: "",
    measurement_unit: "g",

    nutriments: {
      energy_kcal_100g: "",
      proteins_100g: "",
      carbohydrates_100g: "",
      fat_100g: "",
      sugars_100g: "",
      salt_100g: "",
      fiber_100g: "",
    },
  };
}

/*
 * Converts an unknown API or database value into a
 * string that can be displayed in a TextInput.
 *
 * Null, undefined and invalid types become an empty
 * string.
 */
export function toEditableValue(
  value: unknown
): string {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

/*
 * Converts a string or number into a number.
 *
 * Empty and invalid values become null. Decimal
 * commas are accepted and converted to decimal
 * points.
 */
export function toNumber(
  value: EditableValue
): number | null {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const convertedValue = Number(
    String(value).trim().replace(",", ".")
  );

  return Number.isFinite(convertedValue)
    ? convertedValue
    : null;
}

/*
 * Converts an amount and unit into the application's
 * supported grams or millilitres format.
 *
 * Examples:
 *
 * 1 kg  -> 1000 g
 * 1 l   -> 1000 ml
 * 50 cl -> 500 ml
 */
export function normalisePackageAmount(
  value: EditableValue,
  unit: string | null | undefined
): PackageDetails | null {
  const amount = toNumber(value);

  if (
    amount === null ||
    amount <= 0 ||
    !unit
  ) {
    return null;
  }

  const cleanedUnit = unit
    .trim()
    .toLowerCase();

  if (
    cleanedUnit === "g" ||
    cleanedUnit === "gram" ||
    cleanedUnit === "grams"
  ) {
    return {
      amount: String(amount),
      unit: "g",
    };
  }

  if (
    cleanedUnit === "kg" ||
    cleanedUnit === "kilogram" ||
    cleanedUnit === "kilograms"
  ) {
    return {
      amount: String(amount * 1000),
      unit: "g",
    };
  }

  if (
    cleanedUnit === "ml" ||
    cleanedUnit === "millilitre" ||
    cleanedUnit === "millilitres"
  ) {
    return {
      amount: String(amount),
      unit: "ml",
    };
  }

  if (
    cleanedUnit === "l" ||
    cleanedUnit === "litre" ||
    cleanedUnit === "litres"
  ) {
    return {
      amount: String(amount * 1000),
      unit: "ml",
    };
  }

  if (
    cleanedUnit === "cl" ||
    cleanedUnit === "centilitre" ||
    cleanedUnit === "centilitres"
  ) {
    return {
      amount: String(amount * 10),
      unit: "ml",
    };
  }

  return null;
}

/*
 * Handles a simple package description when an API
 * does not provide separate amount and unit fields.
 *
 * Supported examples:
 *
 * "500 g"
 * "1 kg"
 * "330 ml"
 * "50 cl"
 * "1 l"
 *
 * More complicated package descriptions are left
 * empty so the user can correct them manually.
 */
export function normaliseQuantityText(
  quantity: unknown
): PackageDetails | null {
  if (typeof quantity !== "string") {
    return null;
  }

  const match = quantity
    .trim()
    .toLowerCase()
    .replace(",", ".")
    .match(
      /^(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/
    );

  if (!match) {
    return null;
  }

  return normalisePackageAmount(
    match[1],
    match[2]
  );
}

/*
 * Checks whether a form value is empty.
 *
 * Numeric zero is represented as "0" and is
 * therefore not considered empty.
 */
function isEmpty(value: string): boolean {
  return value.trim() === "";
}

/*
 * Determines whether a product already contains
 * package or nutrition information.
 *
 * The default "g" selection does not count as
 * product information by itself.
 */
function hasMeasurementData(
  product: LookupProduct
): boolean {
  return (
    !isEmpty(product.product_amount) ||
    Object.values(product.nutriments).some(
      value => !isEmpty(value)
    )
  );
}

/*
 * Checks whether every useful product field has
 * received a value.
 *
 * The lookup coordinator uses this after each source.
 * If any field remains empty, it can try the next
 * available source.
 */
export function isProductComplete(
  product: LookupProduct
): boolean {
  return (
    !isEmpty(product.product_name) &&
    !isEmpty(product.brands) &&
    !isEmpty(product.product_amount) &&
    Object.values(product.nutriments).every(
      value => !isEmpty(value)
    )
  );
}

/*
 * Adds incoming information only to fields that are
 * still empty.
 *
 * The current product has priority. This means the
 * function never overwrites a value already supplied
 * by a higher-priority source.
 *
 * Nutrition from gram and millilitre sources is
 * never combined.
 */
export function mergeMissingProductValues(
  current: LookupProduct,
  incoming: LookupProduct | null
): LookupProduct {
  if (!incoming) {
    return current;
  }

  const currentHasMeasurementData =
    hasMeasurementData(current);

  const unitsMatch =
    !currentHasMeasurementData ||
    current.measurement_unit ===
      incoming.measurement_unit;

  return {
    image_url: current.image_url || incoming.image_url || null,
    product_name:
      current.product_name ||
      incoming.product_name,

    brands:
      current.brands ||
      incoming.brands,

    product_amount:
      unitsMatch
        ? current.product_amount ||
          incoming.product_amount
        : current.product_amount,

    measurement_unit:
      currentHasMeasurementData
        ? current.measurement_unit
        : incoming.measurement_unit,

    nutriments: {
      energy_kcal_100g:
        unitsMatch
          ? current.nutriments
              .energy_kcal_100g ||
            incoming.nutriments
              .energy_kcal_100g
          : current.nutriments
              .energy_kcal_100g,

      proteins_100g:
        unitsMatch
          ? current.nutriments
              .proteins_100g ||
            incoming.nutriments
              .proteins_100g
          : current.nutriments
              .proteins_100g,

      carbohydrates_100g:
        unitsMatch
          ? current.nutriments
              .carbohydrates_100g ||
            incoming.nutriments
              .carbohydrates_100g
          : current.nutriments
              .carbohydrates_100g,

      fat_100g:
        unitsMatch
          ? current.nutriments
              .fat_100g ||
            incoming.nutriments
              .fat_100g
          : current.nutriments
              .fat_100g,

      sugars_100g:
        unitsMatch
          ? current.nutriments
              .sugars_100g ||
            incoming.nutriments
              .sugars_100g
          : current.nutriments
              .sugars_100g,

      salt_100g:
        unitsMatch
          ? current.nutriments
              .salt_100g ||
            incoming.nutriments
              .salt_100g
          : current.nutriments
              .salt_100g,

      fiber_100g:
        unitsMatch
          ? current.nutriments
              .fiber_100g ||
            incoming.nutriments
              .fiber_100g
          : current.nutriments
              .fiber_100g,
    },
  };
}