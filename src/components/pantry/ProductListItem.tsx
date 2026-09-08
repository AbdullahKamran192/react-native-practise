import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export type Product = {
  barcode_number: string;
  product_name: string | null;
  created_at: string;
  product_weight: number | null;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  sugars_per_100g: number | null;
  salt_per_100g: number | null;
  fibre_per_100g: number | null;
};

export type PantryItem = {
  created_at: string;
  user_id: string;
  product_barcode: string;
  quantity: number;
  product: Product;
};

type ProductListItemProps = {
  pantryItem: PantryItem;
};

const ProductListItem = ({
  pantryItem,
}: ProductListItemProps) => {
  const { product } = pantryItem;

  const quantity = Number(pantryItem.quantity ?? 0);
  const weight = Number(product.product_weight ?? 0);

  const caloriesPer100g = Number(
    product.calories_per_100g ?? 0
  );

  const proteinPer100g = Number(
    product.protein_per_100g ?? 0
  );

  const onePackageCalories =
    caloriesPer100g * (weight / 100);

  const onePackageProtein =
    proteinPer100g * (weight / 100);

  const totalCalories =
    onePackageCalories * quantity;

  const totalProtein =
    onePackageProtein * quantity;

  return (
    <View style={styles.productCard}>
      <View style={styles.productIcon}>
        <Ionicons
          name="nutrition-outline"
          size={23}
          color="#222"
        />
      </View>

      <View style={styles.productInformation}>
        <View style={styles.nameRow}>
          <Text
            style={styles.productName}
            numberOfLines={1}
          >
            {product.product_name || "Unknown product"}
          </Text>

          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>
              ×{quantity}
            </Text>
          </View>
        </View>

        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionText}>
            {Math.round(totalCalories)} kcal
          </Text>

          <View style={styles.dot} />

          <Text style={styles.nutritionText}>
            {Math.round(totalProtein * 10) / 10}g protein
          </Text>
        </View>

        <Text style={styles.weightText}>
          {weight > 0
            ? `${weight}g each • ${quantity} ${
                quantity === 1 ? "item" : "items"
              }`
            : `${quantity} ${
                quantity === 1 ? "item" : "items"
              } • weight unavailable`}
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

  weightText: {
    color: "#999",
    fontSize: 11,
    marginTop: 4,
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#BDBDBD",
    marginHorizontal: 8,
  },
});