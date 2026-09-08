import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Product = {
  product_name?: string;
  brands?: string;
  quantity?: string;
  nutriments?: {
    energy_kcal_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
    proteins_100g?: number;
    sugars_100g?: number;
    salt_100g?: number;
  };
};

type ProductNutritionDashboardProps = {
  product: Product;
  myData?: string;
};

const ProductNutritionDashboard = ({
  product,
  myData,
}: ProductNutritionDashboardProps) => {
  const nutriments = product.nutriments ?? {};

  const calories = nutriments.energy_kcal_100g;
  const protein = nutriments.proteins_100g;
  const carbs = nutriments.carbohydrates_100g;
  const fat = nutriments.fat_100g;
  const sugars = nutriments.sugars_100g;
  const salt = nutriments.salt_100g;

  const displayValue = (
    value: number | undefined,
    unit: string
  ): string => {
    if (value === undefined || value === null) {
      return "Missing";
    }

    return `${value} ${unit}`;
  };

  const caloriesMissing =
    calories === undefined || calories === null || calories === 0;

  const proteinMissing =
    protein === undefined || protein === null || protein === 0;

  const carbsMissing =
    carbs === undefined || carbs === null || carbs === 0;

  const fatMissing =
    fat === undefined || fat === null || fat === 0;

  const sugarsMissing =
    sugars === undefined || sugars === null || sugars === 0;

  const saltMissing =
    salt === undefined || salt === null || salt === 0;

  return (
    <View>
      <View style={styles.productCard}>
        <View style={styles.productIcon}>
          <Ionicons name="nutrition-outline" size={28} color="#fff" />
        </View>

        <Text style={styles.productName}>
          {product.product_name || "Unnamed product"}
        </Text>

        {product.brands ? (
          <Text style={styles.brand}>{product.brands}</Text>
        ) : null}

        {product.quantity ? (
          <Text style={styles.quantity}>{product.quantity}</Text>
        ) : null}

        <View style={styles.barcodeRow}>
          <Ionicons name="barcode-outline" size={18} color="#BDBDBD" />

          <Text style={styles.barcodeText}>
            Barcode: {myData || "Unavailable"}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Nutrition per 100g</Text>

      <View style={styles.nutritionGrid}>
        <View style={[styles.nutritionItemWarning, {backgroundColor: caloriesMissing ? '#ecd09c' : "white"}]}>
          <Ionicons name="flame-outline" size={22} color="#222" />
          <Text style={styles.nutritionLabel}>Calories</Text>
          <Text style={styles.nutritionValue}>
            {displayValue(calories, "kcal")}
          </Text>
        </View>

        <View style={[styles.nutritionItem, {backgroundColor: proteinMissing ? '#ecd09c' : "white"}]}>
          <Ionicons name="barbell-outline" size={22} color="#222" />
          <Text style={styles.nutritionLabel}>Protein</Text>
          <Text style={styles.nutritionValue}>
            {displayValue(protein, "g")}
          </Text>
        </View>

        <View style={[styles.nutritionItem, {backgroundColor: carbsMissing ? '#ecd09c' : "white"}]}>
          <Ionicons name="restaurant-outline" size={22} color="#222" />
          <Text style={styles.nutritionLabel}>Carbs</Text>
          <Text style={styles.nutritionValue}>
            {displayValue(carbs, "g")}
          </Text>
        </View>

        <View style={[styles.nutritionItem, {backgroundColor: fatMissing ? '#ecd09c' : "white"}]}>
          <Ionicons name="water-outline" size={22} color="#222" />
          <Text style={styles.nutritionLabel}>Fat</Text>
          <Text style={styles.nutritionValue}>
            {displayValue(fat, "g")}
          </Text>
        </View>

        <View style={[styles.nutritionItem, {backgroundColor: sugarsMissing ? '#ecd09c' : "white"}]}>
          <Ionicons name="cube-outline" size={22} color="#222" />
          <Text style={styles.nutritionLabel}>Sugars</Text>
          <Text style={styles.nutritionValue}>
            {displayValue(sugars, "g")}
          </Text>
        </View>

        <View style={[styles.nutritionItem, {backgroundColor: saltMissing ? '#ecd09c' : "white"}]}>
          <Ionicons name="ellipse-outline" size={22} color="#222" />
          <Text style={styles.nutritionLabel}>Salt</Text>
          <Text style={styles.nutritionValue}>
            {displayValue(salt, "g")}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default ProductNutritionDashboard;

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: "#222",
    borderRadius: 20,
    padding: 24,
  },

  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#3D3D3D",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  productName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },

  brand: {
    color: "#BDBDBD",
    fontSize: 14,
    marginTop: 6,
  },

  quantity: {
    color: "#BDBDBD",
    fontSize: 14,
    marginTop: 4,
  },

  barcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#444",
    marginTop: 20,
    paddingTop: 16,
  },

  barcodeText: {
    color: "#BDBDBD",
    fontSize: 13,
  },

  warningCard: {
    backgroundColor: "#FFF3D6",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  warningText: {
    flex: 1,
    color: "#8A5A00",
    fontSize: 13,
    lineHeight: 19,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#222",
    marginTop: 28,
    marginBottom: 14,
  },

  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  nutritionItem: {
    width: "48%",
    minHeight: 120,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    justifyContent: "space-between",
  },

  nutritionItemWarning: {
    width: "48%",
    minHeight: 120,
    backgroundColor: "#8A5A00",
    borderRadius: 18,
    padding: 16,
    justifyContent: "space-between",
  },

  // calorieItem: {
  //   backgroundColor: "#af2222",
  // },

  nutritionLabel: {
    color: "#777",
    fontSize: 13,
    marginTop: 10,
  },

  nutritionValue: {
    color: "#222",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
});