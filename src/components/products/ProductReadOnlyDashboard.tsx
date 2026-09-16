import NutritionTile from "@/components/brand/NutritionTile";
import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  Text,
  View,
} from "react-native";

import type { LookupProduct } from "@/api/products/productLookup";
import { productScreenStyles as styles } from "@/styles/productScreen/styles";

type ProductReadOnlyDashboardProps = {
  product: LookupProduct;
  isGenericProduct?: boolean;
  onEdit?: () => void;
};

const ProductReadOnlyDashboard = ({
  product,
  isGenericProduct = false,
  onEdit,
}: ProductReadOnlyDashboardProps) => {
  const productName =
    product.product_name.trim() ||
    "Missing product name";

  const brand =
    product.brands.trim() ||
    "Brand missing";

  const measurementUnit =
    product.measurement_unit;

  const productAmount =
    product.product_amount.trim()
      ? `${product.product_amount}${measurementUnit}`
      : "Missing";

  return (
    <View style={styles.compactProductCard}>
      <View style={styles.compactProductHeader}>
        <View style={styles.compactProductHeading}>
          <Text
            style={styles.compactProductName}
            numberOfLines={2}
          >
            {productName}
          </Text>

          {!isGenericProduct && (
            <Text style={styles.compactProductBrand}>
              {brand}
            </Text>
          )}
        </View>

        {isGenericProduct || !onEdit ? (
          <View style={styles.editProductButton}>
            <Ionicons
              name="lock-closed-outline"
              size={15}
              color="#666"
            />

            <Text style={styles.editProductButtonText}>
              Fixed
            </Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.editProductButton,
              pressed && styles.editProductButtonPressed,
            ]}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit product information"
          >
            <Ionicons
              name="pencil-outline"
              size={16}
              color="#222"
            />

            <Text style={styles.editProductButtonText}>
              Edit
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.compactAmountRow}>
        <Text style={styles.compactAmountLabel}>
          {isGenericProduct
            ? "Default amount"
            : "Package amount"}
        </Text>

        <Text style={styles.compactAmountValue}>
          {productAmount}
        </Text>
      </View>

      <View style={styles.compactDivider} />

      <Text style={styles.compactNutritionHeading}>
        Nutrition per 100{measurementUnit}
      </Text>

      <View style={styles.compactNutritionGrid}>
        <CompactNutritionItem
          label="Calories"
          value={product.nutriments.energy_kcal_100g}
          unit="kcal"
        />

        <CompactNutritionItem
          label="Protein"
          value={product.nutriments.proteins_100g}
          unit="g"
        />

        <CompactNutritionItem
          label="Carbs"
          value={
            product.nutriments.carbohydrates_100g
          }
          unit="g"
        />

        <CompactNutritionItem
          label="Fat"
          value={product.nutriments.fat_100g}
          unit="g"
        />

        <CompactNutritionItem
          label="Sugars"
          value={product.nutriments.sugars_100g}
          unit="g"
        />

        <CompactNutritionItem
          label="Fibre"
          value={product.nutriments.fiber_100g}
          unit="g"
        />

        <CompactNutritionItem
          label="Salt"
          value={product.nutriments.salt_100g}
          unit="g"
        />
      </View>
    </View>
  );
};

type CompactNutritionItemProps = {
  label: string;
  value: string;
  unit: string;
};

const CompactNutritionItem = ({
  label,
  value,
  unit,
}: CompactNutritionItemProps) => {
  const displayValue = value.trim()
    ? `${value} ${unit}`
    : "Missing";

  return <NutritionTile label={label} value={displayValue} />;
};

export default ProductReadOnlyDashboard;
