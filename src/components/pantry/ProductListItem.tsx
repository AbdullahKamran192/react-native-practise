import ProductImage from "@/components/products/ProductImage";
import { genericProductImageUrl } from "@/utils/productImage";
import { getPantryAmounts, formatPantryQuantity } from "@/utils/pantryAmounts";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  StyleSheet,
  Pressable,
  Text,
  View,
} from "react-native";

import type {
  PantryItem,
} from "@/api/products";

type ProductListItemProps = {
  pantryItem: PantryItem;
};

const ProductListItem = ({
  pantryItem,
}: ProductListItemProps) => {
  /*
   * A pantry row contains either a barcode product
   * or a generic product.
   */
  const barcodeProduct =
    pantryItem.product;

  const genericProduct =
    pantryItem.generic_product;

  /*
   * This should not happen because the database CHECK
   * constraint requires every pantry row to reference
   * exactly one product type.
   */
  if (
    !barcodeProduct &&
    !genericProduct
  ) {
    return null;
  }

  const isGenericProduct =
    genericProduct !== null;

  const { amountRemaining, productAmount, quantity } = getPantryAmounts(pantryItem);

  const measurementUnit =
    barcodeProduct?.measurement_unit ??
    genericProduct?.measurement_unit ??
    "g";

  const productName =
    barcodeProduct?.product_name ??
    genericProduct?.product_name ??
    "Unknown product";

  const caloriesPer100 = Number(
    barcodeProduct?.calories_per_100 ??
      genericProduct?.calories_per_100 ??
      0
  );

  const proteinPer100 = Number(
    barcodeProduct?.protein_per_100 ??
      genericProduct?.protein_per_100 ??
      0
  );

  const totalCalories = caloriesPer100 * amountRemaining / 100;
  const totalProtein = proteinPer100 * amountRemaining / 100;

  return (
    <Pressable style={({ pressed }) => [styles.productCard, pressed && { opacity: 0.7 }]}
      accessibilityRole="button" accessibilityLabel={`View ${productName}, edit amount remaining`}
      onPress={() => router.push({ pathname: "/pantryDetails", params: { pantryId: String(pantryItem.id) } })}>
      <ProductImage thumbnail name={productName} uri={genericProduct
        ? genericProductImageUrl(genericProduct.image_path) : barcodeProduct?.image_url} />

      <View
        style={
          styles.productInformation
        }
      >
        <View style={styles.nameRow}>
          <Text
            style={styles.productName}
            numberOfLines={1}
          >
            {productName}
          </Text>

          {quantity !== null && (
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityText}>
                ×{formatPantryQuantity(quantity)}
              </Text>
            </View>
          )}
        </View>

        <View
          style={styles.nutritionRow}
        >
          <Text
            style={
              styles.nutritionText
            }
          >
            {Math.round(
              totalCalories
            )}{" "}
            kcal
          </Text>

          <View style={styles.dot} />

          <Text
            style={
              styles.nutritionText
            }
          >
            {Math.round(
              totalProtein * 10
            ) / 10}
            g protein
          </Text>
        </View>

        <Text style={styles.amountText}>
          {amountRemaining}{measurementUnit} remaining
          {quantity !== null
            ? ` • ${productAmount}${measurementUnit} each`
            : " • item size unavailable"}
        </Text>

        <Text style={styles.productType}>
          {isGenericProduct
            ? "Generic food"
            : "Packaged product"}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color="#999"
      />
    </Pressable>
  );
};

export default ProductListItem;

const styles = StyleSheet.create({
  productCard: {
    minHeight: 92,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  productInformation: {
    flex: 1,
    marginHorizontal: 14,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  productName: {
    flexShrink: 1,
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
  },

  quantityBadge: {
    backgroundColor: "#222",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },

  quantityText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  nutritionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  nutritionText: {
    color: "#777",
    fontSize: 13,
  },

  amountText: {
    color: "#999",
    fontSize: 11,
    marginTop: 4,
  },

  productType: {
    color: "#999",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#BDBDBD",
    marginHorizontal: 8,
  },
});
