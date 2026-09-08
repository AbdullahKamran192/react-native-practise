import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import PantryDashboard from "@/components/pantry/PantryDashboard";
import { products } from "@/data/products";

const Pantry = () => {
  let caloriesTotal = 0;
  let proteinTotal = 0;

  products.forEach((product) => {
    caloriesTotal += product.calories;
    proteinTotal += product.protein;
  });

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item, index) => `${item.name}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerLabel}>Your food storage</Text>
                <Text style={styles.title}>Pantry</Text>
              </View>

              <View style={styles.headerIcon}>
                <Ionicons
                  name="basket-outline"
                  size={23}
                  color="#222"
                />
              </View>
            </View>

            <PantryDashboard
              caloriesTotal={caloriesTotal}
              proteinTotal={proteinTotal}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Products</Text>

              <Text style={styles.productCount}>
                {products.length} items
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={styles.productIcon}>
              <Ionicons
                name="nutrition-outline"
                size={23}
                color="#222"
              />
            </View>

            <View style={styles.productInformation}>
              <Text style={styles.productName}>{item.name}</Text>

              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionText}>
                  {item.calories} kcal
                </Text>

                <View style={styles.dot} />

                <Text style={styles.nutritionText}>
                  {item.protein}g protein
                </Text>
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#999"
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="basket-outline"
              size={40}
              color="#999"
            />

            <Text style={styles.emptyTitle}>Your pantry is empty</Text>

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

  listContent: {
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
    backgroundColor: "#EDEDED",
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

  productCard: {
    minHeight: 84,
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

  productName: {
    color: "#222",
    fontSize: 16,
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

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#BDBDBD",
    marginHorizontal: 8,
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