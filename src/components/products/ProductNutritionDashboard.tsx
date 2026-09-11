import { Ionicons } from "@expo/vector-icons";
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
  icon: keyof typeof Ionicons.glyphMap;
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

        <Ionicons
          name="pencil-outline"
          size={14}
          color="#BDBDBD"
        />
      </View>

      <TextInput
        style={styles.productTextInput}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor="#888"
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
          <Ionicons
            name={icon}
            size={19}
            color="#222"
          />
        </View>

        <Ionicons
          name="pencil-outline"
          size={14}
          color="#888"
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
          placeholderTextColor="#999"
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
            <Ionicons
              name="nutrition-outline"
              size={27}
              color="#fff"
            />
          </View>

          <View style={styles.editBadge}>
            <Ionicons
              name="create-outline"
              size={15}
              color="#fff"
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
              <Ionicons
                name="lock-closed-outline"
                size={11}
                color="#BDBDBD"
              />

              <Text style={styles.lockedText}>
                Locked
              </Text>
            </View>
          </View>

          <View style={styles.barcodeValue}>
            <Ionicons
              name="barcode-outline"
              size={20}
              color="#BDBDBD"
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

        <Ionicons
          name="pencil-outline"
          size={19}
          color="#777"
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
    backgroundColor: "#222",
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
    backgroundColor: "#3D3D3D",
    justifyContent: "center",
    alignItems: "center",
  },

  editBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#474747",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  editBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  instructions: {
    color: "#BDBDBD",
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
    color: "#BDBDBD",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 7,
  },

  productTextInput: {
    minHeight: 48,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#505050",
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
    borderColor: "#505050",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },

  unitOptionSelected: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },

  unitOptionText: {
    color: "#BDBDBD",
    fontSize: 13,
    fontWeight: "700",
  },

  unitOptionTextSelected: {
    color: "#222",
  },

  barcodeContainer: {
    borderTopWidth: 1,
    borderTopColor: "#444",
    marginTop: 20,
    paddingTop: 16,
  },

  barcodeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  barcodeLabel: {
    color: "#BDBDBD",
    fontSize: 12,
    fontWeight: "600",
  },

  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  lockedText: {
    color: "#999",
    fontSize: 11,
  },

  barcodeValue: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#292929",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 7,
  },

  barcodeText: {
    color: "#BDBDBD",
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
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
  },

  sectionSubtitle: {
    color: "#888",
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
    backgroundColor: "#fff",
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
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  nutritionLabel: {
    color: "#555",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 11,
    marginBottom: 7,
  },

  nutritionInputContainer: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 10,
    paddingHorizontal: 10,
  },

  nutritionInput: {
    flex: 1,
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 8,
  },

  unitText: {
    color: "#777",
    fontSize: 12,
    marginLeft: 4,
  },
});