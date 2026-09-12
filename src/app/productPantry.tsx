import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

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

import {
  useAddGenericProductToPantry,
  useAddProductToPantry,
} from "@/api/products";

import type { LookupProduct } from "@/api/products/productLookup";

import {
  createEmptyProduct,
  toNumber,
} from "@/api/products/productLookup/utils";

import ProductNutritionDashboard from "@/components/products/ProductNutritionDashboard";
import ProductReadOnlyDashboard from "@/components/products/ProductReadOnlyDashboard";
import ProductValueDashboard from "@/components/products/ProductValueDashboard";

import useSelectedProduct from "@/hooks/products/useSelectedProduct";
import type { ProductSource } from "@/hooks/products/useSelectedProduct";

import { createProductSubmission } from "@/utils/productSubmission";
import AmountToAdd from "@/components/pantry/AmountToAdd";
import { resolvePantryAddition } from "@/utils/pantryAmounts";
import type { PantryAmountSelection } from "@/utils/pantryAmounts";

type CalculatedValue = {
  caloriesPerPound: number;
  proteinPerPound: number;
};

const ProductPantryScreen = () => {
  const {
    data,
    source,
    productId,
  } = useLocalSearchParams<{
    data?: string;
    source?: ProductSource;
    productId?: string;
  }>();

  const {
    product,
    setProduct,
    isLoading,
    lookupStatus,
    isGenericProduct,
    barcode,
    genericProductId,
    productIdentifier,
  } = useSelectedProduct({
    data,
    source,
    productId,
  });

  const [price, setPrice] = useState("");
  const [amountSelection, setAmountSelection] = useState<PantryAmountSelection>({
    mode: "quantity", value: "1",
  });
  const packageSize = toNumber(product?.product_amount);
  const amountToAdd = resolvePantryAddition(amountSelection, packageSize);

  function handleAmountChange(selection: PantryAmountSelection) {
    setAmountSelection(selection);
    setCalculatedValue(null);
  }

  const [
    calculatedValue,
    setCalculatedValue,
  ] = useState<CalculatedValue | null>(null);

  const {
    mutateAsync: addBarcodeToPantry,
    isPending: isAddingBarcode,
  } = useAddProductToPantry();

  const {
    mutateAsync: addGenericToPantry,
    isPending: isAddingGeneric,
  } = useAddGenericProductToPantry();

  const isAddingToPantry =
    isAddingBarcode || isAddingGeneric;

  function handleProductChange(
    updatedProduct: LookupProduct
  ) {
    if (product?.measurement_unit !== updatedProduct.measurement_unit) {
      setAmountSelection({ mode: "quantity", value: "1" });
    }
    setProduct(updatedProduct);

    /*
     * A previous calculation is no longer valid after
     * any product information changes.
     */
    setCalculatedValue(null);
  }

  function handlePriceChange(value: string) {
    setPrice(value);
    setCalculatedValue(null);
  }

  function calculateProductValue() {
    if (!product) {
      return;
    }

    const enteredPrice = toNumber(price);

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

    const productAmount = amountToAdd;

    const measurementUnit =
      product.measurement_unit;

    if (
      productAmount === null ||
      productAmount <= 0
    ) {
      Alert.alert(
        "Invalid amount to add",
        `Enter the total amount to add in ${measurementUnit}.`
      );

      return;
    }

    const caloriesPer100 = toNumber(
      product.nutriments.energy_kcal_100g
    );

    const proteinPer100 = toNumber(
      product.nutriments.proteins_100g
    );

    if (
      caloriesPer100 === null &&
      proteinPer100 === null
    ) {
      Alert.alert(
        "Missing nutrition",
        `Enter calories or protein per 100${measurementUnit} before calculating the value.`
      );

      return;
    }

    /*
     * The same calculation works for grams and
     * millilitres:
     *
     * nutrient per 100 × product amount / 100
     */
    const totalCalories =
      (caloriesPer100 ?? 0) *
      (productAmount / 100);

    const totalProtein =
      (proteinPer100 ?? 0) *
      (productAmount / 100);

    setCalculatedValue({
      caloriesPerPound:
        totalCalories / enteredPrice,
      proteinPerPound:
        totalProtein / enteredPrice,
    });
  }

  async function addProductToPantry() {
    if (!product) {
      return;
    }

    if (amountToAdd === null) {
      Alert.alert("Invalid amount to add", "Edit the amount to add and enter a valid quantity or total amount.");
      return;
    }

    /*
     * Generic products stay curated. The selected amount changes
     * only the user's pantry, not the default item size.
     */
    if (isGenericProduct) {
      const parsedGenericProductId = Number(
        genericProductId
      );

      if (
        !Number.isInteger(parsedGenericProductId) ||
        parsedGenericProductId <= 0
      ) {
        Alert.alert(
          "Invalid product",
          "The generic product ID is missing or invalid."
        );

        return;
      }

      try {
        const result = await addGenericToPantry({
          genericProductId: parsedGenericProductId,
          amountToAdd,
        });

        Alert.alert(
          "Added to pantry",
          `Your pantry now contains ${result.amount_remaining}${result.measurement_unit} of this product.`
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not add the generic product.";

        Alert.alert(
          "Could not add product",
          message
        );
      }

      return;
    }

    /*
     * Barcode products are first saved to
     * product_corrections. The database trigger then
     * creates or updates the shared products row
     * before the product is added to the pantry.
     */
    if (!barcode) {
      Alert.alert(
        "Invalid product",
        "The product barcode is missing."
      );

      return;
    }

    const submissionResult =
      createProductSubmission(barcode, product);

    if (!submissionResult.success) {
      Alert.alert(
        "Check product information",
        submissionResult.error
      );

      return;
    }

    try {
      const result = await addBarcodeToPantry({
        ...submissionResult.data,
        amountToAdd,
      });

      Alert.alert(
        "Added to pantry",
        `Your pantry now contains ${result.amount_remaining}${result.measurement_unit} of this product.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not add the product.";

      Alert.alert(
        "Could not add product",
        message
      );
    }
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
              {isGenericProduct
                ? "Generic food"
                : "Packaged product"}
            </Text>

            <Text style={styles.title}>
              Product Details
            </Text>
          </View>

          <View style={styles.scanIcon}>
            <Ionicons
              name={
                isGenericProduct
                  ? "nutrition-outline"
                  : "barcode-outline"
              }
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
                This product could not be found. Check
                the selected product or enter its
                information manually.
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
                We couldn't retrieve this product.
                Please try again.
              </Text>
            </View>
          </View>
        )}

        {isGenericProduct && (
          <View style={styles.genericProductNotice}>
            <Ionicons
              name="lock-closed-outline"
              size={21}
              color="#365A40"
            />

            <View style={styles.noticeContent}>
              <Text style={styles.genericProductNoticeTitle}>
                Curated generic food
              </Text>

              <Text style={styles.genericProductNoticeText}>
                Product details and nutrition are fixed.
                Adding this food only updates your pantry.
              </Text>
            </View>
          </View>
        )}

        {isGenericProduct ? (
          <ProductReadOnlyDashboard
            product={editableProduct}
            isGenericProduct
          />
        ) : (
          <ProductNutritionDashboard
            product={editableProduct}
            myData={productIdentifier}
            onProductChange={handleProductChange}
          />
        )}

        <AmountToAdd
          selection={amountSelection}
          onChange={handleAmountChange}
          packageSize={packageSize}
          unit={product?.measurement_unit ?? "g"}
          disabled={isAddingToPantry}
        />

        <Text style={styles.sectionTitle}>
          Product price
        </Text>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>
            Enter the total price for the amount above
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
            pressed && styles.calculateButtonPressed,
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
            (pressed || isAddingToPantry) &&
              styles.addButtonPressed,
          ]}
          onPress={addProductToPantry}
          disabled={isAddingToPantry}
        >
          {isAddingToPantry ? (
            <ActivityIndicator
              size="small"
              color="#fff"
            />
          ) : (
            <Ionicons
              name="add"
              size={24}
              color="#fff"
            />
          )}

          <Text style={styles.addButtonText}>
            {isAddingToPantry
              ? "Adding..."
              : "Add to Pantry"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProductPantryScreen;

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

  genericProductNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#EDF7EF",
    borderWidth: 1,
    borderColor: "#C9DFCD",
    borderRadius: 16,
    padding: 15,
    marginBottom: 18,
  },

  genericProductNoticeTitle: {
    color: "#294A32",
    fontSize: 15,
    fontWeight: "700",
  },

  genericProductNoticeText: {
    color: "#4E6F57",
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
    fontSize: 16,
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
    marginTop: 22,
  },

  addButtonPressed: {
    opacity: 0.7,
  },

  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
