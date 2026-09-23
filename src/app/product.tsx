import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { formatNumber } from "@/utils/formatNumber";
import { AppIcon } from "@/components/brand/AppIcon";
import {
  useLocalSearchParams,
} from "expo-router";
import {
  useEffect,
  useState,
} from "react";

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

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useAddGenericProductToPantry,
  useAddProductToPantry,
} from "@/api/products";

import {
  lookupProduct,
} from "@/api/products/productLookup";

import type {
  LookupProduct,
  MeasurementUnit,
} from "@/api/products/productLookup";

import {
  createEmptyProduct,
  toNumber,
} from "@/api/products/productLookup/utils";

import ProductNutritionDashboard from "@/components/products/ProductNutritionDashboard";
import ProductValueDashboard from "@/components/products/ProductValueDashboard";

import { supabase } from "@/lib/supabase";

import {
  createProductSubmission,
} from "@/utils/productSubmission";

type ProductSource =
  | "barcode"
  | "generic";

type LookupStatus =
  | "found"
  | "not-found"
  | "error"
  | null;

type CalculatedValue = {
  caloriesPerPound: number;
  proteinPerPound: number;
};

type GenericProductRow = {
  id: number;
  product_name: string;
  default_amount: number;
  measurement_unit: MeasurementUnit;
  calories_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  sugars_per_100: number | null;
  salt_per_100: number | null;
  fibre_per_100: number | null;
};

/*
 * Converts a nullable database number into the
 * editable string format used by the product form.
 */
function numberToString(
  value: number | null
): string {
  return value === null
    ? ""
    : String(value);
}

/*
 * Loads a generic food using its generated database
 * ID and converts it into LookupProduct.
 *
 * This allows the existing nutrition dashboard to
 * display barcode and generic products using the
 * same object structure.
 */
async function lookupGenericProduct(
  genericProductId: string
): Promise<LookupProduct | null> {
  const { data, error } =
    await supabase
      .from("generic_products")
      .select(`
        id,
        product_name,
        default_amount,
        measurement_unit,
        calories_per_100,
        protein_per_100,
        carbs_per_100,
        fat_per_100,
        sugars_per_100,
        salt_per_100,
        fibre_per_100
      `)
      .eq("id", genericProductId)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row =
    data as GenericProductRow;

  return {
    product_name: row.product_name,
    brands: "",

    product_amount:
      numberToString(
        row.default_amount
      ),

    measurement_unit:
      row.measurement_unit,

    nutriments: {
      energy_kcal_100g:
        numberToString(
          row.calories_per_100
        ),

      proteins_100g:
        numberToString(
          row.protein_per_100
        ),

      carbohydrates_100g:
        numberToString(
          row.carbs_per_100
        ),

      fat_100g:
        numberToString(
          row.fat_per_100
        ),

      sugars_100g:
        numberToString(
          row.sugars_per_100
        ),

      salt_100g:
        numberToString(
          row.salt_per_100
        ),

      fiber_100g:
        numberToString(
          row.fibre_per_100
        ),
    },
  };
}

