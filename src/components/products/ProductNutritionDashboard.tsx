import { brand } from "@/components/brand/theme";
import { AppIcon } from "@/components/brand/AppIcon";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type {
  LookupProduct,
  MeasurementUnit,
} from "@/api/products/productLookup";

/*
 * Re-export these types to avoid breaking any other
 * existing imports while the product files are being
 * migrated to the shared lookup type.
 */
export type {
  LookupProduct as Product,
  MeasurementUnit,
} from "@/api/products/productLookup";

type NutrimentKey =
  keyof LookupProduct["nutriments"];

type ProductNutritionDashboardProps = {
  product: LookupProduct;
  myData?: string;

  onProductChange: (
    product: LookupProduct
  ) => void;
};

type ProductTextInputProps = {
  label: string;
  value: string;
  placeholder: string;
  numeric?: boolean;
  onChangeText: (value: string) => void;
};

type NutritionInputProps = {
  label: string;
  icon: keyof typeof AppIcon.glyphMap;
  value: string;
  unit: string;
  onChangeText: (value: string) => void;
};

/*
 * Allows only positive numeric text and one decimal
 * point.
 *
 * Validation of the final value remains in
 * productSubmission.ts and the database constraints.
 */
function cleanNumericInput(
  value: string
): string | null {
  const normalisedValue =
    value.replace(",", ".");

  if (
    normalisedValue === "" ||
    /^\d*\.?\d*$/.test(normalisedValue)
  ) {
    return normalisedValue;
  }

  return null;
}

const ProductTextInput = ({
  label,
  value,
  placeholder,
  numeric = false,
  onChangeText,
}: ProductTextInputProps) => {
  function handleChange(value: string) {
    if (!numeric) {
      onChangeText(value);
      return;
    }

    const cleanedValue =
      cleanNumericInput(value);

    if (cleanedValue !== null) {
      onChangeText(cleanedValue);
    }
  }

  return (
    <View style={styles.productField}>
      <View style={styles.productFieldHeader}>
        <Text style={styles.productFieldLabel}>
          {label}
        </Text>

        <AppIcon
          name="pencil-outline"
          size={14}
          color={brand.paleTeal}
        />
      </View>

      <TextInput
        style={styles.productTextInput}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={brand.muted}
        keyboardType={
          numeric
            ? "decimal-pad"
            : "default"
        }
      />
    </View>
  );
};

const NutritionInput = ({
  label,
  icon,
  value,
  unit,
  onChangeText,
}: NutritionInputProps) => {
  const missing = value === "";

  function handleChange(value: string) {
    const cleanedValue =
      cleanNumericInput(value);

    if (cleanedValue !== null) {
      onChangeText(cleanedValue);
    }
  }

  return (
    <View
      style={[
        styles.nutritionItem,

        missing &&
          styles.nutritionItemWarning,
      ]}
    >
      <View style={styles.nutritionHeader}>
        <View style={styles.nutritionIcon}>
          <AppIcon
            name={icon}
            size={19}
            color={brand.ink}
          />
        </View>

        <AppIcon
          name="pencil-outline"
          size={14}
          color={brand.muted}
        />
      </View>

      <Text style={styles.nutritionLabel}>
        {label}
      </Text>

      <View
        style={
          styles.nutritionInputContainer
        }
      >
        <TextInput
          style={styles.nutritionInput}
          value={value}
          onChangeText={handleChange}
          placeholder="Enter value"
          placeholderTextColor={brand.muted}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />

        <Text style={styles.unitText}>
          {unit}
        </Text>
      </View>
    </View>
  );
};

