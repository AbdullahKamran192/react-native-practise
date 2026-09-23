import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { formatNumber } from "@/utils/formatNumber";
import { brand } from "@/components/brand/theme";
import { nutritionPerPound } from "@/utils/productValue";
import ProductPhotoSubmission from "@/components/products/ProductPhotoSubmission";
import ProductImage from "@/components/products/ProductImage";
import { AppIcon } from "@/components/brand/AppIcon";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  AccessibilityInfo,
  Platform,
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
  caloriesPerPound: number | null;
  proteinPerPound: number | null;
};

const ProductPantryScreen = () => {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

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

  const [status, setStatus] = useState<{ title: string; message: string; success: boolean } | null>(null);
  useEffect(() => { setStatus(null); }, [productIdentifier]);

  function showStatus(title: string, message: string, success = false) {
    setStatus({ title, message, success });
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(title + ". " + message);
  }

  const [price, setPrice] = useState("");
  const [amountSelection, setAmountSelection] = useState<PantryAmountSelection>({
    mode: "quantity", value: "1",
  });
  const packageSize = toNumber(product?.product_amount);
  const amountToAdd = resolvePantryAddition(amountSelection, packageSize);

  function handleAmountChange(selection: PantryAmountSelection) {
    setStatus(null);
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
    setStatus(null);
    setProduct(updatedProduct);

    /*
     * A previous calculation is no longer valid after
     * any product information changes.
     */
    setCalculatedValue(null);
  }

  function handlePriceChange(value: string) {
    setStatus(null);
    setPrice(value);
    setCalculatedValue(null);
  }

  function calculateProductValue() {
    setStatus(null);
    if (!product) {
      return;
    }

    const enteredPrice = toNumber(price);

    if (
      enteredPrice === null ||
      enteredPrice <= 0
    ) {
      showStatus(
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
      showStatus(
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

    setCalculatedValue({
      caloriesPerPound: nutritionPerPound(caloriesPer100, productAmount, enteredPrice),
      proteinPerPound: nutritionPerPound(proteinPer100, productAmount, enteredPrice),
    });
  }

  async function addProductToPantry() {
    if (isAddingToPantry) return;
    setStatus(null);
    if (!product) {
      return;
    }

    if (amountToAdd === null) {
      showStatus(
        packageSize === null || packageSize <= 0 ? "Missing package amount" : "Invalid amount to add",
        packageSize === null || packageSize <= 0
          ? "Enter the package amount, or edit Amount to add and enter the total in g or ml."
          : "Edit the amount to add and enter a valid quantity or total amount."
      );
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
        showStatus(
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

        showStatus(
          "Product added to pantry",
          `Your pantry now contains ${formatNumber(result.amount_remaining)}${result.measurement_unit} of this product.`,
          true
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not add the generic product.";

        showStatus(
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
      showStatus(
        "Invalid product",
        "The product barcode is missing."
      );

      return;
    }

    const submissionResult =
      createProductSubmission(barcode, product);

    if (!submissionResult.success) {
      showStatus(
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

      showStatus(
        "Product added to pantry",
        `Your pantry now contains ${formatNumber(result.amount_remaining)}${result.measurement_unit} of this product.`,
          true
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not add the product.";

      showStatus(
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
          color={appTheme.color(brand.ink, "text")}
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
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
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
            <AppIcon
              name={
                isGenericProduct
                  ? "nutrition-outline"
                  : "barcode-outline"
              }
              size={24}
              color={appTheme.color(brand.ink, "text")}
            />
          </View>
        </View>

        {lookupStatus === "not-found" && (
          <View style={styles.manualEntryNotice}>
            <AppIcon
              name="information-circle-outline"
              size={23}
              color={appTheme.color("#7A5413", "text")}
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
            <AppIcon
              name="cloud-offline-outline"
              size={23}
              color={appTheme.color("#7A5413", "text")}
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

        {isGenericProduct ? <ProductImage uri={editableProduct.image_url} name={editableProduct.product_name} />
          : <ProductPhotoSubmission key={productIdentifier} barcode={productIdentifier} product={editableProduct} />}

        {isGenericProduct && (
          <View style={styles.genericProductNotice}>
            <AppIcon
              name="lock-closed-outline"
              size={21}
              color={appTheme.color("#365A40", "text")}
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
              placeholderTextColor={appTheme.color(brand.muted, "text")}
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
          <AppIcon
            name="calculator-outline"
            size={22}
            color={appTheme.color(brand.deepTeal, "text")}
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
              color={appTheme.color(brand.surface, "text")}
            />
          ) : (
            <AppIcon
              name="add"
              size={24}
              color={appTheme.color(brand.surface, "text")}
            />
          )}

          <Text style={styles.addButtonText}>
            {isAddingToPantry
              ? "Adding..."
              : "Add to Pantry"}
          </Text>
        </Pressable>
      </ScrollView>
      {status && <View
        accessible accessibilityLiveRegion="polite"
        accessibilityLabel={status.title + ". " + status.message}
        style={[styles.statusBanner, status.success ? styles.statusSuccess : styles.statusError]}>
        <AppIcon name={status.success ? "checkmark-circle" : "alert-circle-outline"} size={28} color={appTheme.color(status.success ? "#23733D" : "#A62B36", "text")} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.statusTitle, { color: appTheme.color(status.success ? "#23733D" : "#A62B36", "text") }]}>{status.title}</Text>
          <Text style={styles.statusMessage}>{status.message}</Text>
        </View>
      </View>}
    </SafeAreaView>
  );
};

export default ProductPantryScreen;

const baseStyles = StyleSheet.create({
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 18, borderWidth: 1 },
  statusSuccess: { backgroundColor: "#EAF7EC", borderColor: "#BDDFC5" },
  statusError: { backgroundColor: "#FFF0F1", borderColor: "#F0C8CE" },
  statusTitle: { fontSize: 16, fontWeight: "700" },
  statusMessage: { fontSize: 14, lineHeight: 21, color: "#354D58" },
  container: {
    flex: 1,
    backgroundColor: brand.background,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  centeredContainer: {
    flex: 1,
    backgroundColor: brand.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    color: brand.muted,
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
    color: brand.muted,
    fontSize: 14,
    marginBottom: 4,
  },

  title: {
    color: brand.ink,
    fontSize: 26,
    fontWeight: "700",
  },

  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: brand.paleTeal,
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
    color: brand.ink,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 14,
  },

  priceCard: {
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
    borderRadius: 18,
    padding: 18,
  },

  priceLabel: {
    color: brand.muted,
    fontSize: 14,
    marginBottom: 12,
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  currencySymbol: {
    color: brand.ink,
    fontSize: 20,
    fontWeight: "700",
    marginRight: 8,
  },

  input: {
    flex: 1,
    height: "100%",
    color: brand.ink,
    fontSize: 18,
  },

  calculateButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: brand.paleTeal,
    borderWidth: 1,
    borderColor: brand.border,
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
    color: brand.deepTeal,
    fontSize: 16,
    fontWeight: "700",
  },

  addButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: brand.teal,
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
    color: brand.surface,
    fontSize: 16,
    fontWeight: "700",
  },
});
