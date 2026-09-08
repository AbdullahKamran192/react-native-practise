import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { usePantryList } from "@/api/products";
import PantryDashboard from "@/components/pantry/PantryDashboard";
import ProductListItem, {
  PantryItem,
} from "@/components/pantry/ProductListItem";

const Pantry = () => {
  const {
    data: supabasePantryRows = [],
    error,
    isLoading,
  } = usePantryList();

  if (isLoading) {
    return (
      <View style={styles.messageContainer}>
        <ActivityIndicator size="large" color="#222" />

        <Text style={styles.messageText}>
          Loading your pantry...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.messageContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={42}
          color="#C62828"
        />

        <Text style={styles.errorTitle}>
          Failed to fetch pantry
        </Text>

        <Text style={styles.messageText}>
          {error.message}
        </Text>
      </View>
    );
  }

  const pantryItems =
    supabasePantryRows as PantryItem[];

  const totals = pantryItems.reduce(
    (currentTotals, pantryItem) => {
      const product = pantryItem.product;

      const quantity = Number(
        pantryItem.quantity ?? 0
      );

      const weight = Number(
        product.product_weight ?? 0
      );

      const caloriesPer100g = Number(
        product.calories_per_100g ?? 0
      );

      const proteinPer100g = Number(
        product.protein_per_100g ?? 0
      );

      currentTotals.calories +=
        caloriesPer100g *
        (weight / 100) *
        quantity;

      currentTotals.protein +=
        proteinPer100g *
        (weight / 100) *
        quantity;

      currentTotals.itemCount += quantity;

      return currentTotals;
    },
    {
      calories: 0,
      protein: 0,
      itemCount: 0,
    }
  );

  const caloriesTotal = Math.round(
    totals.calories
  );

  const proteinTotal =
    Math.round(totals.protein * 10) / 10;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={pantryItems}
        keyExtractor={(item) =>
          `${item.user_id}-${item.product_barcode}`
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerLabel}>
                  Your food storage
                </Text>

                <Text style={styles.title}>
                  Pantry
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Ionicons
                  name="add"
                  size={23}
                  color="#fff"
                />
              </View>
            </View>

            <PantryDashboard
              caloriesTotal={caloriesTotal}
              proteinTotal={proteinTotal}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Your Products
              </Text>

              <Text style={styles.productCount}>
                {totals.itemCount}{" "}
                {totals.itemCount === 1
                  ? "item"
                  : "items"}
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <ProductListItem pantryItem={item} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="basket-outline"
              size={40}
              color="#999"
            />

            <Text style={styles.emptyTitle}>
              Your pantry is empty
            </Text>

            <Text style={styles.emptyText}>
              Scan a product to add it to your pantry.
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
    justifyContent: "space-between",
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
  },
});