const ProductNutritionDashboard = ({
  product,
  myData,
  onProductChange,
}: ProductNutritionDashboardProps) => {
  const nutriments = product.nutriments;

  const measurementUnit =
    product.measurement_unit;

  function updateProductField(
    field:
      | "product_name"
      | "brands"
      | "product_amount",

    value: string
  ) {
    onProductChange({
      ...product,
      [field]: value,
    });
  }

  function updateMeasurementUnit(
    unit: MeasurementUnit
  ) {
    onProductChange({
      ...product,
      measurement_unit: unit,
    });
  }

  function updateNutriment(
    field: NutrimentKey,
    value: string
  ) {
    onProductChange({
      ...product,

      nutriments: {
        ...product.nutriments,
        [field]: value,
      },
    });
  }

  return (
    <View>
      <View style={styles.productCard}>
        <View style={styles.cardHeader}>
          <View style={styles.productIcon}>
            <AppIcon
              name="nutrition-outline"
              size={27}
              color={brand.surface}
            />
          </View>

          <View style={styles.editBadge}>
            <AppIcon
              name="create-outline"
              size={15}
              color={brand.surface}
            />

            <Text style={styles.editBadgeText}>
              Editable
            </Text>
          </View>
        </View>

        <Text style={styles.instructions}>
          Check the product information and
          correct any inaccurate values.
        </Text>

        <ProductTextInput
          label="Product name"
          value={product.product_name}
          placeholder="Enter product name"
          onChangeText={(value) =>
            updateProductField(
              "product_name",
              value
            )
          }
        />

        <ProductTextInput
          label="Brand"
          value={product.brands}
          placeholder="Enter brand"
          onChangeText={(value) =>
            updateProductField(
              "brands",
              value
            )
          }
        />

        <View style={styles.productField}>
          <Text style={styles.productFieldLabel}>
            Measurement unit
          </Text>

          <View style={styles.unitSelector}>
            <Pressable
              style={[
                styles.unitOption,

                measurementUnit === "g" &&
                  styles.unitOptionSelected,
              ]}
              onPress={() =>
                updateMeasurementUnit("g")
              }
            >
              <Text
                style={[
                  styles.unitOptionText,

                  measurementUnit === "g" &&
                    styles.unitOptionTextSelected,
                ]}
              >
                Grams (g)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.unitOption,

                measurementUnit === "ml" &&
                  styles.unitOptionSelected,
              ]}
              onPress={() =>
                updateMeasurementUnit("ml")
              }
            >
              <Text
                style={[
                  styles.unitOptionText,

                  measurementUnit === "ml" &&
                    styles.unitOptionTextSelected,
                ]}
              >
                Millilitres (ml)
              </Text>
            </Pressable>
          </View>
        </View>

        <ProductTextInput
          label={
            `Package amount ` +
            `(${measurementUnit})`
          }
          value={product.product_amount}
          placeholder={
            `Amount in ${measurementUnit}, ` +
            "e.g. 500"
          }
          numeric
          onChangeText={(value) =>
            updateProductField(
              "product_amount",
              value
            )
          }
        />

        <View style={styles.barcodeContainer}>
          <View style={styles.barcodeLabelRow}>
            <Text style={styles.barcodeLabel}>
              Barcode
            </Text>

            <View style={styles.lockedBadge}>
              <AppIcon
                name="lock-closed-outline"
                size={11}
                color={brand.paleTeal}
              />

              <Text style={styles.lockedText}>
                Locked
              </Text>
            </View>
          </View>

          <View style={styles.barcodeValue}>
            <AppIcon
              name="barcode-outline"
              size={20}
              color={brand.paleTeal}
            />

            <Text style={styles.barcodeText}>
              {myData || "Unavailable"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>
            Nutrition per 100
            {measurementUnit}
          </Text>

          <Text style={styles.sectionSubtitle}>
            Tap an input to change its value
          </Text>
        </View>

        <AppIcon
          name="pencil-outline"
          size={19}
          color={brand.muted}
        />
      </View>

      <View style={styles.nutritionGrid}>
        <NutritionInput
          label="Calories"
          icon="flame-outline"
          unit="kcal"
          value={
            nutriments.energy_kcal_100g
          }
          onChangeText={(value) =>
            updateNutriment(
              "energy_kcal_100g",
              value
            )
          }
        />

        <NutritionInput
          label="Protein"
          icon="barbell-outline"
          unit="g"
          value={
            nutriments.proteins_100g
          }
          onChangeText={(value) =>
            updateNutriment(
              "proteins_100g",
              value
            )
          }
        />

        <NutritionInput
          label="Carbohydrates"
          icon="restaurant-outline"
          unit="g"
          value={
            nutriments
              .carbohydrates_100g
          }
          onChangeText={(value) =>
            updateNutriment(
              "carbohydrates_100g",
              value
            )
          }
        />

        <NutritionInput
          label="Fat"
          icon="water-outline"
          unit="g"
          value={nutriments.fat_100g}
          onChangeText={(value) =>
            updateNutriment(
              "fat_100g",
              value
            )
          }
        />

        <NutritionInput
          label="Sugars"
          icon="cube-outline"
          unit="g"
          value={nutriments.sugars_100g}
          onChangeText={(value) =>
            updateNutriment(
              "sugars_100g",
              value
            )
          }
        />

        <NutritionInput
          label="Salt"
          icon="ellipse-outline"
          unit="g"
          value={nutriments.salt_100g}
          onChangeText={(value) =>
            updateNutriment(
              "salt_100g",
              value
            )
          }
        />

        <NutritionInput
          label="Fibre"
          icon="leaf-outline"
          unit="g"
          value={nutriments.fiber_100g}
          onChangeText={(value) =>
            updateNutriment(
              "fiber_100g",
              value
            )
          }
        />
      </View>
    </View>
  );
};

