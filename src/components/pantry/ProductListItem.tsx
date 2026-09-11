import { Ionicons } from "@expo/vector-icons";

import {
  StyleSheet,
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

  const quantity = Number(
    pantryItem.quantity ?? 0
  );

  /*
   * Barcode products store the package amount in
   * product_amount.
   *
   * Generic products store the average amount of one
   * unit in default_amount.
   */
  const productAmount = Number(
    barcodeProduct?.product_amount ??
      genericProduct?.default_amount ??
      0
  );

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

  /*
   * The calculation is identical for both grams and
   * millilitres:
   *
   * nutrient per 100 × item amount / 100
   */
  const oneItemCalories =
    caloriesPer100 *
    (productAmount / 100);

  const oneItemProtein =
    proteinPer100 *
    (productAmount / 100);

  const totalCalories =
    oneItemCalories * quantity;

  const totalProtein =
    oneItemProtein * quantity;

  const itemWord =
    quantity === 1
      ? "item"
      : "items";

  return (
    <View style={styles.productCard}>
      <View style={styles.productIcon}>
        <Ionicons
          name={
            isGenericProduct
              ? "nutrition-outline"
              : "barcode-outline"
          }
          size={23}
          color="#222"
        />
      </View>

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

          <View
            style={
              styles.quantityBadge
            }
          >
            <Text
              style={
                styles.quantityText
              }
            >
              ×{quantity}
            </Text>
          </View>
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
          {productAmount > 0
            ? `${productAmount}${measurementUnit} each • ${quantity} ${itemWord}`
            : `${quantity} ${itemWord} • amount unavailable`}
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
    </View>
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