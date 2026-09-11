import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  usePantryList,
} from "@/api/products";

import type {
  PantryItem,
} from "@/api/products";

import {
  useUserSettings,
} from "@/api/user-settings";

import PantryDashboard from "@/components/pantry/PantryDashboard";

import type {
  PantryNutritionTotals,
} from "@/components/pantry/PantryDashboard";

import ProductListItem from "@/components/pantry/ProductListItem";

const Pantry = () => {
  const {
    data: pantryItems = [],
    error: pantryError,
    isLoading: isPantryLoading,
  } = usePantryList();

  const {
    data: userSettings,
    error: settingsError,
    isLoading: areSettingsLoading,
  } = useUserSettings();

  /*
   * Both queries are needed before the dashboard can
   * calculate how many days of nutrition remain.
   */
  if (
    isPantryLoading ||
    areSettingsLoading
  ) {
    return (
      <View
        style={
          styles.messageContainer
        }
      >
        <ActivityIndicator
          size="large"
          color="#222"
        />

        <Text
          style={styles.messageText}
        >
          Loading your pantry...
        </Text>
      </View>
    );
  }

  const error =
    pantryError ??
    settingsError;

  if (error) {
    return (
      <View
        style={
          styles.messageContainer
        }
      >
        <Ionicons
          name="alert-circle-outline"
          size={42}
          color="#C62828"
        />

        <Text
          style={styles.errorTitle}
        >
          Failed to fetch pantry
        </Text>

        <Text
          style={styles.messageText}
        >
          {error.message}
        </Text>
      </View>
    );
  }

  /*
   * Every pantry row references either:
   *
   * - a barcode product, or
   * - a generic product.
   *
   * Barcode products use product_amount.
   * Generic products use default_amount.
   *
   * Both product types store nutrition per 100g or
   * per 100ml, so the calculation remains identical:
   *
   * nutrient per 100 × amount / 100 × quantity
   */
  const totals = pantryItems.reduce(
    (
      currentTotals,
      pantryItem
    ) => {
      const barcodeProduct =
        pantryItem.product;

      const genericProduct =
        pantryItem.generic_product;

      /*
       * The database CHECK constraint should prevent
       * this, but ignoring an invalid row keeps the
       * screen safe if related data is unavailable.
       */
      if (
        !barcodeProduct &&
        !genericProduct
      ) {
        return currentTotals;
      }

      const pantryQuantity =
        Number(
          pantryItem.quantity ?? 0
        );

      const productAmount =
        Number(
          barcodeProduct
            ?.product_amount ??
          genericProduct
            ?.default_amount ??
          0
        );

      const amountMultiplier =
        (productAmount / 100) *
        pantryQuantity;

      currentTotals.calories +=
        Number(
          barcodeProduct
            ?.calories_per_100 ??
          genericProduct
            ?.calories_per_100 ??
          0
        ) * amountMultiplier;

      currentTotals.protein +=
        Number(
          barcodeProduct
            ?.protein_per_100 ??
          genericProduct
            ?.protein_per_100 ??
          0
        ) * amountMultiplier;

      currentTotals.carbs +=
        Number(
          barcodeProduct
            ?.carbs_per_100 ??
          genericProduct
            ?.carbs_per_100 ??
          0
        ) * amountMultiplier;

      currentTotals.fat +=
        Number(
          barcodeProduct
            ?.fat_per_100 ??
          genericProduct
            ?.fat_per_100 ??
          0
        ) * amountMultiplier;

      currentTotals.sugars +=
        Number(
          barcodeProduct
            ?.sugars_per_100 ??
          genericProduct
            ?.sugars_per_100 ??
          0
        ) * amountMultiplier;

      currentTotals.salt +=
        Number(
          barcodeProduct
            ?.salt_per_100 ??
          genericProduct
            ?.salt_per_100 ??
          0
        ) * amountMultiplier;

      currentTotals.fibre +=
        Number(
          barcodeProduct
            ?.fibre_per_100 ??
          genericProduct
            ?.fibre_per_100 ??
          0
        ) * amountMultiplier;

      /*
       * itemCount represents the combined number of
       * packaged and generic items in the pantry.
       */
      currentTotals.itemCount +=
        pantryQuantity;

      return currentTotals;
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sugars: 0,
      salt: 0,
      fibre: 0,
      itemCount: 0,
    }
  );

  /*
   * Calories are shown as a whole number.
   *
   * Other nutrition values keep one decimal place,
   * which is useful for smaller totals such as salt.
   */
  const nutritionTotals:
    PantryNutritionTotals = {
    calories:
      Math.round(
        totals.calories
      ),

    protein:
      Math.round(
        totals.protein * 10
      ) / 10,

    carbs:
      Math.round(
        totals.carbs * 10
      ) / 10,

    fat:
      Math.round(
        totals.fat * 10
      ) / 10,

    sugars:
      Math.round(
        totals.sugars * 10
      ) / 10,

    salt:
      Math.round(
        totals.salt * 10
      ) / 10,

    fibre:
      Math.round(
        totals.fibre * 10
      ) / 10,
  };

  return (
    <SafeAreaView
      style={styles.container}
    >
      <FlatList<PantryItem>
        data={pantryItems}
        /*
         * Every pantry row now has its own generated
         * primary-key ID.
         */
        keyExtractor={(item) =>
          String(item.id)
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.listContent
        }
        ListHeaderComponent={
          <>
            <View
              style={styles.header}
            >
              <View>
                <Text
                  style={
                    styles.headerLabel
                  }
                >
                  Your food storage
                </Text>

                <Text
                  style={styles.title}
                >
                  Pantry
                </Text>
              </View>

              <Pressable
                style={
                  styles.headerIcon
                }
                onPress={() => {
                  router.push({
                    pathname: "/camera",
                    params: {
                      intent: "pantry",
                    },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel="Add food to pantry"
              >
                <Ionicons
                  name="add"
                  size={23}
                  color="#fff"
                />
              </Pressable>
            </View>

            <PantryDashboard
              totals={
                nutritionTotals
              }
              userSettings={
                userSettings ?? null
              }
            />

            <View
              style={
                styles.sectionHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Your Products
              </Text>

              <Text
                style={
                  styles.productCount
                }
              >
                {totals.itemCount}{" "}
                {totals.itemCount === 1
                  ? "item"
                  : "items"}
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <ProductListItem
            pantryItem={item}
          />
        )}
        ListEmptyComponent={
          <View
            style={
              styles.emptyContainer
            }
          >
            <Ionicons
              name="basket-outline"
              size={40}
              color="#999"
            />

            <Text
              style={styles.emptyTitle}
            >
              Your pantry is empty
            </Text>

            <Text
              style={styles.emptyText}
            >
              Search or scan a product
              to add it to your pantry.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default Pantry;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    padding: 20,
  },

  messageText: {
    color: "#777",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },

  errorTitle: {
    color: "#222",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },

  listContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent:
      "space-between",
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

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
  },

  productCount: {
    color: "#777",
    fontSize: 14,
    fontWeight: "600",
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 50,
  },

  emptyTitle: {
    color: "#222",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
  },

  emptyText: {
    color: "#777",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
});