export default ProductNutritionDashboard;

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: brand.deepTeal,
    borderRadius: 20,
    padding: 22,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: brand.teal,
    justifyContent: "center",
    alignItems: "center",
  },

  editBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: brand.teal,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  editBadgeText: {
    color: brand.surface,
    fontSize: 12,
    fontWeight: "600",
  },

  instructions: {
    color: brand.paleTeal,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    marginBottom: 18,
  },

  productField: {
    marginTop: 13,
  },

  productFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },

  productFieldLabel: {
    color: brand.paleTeal,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 7,
  },

  productTextInput: {
    minHeight: 48,
    color: brand.ink,
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  unitSelector: {
    flexDirection: "row",
    gap: 10,
  },

  unitOption: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: brand.surface,
  },

  unitOptionSelected: {
    backgroundColor: brand.paleTeal,
    borderColor: brand.surface,
  },

  unitOptionText: {
    color: brand.deepTeal,
    fontSize: 13,
    fontWeight: "700",
  },

  unitOptionTextSelected: {
    color: brand.ink,
  },

  barcodeContainer: {
    borderTopWidth: 1,
    borderTopColor: brand.teal,
    marginTop: 20,
    paddingTop: 16,
  },

  barcodeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  barcodeLabel: {
    color: brand.paleTeal,
    fontSize: 12,
    fontWeight: "600",
  },

  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  lockedText: {
    color: brand.muted,
    fontSize: 11,
  },

  barcodeValue: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: brand.teal,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 7,
  },

  barcodeText: {
    color: brand.paleTeal,
    fontSize: 14,
  },

  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 14,
  },

  sectionTitle: {
    color: brand.ink,
    fontSize: 19,
    fontWeight: "700",
  },

  sectionSubtitle: {
    color: brand.muted,
    fontSize: 12,
    marginTop: 3,
  },

  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  nutritionItem: {
    width: "48%",
    minHeight: 145,
    backgroundColor: brand.surface,
    borderRadius: 18,
    padding: 15,
  },

  nutritionItemWarning: {
    backgroundColor: "#FFF3D6",
  },

  nutritionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  nutritionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: brand.paleTeal,
    justifyContent: "center",
    alignItems: "center",
  },

  nutritionLabel: {
    color: brand.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 11,
    marginBottom: 7,
  },

  nutritionInputContainer: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brand.background,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 10,
    paddingHorizontal: 10,
  },

  nutritionInput: {
    flex: 1,
    color: brand.ink,
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 8,
  },

  unitText: {
    color: brand.muted,
    fontSize: 12,
    marginLeft: 4,
  },
});