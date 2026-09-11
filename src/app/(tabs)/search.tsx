import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  Keyboard,
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

  const [searchInput, setSearchInput] =
    useState("");

  const [submittedSearch, setSubmittedSearch] =
    useState("");

  const {
    data: searchResults = [],
    error,
    isFetching,
  } = useQuery({
    queryKey: [
      "product-search",
      submittedSearch,
    ],

    queryFn: () =>
      searchProducts(submittedSearch),

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
    const cleanedSearch =
      searchInput.trim();

    if (!cleanedSearch) {
      setSubmittedSearch("");
      return;
    }

    Keyboard.dismiss();
    setSubmittedSearch(cleanedSearch);
  };

  /*
   * Both product types open the product-details
   * page.
   *
   * product.tsx will use source to determine whether
   * productId contains a barcode or a generic-product
   * database ID.
   */
  const handleProductPress = (
    product: ProductSearchResult
  ) => {
    router.push({
      pathname: "/product",

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
        onPress={() =>
          handleProductPress(item)
        }
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
          Find something to add
        </Text>

        <Text style={styles.title}>
          Search
        </Text>
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
          contentContainerStyle={
            styles.listContent
          }
          ListHeaderComponent={
            submittedSearch &&
            searchResults.length > 0 ? (
              <Text style={styles.resultsText}>
                Results for “{submittedSearch}”
              </Text>
            ) : null
          }
          ListEmptyComponent={
            renderEmptyComponent
          }
        />
      )}
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
});