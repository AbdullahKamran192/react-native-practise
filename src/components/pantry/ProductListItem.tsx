import ProductImage from "@/components/products/ProductImage";
import { genericProductImageUrl, barcodeProductImageUrl } from "@/utils/productImage";
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <ProductImage thumbnail thumbnailSize={72} name={productName} uri={genericProduct
          ? genericProductImageUrl(genericProduct.image_path) : barcodeProductImageUrl(barcodeProduct)} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.productName}>{productName}</Text>
          <Text style={{ color: "#007F95", fontSize: 20, fontWeight: "700" }}>{amountRemaining}{measurementUnit} <Text style={{ color: "#617783", fontSize: 14, fontWeight: "400" }}>remaining</Text></Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#617783" />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <Text style={{ backgroundColor: "#FFF3E2", color: "#AD510B", padding: 10, borderRadius: 12, fontSize: 15 }}><Ionicons name="flame-outline" size={16} /> {Math.round(totalCalories)} kcal</Text>
        <Text style={{ backgroundColor: "#EAF7EC", color: "#287C3D", padding: 10, borderRadius: 12, fontSize: 15 }}><Ionicons name="barbell-outline" size={16} /> {Math.round(totalProtein * 10) / 10}g protein</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 14 }}>
        {quantity !== null && <View style={styles.quantityBadge}><Text style={styles.quantityText}>?{formatPantryQuantity(quantity)}</Text></View>}
        <Text style={styles.amountText}>{quantity !== null ? `${productAmount}${measurementUnit} each` : "Item size unavailable"}</Text>
        <Text style={styles.productType}>{isGenericProduct ? "Generic food" : "Packaged product"}</Text>
      </View>
    </Pressable>
  );
};

export default ProductListItem;

const styles = StyleSheet.create({
  productCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#E7F1F3" },
  productName: { color: "#102739", fontSize: 18, fontWeight: "700", lineHeight: 25 },
  quantityBadge: { backgroundColor: "#E3F4F6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  quantityText: { color: "#00556B", fontSize: 14, fontWeight: "700" },
  amountText: { color: "#617783", fontSize: 14 },
  productType: { color: "#617783", fontSize: 13 },
});
