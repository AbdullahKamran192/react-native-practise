import { brand } from "@/components/brand/theme";
import { AppIcon } from "@/components/brand/AppIcon";
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
import SettingsButton from "@/components/SettingsButton";
import ProductImage from "@/components/products/ProductImage";

const Search = ({ mealId }: { mealId?: string }) => {
  const router = useRouter();

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [submittedSearch, setSubmittedSearch] =
    useState("");

  const [selectedProduct, setSelectedProduct] =
    useState<ProductSearchResult | null>(null);

  const {
    data: resultPage,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["product-search", "no-count", submittedSearch, page],

    queryFn: () => searchProducts(submittedSearch, page),

    /*
     * Do not query the database until the user
     * submits a non-empty search.
     */
    enabled: submittedSearch.length > 0,
  });

  const searchResults = resultPage?.items ?? [];
  const hasNext = resultPage?.hasNext ?? false;

  /*
   * The database search happens when the user
   * presses the search button or submits the
   * keyboard.
   */
  const handleSearch = () => {
    setPage(0);
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
    if (mealId) {
      router.push({
        pathname: "/mealIngredient",
        params: { mealId, source: product.source, productId: product.id },
      });
      return;
    }
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
    setPage(0);
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
        style={({ pressed }) => [styles.productCard, pressed && styles.modalButtonPressed]}
        onPress={() => handleProductPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.product_name}, ${productType}, ${amountText}`}
      >
        <ProductImage uri={item.image_url} name={item.product_name} compact />

        <View style={styles.productInformation}>
          <Text
            style={styles.productName}
            numberOfLines={2}
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

      </Pressable>
    );
  };

  const renderEmptyComponent = () => {
    if (submittedSearch) {
      return (
        <View style={styles.messageContainer}>
          <AppIcon
            name="search-outline"
            size={42}
            color={brand.muted}
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
        <AppIcon
          name="basket-outline"
          size={42}
          color={brand.muted}
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
    <SafeAreaView style={styles.container} edges={mealId ? ["left", "right", "bottom"] : ["top", "left", "right", "bottom"]}>
      <View style={[styles.header, {flexDirection:"row",alignItems:"center",justifyContent:"space-between"}]}>
        <View>
        <Text style={styles.headerLabel}>
          {mealId ? "Choose an ingredient" : "Find a food"}
        </Text>

        <Text style={styles.title}>Search</Text>
        </View>
        {!mealId && <SettingsButton themed />}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <AppIcon
            name="search-outline"
            size={20}
            color={brand.muted}
          />

          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleSearch}
            placeholder="Search for a food"
            placeholderTextColor={brand.muted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searchInput.length > 0 && (
            <Pressable onPress={clearSearch}>
              <AppIcon
                name="close-circle"
                size={20}
                color={brand.muted}
              />
            </Pressable>
          )}
        </View>

        <Pressable
          style={styles.searchButton}
          onPress={handleSearch}
        >
          <AppIcon
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
            color={brand.deepTeal}
          />

          <Text style={styles.messageText}>
            Searching products...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.messageContainer}>
          <AppIcon
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
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.pageButton}><Text style={styles.pageButtonText}>Try again</Text></Pressable>
        </View>
      ) : (
        <FlatList
          numColumns={2}
          columnWrapperStyle={styles.productRow}
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
          ListFooterComponent={submittedSearch && (page > 0 || hasNext) ? <View style={styles.pagination}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous search page" disabled={page === 0}
              style={[styles.pageButton, page === 0 && { opacity: 0.4 }]} onPress={() => setPage(p => p - 1)}>
              <Text style={styles.pageButtonText}>Previous</Text>
            </Pressable>
            <Text style={styles.pageLabel}>Page {page + 1}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next search page" disabled={!hasNext}
              style={[styles.pageButton, !hasNext && { opacity: 0.4 }]} onPress={() => setPage(p => p + 1)}>
              <Text style={styles.pageButtonText}>Next</Text>
            </Pressable>
          </View> : null}
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
                <AppIcon
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

              <AppIcon
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
                <AppIcon
                  name="basket-outline"
                  size={21}
                  color={brand.deepTeal}
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

              <AppIcon
                name="chevron-forward"
                size={20}
                color={brand.muted}
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
  pagination: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 16 },
  pageButton: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: brand.paleTeal, justifyContent: "center" },
  pageButtonText: { color: brand.deepTeal, fontWeight: "600", fontSize: 15 },
  pageLabel: { color: brand.muted, fontSize: 14 },
  container: {
    flex: 1,
    backgroundColor: brand.background,
    paddingHorizontal: 20,
  },

  header: {
    marginTop: 8,
    marginBottom: 22,
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
    color: brand.ink,
    fontSize: 15,
    marginHorizontal: 10,
  },

  searchButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: brand.teal,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },

  listContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  resultsText: {
    color: brand.muted,
    fontSize: 13,
    marginBottom: 12,
  },

  productCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
  },

  productRow: {
    justifyContent: "space-between",
    alignItems: "stretch",
  },

  productInformation: {
    flex: 1,
    padding: 12,
  },

  productName: {
    color: brand.ink,
    fontSize: 16,
    fontWeight: "700",
  },

  productType: {
    color: brand.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  productAmount: {
    color: brand.muted,
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
    color: brand.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 9,
  },

  errorTitle: {
    color: brand.ink,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },

  emptyTitle: {
    color: brand.ink,
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
    backgroundColor: brand.background,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
  },

  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: brand.border,
    alignSelf: "center",
    marginBottom: 18,
  },

  modalTitle: {
    color: brand.ink,
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
  },

  modalProductName: {
    color: brand.muted,
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
    backgroundColor: brand.teal,
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
    backgroundColor: brand.deepTeal,
    justifyContent: "center",
    alignItems: "center",
  },

  modalSecondaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: brand.paleTeal,
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
    color: "#E5F6F4",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  modalSecondaryTitle: {
    color: brand.ink,
    fontSize: 16,
    fontWeight: "700",
  },

  modalSecondaryDescription: {
    color: brand.muted,
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
    color: brand.muted,
    fontSize: 15,
    fontWeight: "600",
  },
});
