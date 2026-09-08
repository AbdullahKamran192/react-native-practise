import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProductNutritionDashboard from "@/components/products/ProductNutritionDashboard";
import { products } from "@/data/products";

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

const ProductScreen = () => {
  const { data } = useLocalSearchParams<{ data: string }>();

  const [isLoading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [price, setPrice] = useState("");

  const getProduct = async () => {

    function addProductToPantry() {
      products.push()
    }

    try {
      setLoading(true);

      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${data}.json`
      );

      const json = await response.json();

      if (json.status === 1 && json.product) {
        setProduct(json.product);
      } else {
        setProduct(null);
      }
    } catch (error) {
      console.error("Could not fetch product:", error);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data) {
      getProduct();
    }
  }, [data]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#222" />
        <Text style={styles.loadingText}>Finding your product...</Text>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <View style={styles.notFoundIcon}>
          <Ionicons name="alert-circle-outline" size={36} color="#666" />
        </View>

        <Text style={styles.notFoundTitle}>Product not found</Text>

        <Text style={styles.notFoundText}>
          We could not find nutritional information for barcode {data}.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Scanned product</Text>
            <Text style={styles.title}>Product Details</Text>
          </View>

          <View style={styles.scanIcon}>
            <Ionicons name="barcode-outline" size={24} color="#222" />
          </View>
        </View>

        <ProductNutritionDashboard product={product} myData={data} />

        <Text style={styles.sectionTitle}>Product price</Text>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Enter the price you paid</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>£</Text>

            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Pressable style={styles.addButton} onPress={addProductToPantry}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add to Pantry</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProductScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  centeredContainer: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    color: "#777",
    fontSize: 14,
    marginTop: 14,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  headerLabel: {
    fontSize: 14,
    color: "#777",
    marginBottom: 4,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#222",
  },

  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#222",
    marginTop: 28,
    marginBottom: 14,
  },

  priceCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
  },

  priceLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  currencySymbol: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    marginRight: 8,
  },

  input: {
    flex: 1,
    height: "100%",
    fontSize: 18,
    color: "#222",
  },

  addButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },

  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  notFoundIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  notFoundTitle: {
    color: "#222",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },

  notFoundText: {
    color: "#777",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
});