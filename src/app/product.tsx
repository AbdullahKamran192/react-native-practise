import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ProductNutritionDashboard, {
  Product,
} from "@/components/products/ProductNutritionDashboard";

import ProductValueDashboard from "@/components/products/ProductValueDashboard";

type LookupStatus =
  | "found"
  | "not-found"
  | "error"
  | null;

type CalculatedValue = {
  caloriesPerPound: number;
  proteinPerPound: number;
};

function createEmptyProduct(): Product {
  return {
    product_name: "",
    brands: "",
    quantity: "",

    nutriments: {
      energy_kcal_100g: "",
      proteins_100g: "",
      carbohydrates_100g: "",
      fat_100g: "",
      sugars_100g: "",
      salt_100g: "",
      fiber_100g: "",
    },
  };
}

function convertToNumber(
  value: number | string | undefined
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const cleanedValue =
    typeof value === "string"
      ? value.trim().replace(",", ".")
      : value;

  const convertedValue = Number(cleanedValue);

  return Number.isFinite(convertedValue)
    ? convertedValue
    : null;
}

function getProductWeightInGrams(
  quantity: string | undefined
): number | null {
  if (!quantity?.trim()) {
    return null;
  }

  const cleanedQuantity = quantity
    .trim()
    .toLowerCase()
    .replace(",", ".");

  /*
   * Multipacks:
   * 5 x 100
   * 5 x 100g
   * 5 × 100 grams
   * 4 x 1kg
   */
  const multipackMatch = cleanedQuantity.match(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kilograms?|kilos?|kg|grams?|g)?/
  );

  if (multipackMatch) {
    const quantity = Number(multipackMatch[1]);
    const individualWeight = Number(
      multipackMatch[2]
    );

    const unit = multipackMatch[3] ?? "g";

    const totalWeight =
      quantity * individualWeight;

    const isKilograms =
      unit === "kg" ||
      unit.startsWith("kilogram") ||
      unit.startsWith("kilo");

    return isKilograms
      ? totalWeight * 1000
      : totalWeight;
  }

  /*
   * Individual packages:
   * 500
   * 500g
   * 500 grams
   * 1.5kg
   * 1 kilogram
   */
  const weightMatch = cleanedQuantity.match(
    /(\d+(?:\.\d+)?)\s*(kilograms?|kilos?|kg|grams?|g)?/
  );

  if (!weightMatch) {
    return null;
  }

  const weight = Number(weightMatch[1]);
  const unit = weightMatch[2] ?? "g";

  if (!Number.isFinite(weight) || weight <= 0) {
    return null;
  }

  const isKilograms =
    unit === "kg" ||
    unit.startsWith("kilogram") ||
    unit.startsWith("kilo");

  return isKilograms ? weight * 1000 : weight;
}

