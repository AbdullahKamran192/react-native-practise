import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { searchProducts } from "@/api/products/search/searchProducts";
import type { ProductSearchResult } from "@/api/products/search/types";

const Search = () => {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [submittedSearch, setSubmittedSearch] =
    useState("");

  const [selectedProduct, setSelectedProduct] =
    useState<ProductSearchResult | null>(null);

  const {
    data: searchResults = [],
    error,
    isFetching,
  } = useQuery({
    queryKey: ["product-search", submittedSearch],

    queryFn: () => searchProducts(submittedSearch),

    /*
     * Do not query the database until the user
     * submits a non-empty search.
     */
    enabled: submittedSearch.length > 0,
  });

  /*
   * The database search happens when the user
   * presses the search button or submits the
   * keyboard.
   */
  const handleSearch = () => {
    const cleanedSearch = searchInput.trim();

    if (!cleanedSearch) {
      setSubmittedSearch("");
      return;
    }

    Keyboard.dismiss();
    setSubmittedSearch(cleanedSearch);
  };

  const handleProductPress = (
    product: ProductSearchResult
  ) => {
    Keyboard.dismiss();
    setSelectedProduct(product);
  };

  const closeActionModal = () => {
    setSelectedProduct(null);
  };

  /*
   * Search is shared by both food flows. The selected
   * intent determines which details page opens, while
   * both pages receive the same product lookup params.
   */
  const openSelectedProduct = (
    intent: "consume" | "pantry"
  ) => {
    if (!selectedProduct) {
      return;
    }

    const product = selectedProduct;

    closeActionModal();

    router.push({
      pathname:
        intent === "consume"
          ? "/productConsume"
          : "/productPantry",

      params: {
        source: product.source,
        productId: product.id,
      },
    });
  };

  const clearSearch = () => {
    setSearchInput("");
    setSubmittedSearch("");
  };

  const renderProduct = ({
    item,
  }: {
    item: ProductSearchResult;
  }) => {
    const productType =
      item.source === "barcode"
        ? "Packaged product"
        : "Generic food";

    const amountText =
      item.product_amount !== null
        ? `${item.product_amount}${item.measurement_unit}`
        : "Amount unavailable";

    return (
      <Pressable
        style={styles.productCard}
        onPress={() => handleProductPress(item)}
      >
        <View style={styles.productIcon}>
          <Ionicons
            name={
              item.source === "barcode"
                ? "barcode-outline"
                : "nutrition-outline"
            }
            size={23}
            color="#222"
          />
        </View>

        <View style={styles.productInformation}>
          <Text
            style={styles.productName}
            numberOfLines={1}
          >
            {item.product_name}
          </Text>

          <Text style={styles.productType}>
            {productType}
          </Text>

          <Text style={styles.productAmount}>
            {amountText}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={20}
          color="#999"
        />
      </Pressable>
    );
  };

  const renderEmptyComponent = () => {
    if (submittedSearch) {
      return (
        <View style={styles.messageContainer}>
          <Ionicons
            name="search-outline"
            size={42}
            color="#999"
          />

          <Text style={styles.emptyTitle}>
            No products found
          </Text>

          <Text style={styles.messageText}>
            Try searching for another product name.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.messageContainer}>
        <Ionicons
          name="basket-outline"
          size={42}
          color="#999"
        />

        <Text style={styles.emptyTitle}>
          Search your food database
        </Text>

        <Text style={styles.messageText}>
          Search for packaged products or generic
          foods such as eggs, apples and bananas.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>
          Find a food
        </Text>

        <Text style={styles.title}>Search</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color="#777"
          />

          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleSearch}
            placeholder="Search for a food"
            placeholderTextColor="#999"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searchInput.length > 0 && (
            <Pressable onPress={clearSearch}>
              <Ionicons
                name="close-circle"
                size={20}
                color="#999"
              />
            </Pressable>
          )}
        </View>

        <Pressable
          style={styles.searchButton}
          onPress={handleSearch}
        >
          <Ionicons
            name="search"
            size={21}
            color="#fff"
          />
        </Pressable>
      </View>

      {isFetching ? (
        <View style={styles.messageContainer}>
          <ActivityIndicator
            size="large"
            color="#222"
          />

          <Text style={styles.messageText}>
            Searching products...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.messageContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={42}
            color="#C62828"
          />

          <Text style={styles.errorTitle}>
            Search failed
          </Text>

          <Text style={styles.messageText}>
            {error.message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) =>
            `${item.source}-${item.id}`
          }
          renderItem={renderProduct}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            submittedSearch &&
            searchResults.length > 0 ? (
              <Text style={styles.resultsText}>
                Results for “{submittedSearch}”
              </Text>
            ) : null
          }
          ListEmptyComponent={renderEmptyComponent}
        />
      )}

      <Modal
        visible={selectedProduct !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeActionModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeActionModal}
            accessibilityRole="button"
            accessibilityLabel="Close food action menu"
          />

          <View
            style={styles.modalCard}
            accessibilityViewIsModal
          >
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              What would you like to do?
            </Text>

            <Text
              style={styles.modalProductName}
              numberOfLines={2}
            >
              {selectedProduct?.product_name}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.modalPrimaryButton,
                pressed && styles.modalButtonPressed,
              ]}
              onPress={() =>
                openSelectedProduct("consume")
              }
            >
              <View style={styles.modalPrimaryIcon}>
                <Ionicons
                  name="restaurant-outline"
                  size={21}
                  color="#fff"
                />
              </View>

              <View style={styles.modalButtonInformation}>
                <Text style={styles.modalPrimaryTitle}>
                  Consume Food
                </Text>

                <Text style={styles.modalPrimaryDescription}>
                  Record an amount in today&apos;s nutrition
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#fff"
              />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.modalSecondaryButton,
                pressed && styles.modalButtonPressed,
              ]}
              onPress={() =>
                openSelectedProduct("pantry")
              }
            >
              <View style={styles.modalSecondaryIcon}>
                <Ionicons
                  name="basket-outline"
                  size={21}
                  color="#222"
                />
              </View>

              <View style={styles.modalButtonInformation}>
                <Text style={styles.modalSecondaryTitle}>
                  Add to Pantry
                </Text>

                <Text style={styles.modalSecondaryDescription}>
                  Save this food to your pantry
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#777"
              />
            </Pressable>

            <Pressable
              style={styles.modalCancelButton}
              onPress={closeActionModal}
            >
              <Text style={styles.modalCancelText}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Search;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    paddingHorizontal: 20,
  },

  header: {
    marginTop: 8,
    marginBottom: 22,
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

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  searchInputContainer: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 15,
  },

  searchInput: {
    flex: 1,
    color: "#222",
    fontSize: 15,
    marginHorizontal: 10,
  },

  searchButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },

  listContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  resultsText: {
    color: "#777",
    fontSize: 13,
    marginBottom: 12,
  },

  productCard: {
    minHeight: 90,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 15,
    marginBottom: 11,
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

  productType: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  productAmount: {
    color: "#999",
    fontSize: 11,
    marginTop: 3,
  },

  messageContainer: {
    flex: 1,
    minHeight: 300,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  messageText: {
    color: "#777",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 9,
  },

  errorTitle: {
    color: "#222",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },

  emptyTitle: {
    color: "#222",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
    padding: 16,
  },

  modalCard: {
    width: "100%",
    backgroundColor: "#F7F7F7",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
  },

  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D0D0D0",
    alignSelf: "center",
    marginBottom: 18,
  },

  modalTitle: {
    color: "#222",
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
  },

  modalProductName: {
    color: "#777",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
    marginBottom: 20,
    paddingHorizontal: 12,
  },

  modalPrimaryButton: {
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: "#222",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 10,
  },

  modalSecondaryButton: {
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  modalButtonPressed: {
    opacity: 0.78,
  },

  modalPrimaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#3B3B3B",
    justifyContent: "center",
    alignItems: "center",
  },

  modalSecondaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  modalButtonInformation: {
    flex: 1,
    marginHorizontal: 13,
  },

  modalPrimaryTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  modalPrimaryDescription: {
    color: "#C7C7C7",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  modalSecondaryTitle: {
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
  },

  modalSecondaryDescription: {
    color: "#777",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  modalCancelButton: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  modalCancelText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "600",
  },
});