const ProductScreen = () => {
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

  /*
   * Scanner:
   * data contains the scanned barcode.
   *
   * Search:
   * productId contains either the barcode or the
   * generic-product ID.
   */
  const isGenericProduct =
    source === "generic";

  const barcode =
    source === "barcode"
      ? productId
      : data;

  const genericProductId =
    isGenericProduct
      ? productId
      : undefined;

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    lookupStatus,
    setLookupStatus,
  ] = useState<LookupStatus>(null);

  const [
    product,
    setProduct,
  ] = useState<LookupProduct | null>(
    null
  );

  const [price, setPrice] =
    useState("");

  const [
    calculatedValue,
    setCalculatedValue,
  ] = useState<CalculatedValue | null>(
    null
  );

  const {
    mutateAsync:
      addBarcodeToPantry,

    isPending:
      isAddingBarcode,
  } = useAddProductToPantry();

  const {
    mutateAsync:
      addGenericToPantry,

    isPending:
      isAddingGeneric,
  } =
    useAddGenericProductToPantry();

  const isAddingToPantry =
    isAddingBarcode ||
    isAddingGeneric;

  /*
   * Load either a generic product or barcode product
   * depending on the route parameters.
   */
  useEffect(() => {
    let isCurrentLookup = true;

    async function getProduct() {
      const lookupId =
        isGenericProduct
          ? genericProductId
          : barcode;

      if (!lookupId) {
        if (isCurrentLookup) {
          setProduct(
            createEmptyProduct()
          );

          setLookupStatus(
            "not-found"
          );

          setIsLoading(false);
        }

        return;
      }

      try {
        setIsLoading(true);
        setLookupStatus(null);
        setCalculatedValue(null);

        if (isGenericProduct) {
          const genericProduct =
            await lookupGenericProduct(
              lookupId
            );

          if (!isCurrentLookup) {
            return;
          }

          if (genericProduct) {
            setProduct(
              genericProduct
            );

            setLookupStatus(
              "found"
            );
          } else {
            setProduct(
              createEmptyProduct()
            );

            setLookupStatus(
              "not-found"
            );
          }

          return;
        }

        const result =
          await lookupProduct(
            lookupId
          );

        /*
         * Ignore an older request if the screen or
         * product changed before it completed.
         */
        if (!isCurrentLookup) {
          return;
        }

        setProduct(result.product);

        if (result.found) {
          setLookupStatus("found");
        } else if (
          result.hadLookupError
        ) {
          setLookupStatus("error");
        } else {
          setLookupStatus(
            "not-found"
          );
        }
      } catch (error) {
        console.error(
          "Could not look up product:",
          error
        );

        if (isCurrentLookup) {
          setProduct(
            createEmptyProduct()
          );

          setLookupStatus("error");
        }
      } finally {
        if (isCurrentLookup) {
          setIsLoading(false);
        }
      }
    }

    getProduct();

    return () => {
      isCurrentLookup = false;
    };
  }, [
    barcode,
    genericProductId,
    isGenericProduct,
  ]);

  function handleProductChange(
    updatedProduct: LookupProduct
  ) {
    setProduct(updatedProduct);

    /*
     * Recalculate the product value after any product
     * information changes.
     */
    setCalculatedValue(null);
  }

  function handlePriceChange(
    value: string
  ) {
    setPrice(value);
    setCalculatedValue(null);
  }

  function calculateProductValue() {
    if (!product) {
      return;
    }

    const enteredPrice =
      toNumber(price);

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

    const productAmount =
      toNumber(
        product.product_amount
      );

    const measurementUnit =
      product.measurement_unit;

    if (
      productAmount === null ||
      productAmount <= 0
    ) {
      Alert.alert(
        "Missing product amount",
        `Enter the amount in ${measurementUnit}, for example 150.`
      );

      return;
    }

    const caloriesPer100 =
      toNumber(
        product.nutriments
          .energy_kcal_100g
      );

    const proteinPer100 =
      toNumber(
        product.nutriments
          .proteins_100g
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
        totalCalories /
        enteredPrice,

      proteinPerPound:
        totalProtein /
        enteredPrice,
    });
  }

  async function addProductToPantry() {
    if (!product) {
      return;
    }

    /*
     * Generic products already exist in the curated
     * generic_products table.
     *
     * Therefore, only the generic product's ID needs
     * to be added to the pantry.
     */
    if (isGenericProduct) {
      const parsedGenericProductId =
        Number(genericProductId);

      if (
        !Number.isInteger(
          parsedGenericProductId
        ) ||
        parsedGenericProductId <= 0
      ) {
        Alert.alert(
          "Invalid product",
          "The generic product ID is missing or invalid."
        );

        return;
      }

      try {
        const result =
          await addGenericToPantry({
            genericProductId:
              parsedGenericProductId,
          });

        Alert.alert(
          "Added to pantry",
          `Your pantry now contains ${formatNumber(result.amount_remaining)}${result.measurement_unit} of this product.`
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
     * product_corrections.
     *
     * The database trigger then creates or updates
     * the shared products row before the product is
     * added to the pantry.
     */
    if (!barcode) {
      Alert.alert(
        "Invalid product",
        "The product barcode is missing."
      );

      return;
    }

    const submissionResult =
      createProductSubmission(
        barcode,
        product
      );

    if (!submissionResult.success) {
      Alert.alert(
        "Check product information",
        submissionResult.error
      );

      return;
    }

    try {
      const result =
        await addBarcodeToPantry(
          submissionResult.data
        );

      Alert.alert(
        "Added to pantry",
        `Your pantry now contains ${formatNumber(result.amount_remaining)}${result.measurement_unit} of this product.`
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
      <SafeAreaView
        style={
          styles.centeredContainer
        }
      >
        <ActivityIndicator
          size="large"
          color={appTheme.color("#222", "text")}
        />

        <Text
          style={styles.loadingText}
        >
          Finding your product...
        </Text>
      </SafeAreaView>
    );
  }

  const editableProduct =
    product ??
    createEmptyProduct();

  const productIdentifier =
    barcode ??
    genericProductId ??
    "";

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text
              style={styles.headerLabel}
            >
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
              color={appTheme.color("#222", "text")}
            />
          </View>
        </View>

        {lookupStatus ===
          "not-found" && (
          <View
            style={
              styles.manualEntryNotice
            }
          >
            <AppIcon
              name="information-circle-outline"
              size={23}
              color={appTheme.color("#7A5413", "text")}
            />

            <View
              style={styles.noticeContent}
            >
              <Text
                style={styles.noticeTitle}
              >
                Product not found
              </Text>

              <Text
                style={styles.noticeText}
              >
                This product could not be
                found. Check the selected
                product or enter its
                information manually.
              </Text>
            </View>
          </View>
        )}

        {lookupStatus === "error" && (
          <View
            style={
              styles.manualEntryNotice
            }
          >
            <AppIcon
              name="cloud-offline-outline"
              size={23}
              color={appTheme.color("#7A5413", "text")}
            />

            <View
              style={styles.noticeContent}
            >
              <Text
                style={styles.noticeTitle}
              >
                Product information
                unavailable
              </Text>

              <Text
                style={styles.noticeText}
              >
                We couldn't retrieve this
                product. Please try again.
              </Text>
            </View>
          </View>
        )}

        <ProductNutritionDashboard
          product={editableProduct}
          myData={
            productIdentifier
          }
          onProductChange={
            handleProductChange
          }
        />

        <Text
          style={styles.sectionTitle}
        >
          Product price
        </Text>

        <View style={styles.priceCard}>
          <Text
            style={styles.priceLabel}
          >
            Enter the total price you paid
          </Text>

          <View
            style={
              styles.inputContainer
            }
          >
            <Text
              style={
                styles.currencySymbol
              }
            >
              £
            </Text>

            <TextInput
              style={styles.input}
              value={price}
              onChangeText={
                handlePriceChange
              }
              placeholder="0.00"
              placeholderTextColor={appTheme.color("#999", "text")}
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
          onPress={
            calculateProductValue
          }
        >
          <AppIcon
            name="calculator-outline"
            size={22}
            color={appTheme.color("#222", "text")}
          />

          <Text
            style={
              styles.calculateButtonText
            }
          >
            Calculate Value
          </Text>
        </Pressable>

        {calculatedValue && (
          <ProductValueDashboard
            caloriesPerPound={
              calculatedValue
                .caloriesPerPound
            }
            proteinPerPound={
              calculatedValue
                .proteinPerPound
            }
          />
        )}

        <Pressable
          style={({ pressed }) => [
            styles.addButton,

            (pressed ||
              isAddingToPantry) &&
              styles.addButtonPressed,
          ]}
          onPress={
            addProductToPantry
          }
          disabled={
            isAddingToPantry
          }
        >
          {isAddingToPantry ? (
            <ActivityIndicator
              size="small"
              color={appTheme.color("#fff", "text")}
            />
          ) : (
            <AppIcon
              name="add"
              size={24}
              color={appTheme.color("#fff", "text")}
            />
          )}

          <Text
            style={
              styles.addButtonText
            }
          >
            {isAddingToPantry
              ? "Adding..."
              : "Add to Pantry"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProductScreen;

const baseStyles = StyleSheet.create({
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