const ProductScreen = () => {
  const { data: barcode } =
    useLocalSearchParams<{ data: string }>();

  const [isLoading, setIsLoading] = useState(true);

  const [lookupStatus, setLookupStatus] =
    useState<LookupStatus>(null);

  const [product, setProduct] =
    useState<Product | null>(null);

  const [price, setPrice] = useState("");

  const [calculatedValue, setCalculatedValue] =
    useState<CalculatedValue | null>(null);

  useEffect(() => {
    async function getProduct() {
      if (!barcode) {
        setProduct(createEmptyProduct());
        setLookupStatus("not-found");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setLookupStatus(null);
        setCalculatedValue(null);

        const response = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
            barcode
          )}.json`
        );

        if (!response.ok) {
          throw new Error(
            `Request failed with status ${response.status}`
          );
        }

        const json = await response.json();

        if (json.status === 1 && json.product) {
          setProduct(json.product);
          setLookupStatus("found");
        } else {
          /*
           * Product does not exist in Open Food Facts.
           * Display the normal form with empty inputs.
           */
          setProduct(createEmptyProduct());
          setLookupStatus("not-found");
        }
      } catch (error) {
        console.error(
          "Could not fetch product:",
          error
        );

        /*
         * Allow the user to enter everything manually
         * if Open Food Facts cannot be reached.
         */
        setProduct(createEmptyProduct());
        setLookupStatus("error");
      } finally {
        setIsLoading(false);
      }
    }

    getProduct();
  }, [barcode]);

  function handleProductChange(
    updatedProduct: Product
  ) {
    setProduct(updatedProduct);

    /*
     * Hide the previous calculation because changing
     * nutrition or weight makes it outdated.
     */
    setCalculatedValue(null);
  }

  function handlePriceChange(value: string) {
    setPrice(value);

    /*
     * Hide the previous calculation because changing
     * the price makes it outdated.
     */
    setCalculatedValue(null);
  }

  function calculateProductValue() {
    if (!product) {
      return;
    }

    const enteredPrice = convertToNumber(price);

    if (
      enteredPrice === null ||
      enteredPrice <= 0
    ) {
      Alert.alert(
        "Invalid price",
        "Enter a valid product price greater than £0."
      );

      return;
    }

    const productWeight = getProductWeightInGrams(
      product.quantity
    );

    if (
      productWeight === null ||
      productWeight <= 0
    ) {
      Alert.alert(
        "Missing product weight",
        "Enter the product weight, for example 500g, 1kg or 5 x 100g."
      );

      return;
    }

    const caloriesPer100g = convertToNumber(
      product.nutriments?.energy_kcal_100g
    );

    const proteinPer100g = convertToNumber(
      product.nutriments?.proteins_100g
    );

    if (
      caloriesPer100g === null &&
      proteinPer100g === null
    ) {
      Alert.alert(
        "Missing nutrition",
        "Enter calories or protein per 100g before calculating the value."
      );

      return;
    }

    const packageCalories =
      (caloriesPer100g ?? 0) *
      (productWeight / 100);

    const packageProtein =
      (proteinPer100g ?? 0) *
      (productWeight / 100);

    setCalculatedValue({
      caloriesPerPound:
        packageCalories / enteredPrice,

      proteinPerPound:
        packageProtein / enteredPrice,
    });
  }

  function addProductToPantry() {
    if (!product || !barcode) {
      return;
    }

    const productWeight = getProductWeightInGrams(
      product.quantity
    );

    const productToSave = {
      barcode_number: barcode,

      product_name:
        product.product_name?.trim() || null,

      product_weight: productWeight,

      calories_per_100g: convertToNumber(
        product.nutriments?.energy_kcal_100g
      ),

      protein_per_100g: convertToNumber(
        product.nutriments?.proteins_100g
      ),

      carbs_per_100g: convertToNumber(
        product.nutriments?.carbohydrates_100g
      ),

      fat_per_100g: convertToNumber(
        product.nutriments?.fat_100g
      ),

      sugars_per_100g: convertToNumber(
        product.nutriments?.sugars_100g
      ),

      salt_per_100g: convertToNumber(
        product.nutriments?.salt_100g
      ),

      fibre_per_100g: convertToNumber(
        product.nutriments?.fiber_100g
      ),
    };

    const productPrice = convertToNumber(price);

    console.log("Product ready to save:", {
      product: productToSave,
      price: productPrice,
    });

    /*
     * Leave the button like this for now.
     *
     * Later this function will:
     *
     * 1. Insert or update productToSave in products.
     * 2. Insert or update the user's pantry row.
     * 3. Invalidate the ["pantry"] query.
     */
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator
          size="large"
          color="#222"
        />

        <Text style={styles.loadingText}>
          Finding your product...
        </Text>
      </SafeAreaView>
    );
  }

  const editableProduct =
    product ?? createEmptyProduct();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>
              Scanned product
            </Text>

            <Text style={styles.title}>
              Product Details
            </Text>
          </View>

          <View style={styles.scanIcon}>
            <Ionicons
              name="barcode-outline"
              size={24}
              color="#222"
            />
          </View>
        </View>

        {lookupStatus === "not-found" && (
          <View style={styles.manualEntryNotice}>
            <Ionicons
              name="information-circle-outline"
              size={23}
              color="#7A5413"
            />

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Product not found
              </Text>

              <Text style={styles.noticeText}>
                This product is not in our database yet.
                Enter the information from its packaging
                below.
              </Text>
            </View>
          </View>
        )}

        {lookupStatus === "error" && (
          <View style={styles.manualEntryNotice}>
            <Ionicons
              name="cloud-offline-outline"
              size={23}
              color="#7A5413"
            />

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Product information unavailable
              </Text>

              <Text style={styles.noticeText}>
                We couldn't retrieve this product, but
                you can enter its information manually.
              </Text>
            </View>
          </View>
        )}

        <ProductNutritionDashboard
          product={editableProduct}
          myData={barcode}
          onProductChange={handleProductChange}
        />

        <Text style={styles.sectionTitle}>
          Product price
        </Text>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>
            Enter the total price you paid
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>
              £
            </Text>

            <TextInput
              style={styles.input}
              value={price}
              onChangeText={handlePriceChange}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.calculateButton,

            pressed &&
              styles.calculateButtonPressed,
          ]}
          onPress={calculateProductValue}
        >
          <Ionicons
            name="calculator-outline"
            size={22}
            color="#222"
          />

          <Text style={styles.calculateButtonText}>
            Calculate Value
          </Text>
        </Pressable>

        {calculatedValue && (
          <ProductValueDashboard
            caloriesPerPound={
              calculatedValue.caloriesPerPound
            }
            proteinPerPound={
              calculatedValue.proteinPerPound
            }
          />
        )}

        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={addProductToPantry}
        >
          <Ionicons
            name="add"
            size={24}
            color="#fff"
          />

          <Text style={styles.addButtonText}>
            Add to Pantry
          </Text>
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
    color: "#777",
    fontSize: 14,
    marginBottom: 4,
  },

  title: {
    color: "#222",
    fontSize: 26,
    fontWeight: "700",
  },

  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  manualEntryNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFF3D6",
    borderWidth: 1,
    borderColor: "#ECD09C",
    borderRadius: 16,
    padding: 15,
    marginBottom: 18,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    color: "#4F350B",
    fontSize: 15,
    fontWeight: "700",
  },

  noticeText: {
    color: "#7A5413",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  sectionTitle: {
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 14,
  },

  priceCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
  },

  priceLabel: {
    color: "#666",
    fontSize: 14,
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
    color: "#222",
    fontSize: 20,
    fontWeight: "700",
    marginRight: 8,
  },

  input: {
    flex: 1,
    height: "100%",
    color: "#222",
    fontSize: 18,
  },

  calculateButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#E7E7E7",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },

  calculateButtonPressed: {
    opacity: 0.7,
  },

  calculateButtonText: {
    color: "#222",
    fontSize: 15,
    fontWeight: "700",
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

  addButtonPressed: {
    opacity: 0.75,
  },

  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});