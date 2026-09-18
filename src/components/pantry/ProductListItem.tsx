import { formatNumber } from "@/utils/formatNumber";
import ProductImage from "@/components/products/ProductImage";
import { genericProductImageUrl, barcodeProductImageUrl } from "@/utils/productImage";
import { getPantryAmounts } from "@/utils/pantryAmounts";
import { AppIcon } from "@/components/brand/AppIcon";
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

  const { amountRemaining, quantity } = getPantryAmounts(pantryItem);

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
          <Text style={{ color: "#007F95", fontSize: 20, fontWeight: "700" }}>{formatNumber(amountRemaining)}{measurementUnit} <Text style={{ color: "#617783", fontSize: 14, fontWeight: "400" }}>remaining</Text></Text>
        </View>
        <AppIcon name="chevron-forward" size={22} color="#617783" />
      </View>
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { flex: 1.2, backgroundColor: "#FFF3E2" }]} accessibilityLabel={Math.round(totalCalories) + " calories remaining"}>
          <AppIcon name="flame-outline" size={15} color="#AD510B" />
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.badgeText, { color: "#AD510B" }]}>{Math.round(totalCalories)} kcal</Text>
        </View>
        <View style={[styles.badge, { flex: 1, backgroundColor: "#EAF7EC" }]} accessibilityLabel={Math.round(totalProtein * 10) / 10 + " grams protein remaining"}>
          <AppIcon name="barbell-outline" size={15} color="#287C3D" />
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.badgeText, { color: "#287C3D" }]}>{Math.round(totalProtein * 10) / 10}g</Text>
        </View>
        <View style={[styles.badge, { flex: 0.8, backgroundColor: "#E3F4F6" }]} accessibilityLabel={quantity === null ? "Quantity unavailable" : formatNumber(quantity) + " items remaining"}>
          <AppIcon name="cube" size={15} color="#00556B" />
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.badgeText, { color: "#00556B" }]}>{quantity !== null ? "\u00D7" + formatNumber(quantity) : "\u2014"}</Text>
        </View>
      </View>
    </Pressable>
  );
};

export default ProductListItem;

const styles = StyleSheet.create({
  productCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#E7F1F3" },
  productName: { color: "#102739", fontSize: 18, fontWeight: "700", lineHeight: 25 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  badge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 9, borderRadius: 12, minWidth: 0 },
  badgeText: { fontSize: 14, flexShrink: 1 },
});
