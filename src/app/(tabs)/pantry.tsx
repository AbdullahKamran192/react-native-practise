import DeletePantryButton from "@/components/pantry/DeletePantryButton";
import { AppIcon } from "@/components/brand/AppIcon";
import { useEffect, useRef, useState } from "react";
import { brand } from "@/components/brand/theme";
import { router } from "expo-router";

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { getPantryAmounts } from "@/utils/pantryAmounts";

const PAGE_SIZE = 50;

const Pantry = () => {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const listRef = useRef<FlatList<PantryItem>>(null);
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

  const searchTerm = searchText.trim().toLowerCase();
  const matchingItems = searchTerm
    ? pantryItems.filter(item =>
        (item.product?.product_name ?? item.generic_product?.product_name ?? "")
          .toLowerCase().includes(searchTerm))
    : pantryItems;
  const pageCount = Math.max(1, Math.ceil(matchingItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = matchingItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function updateSearch(value: string) {
    setSearchText(value);
    setPage(1);
  }
  // Consuming stock can remove the last page.
  useEffect(() => {
    setPage(previous => Math.min(previous, pageCount));
  }, [pageCount]);

  function goToPage(nextPage: number) {
    setPage(Math.max(1, Math.min(nextPage, pageCount)));
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  const pagination = pageCount > 1 ? (
    <View style={styles.pagination}>
      <Text style={styles.pageSummary} accessibilityLiveRegion="polite">
        {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, matchingItems.length)} of {matchingItems.length} products
      </Text>
      <View style={styles.pageControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous pantry page"
          accessibilityState={{ disabled: currentPage === 1 }} disabled={currentPage === 1}
          onPress={() => goToPage(currentPage - 1)} style={[styles.pageButton, currentPage === 1 && styles.pageDisabled]}>
          <AppIcon name="chevron-back" size={18} color={brand.teal} />
          <Text style={styles.pageText}>Previous</Text>
        </Pressable>
        <Text style={styles.pageSummary}>Page {currentPage} of {pageCount}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next pantry page"
          accessibilityState={{ disabled: currentPage === pageCount }} disabled={currentPage === pageCount}
          onPress={() => goToPage(currentPage + 1)} style={[styles.pageButton, currentPage === pageCount && styles.pageDisabled]}>
          <Text style={styles.pageText}>Next</Text>
          <AppIcon name="chevron-forward" size={18} color={brand.teal} />
        </Pressable>
      </View>
      <View style={styles.pageNumbers}>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(number => (
          <Pressable key={number} accessibilityRole="button" accessibilityLabel={`Pantry page ${number}`}
            accessibilityState={{ selected: number === currentPage }} onPress={() => goToPage(number)}
            style={[styles.pageNumber, number === currentPage && styles.selectedPage]}>
            <Text style={[styles.pageText, number === currentPage && styles.selectedPageText]}>{number}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  ) : null;

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
        <AppIcon
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

  // Nutrition comes directly from the remaining g/ml, independent of package size.
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

      const { amountRemaining } = getPantryAmounts(pantryItem);
      const amountMultiplier = amountRemaining / 100;

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
        ref={listRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={pageItems}
        ListFooterComponent={pagination}
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
                <AppIcon
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


            <Pressable accessibilityRole="button" accessibilityLabel={editing ? "Stop editing pantry" : "Edit pantry products"}
              accessibilityState={{ selected: editing }} onPress={() => setEditing(value => !value)} style={styles.editButton}>
              <AppIcon name={editing ? "close" : "create-outline"} size={20} color={brand.surface} />
              <Text style={{ color: brand.surface, fontWeight: "600" }}>{editing ? "Done" : "Edit"}</Text>
            </Pressable>
            </View>
            <View style={styles.searchBar}>
              <AppIcon name="search-outline" size={22} color={brand.teal} accessible={false} />
              <TextInput
                value={searchText}
                onChangeText={updateSearch}
                placeholder="Search your pantry"
                placeholderTextColor={brand.muted}
                accessibilityLabel="Search pantry products by name"
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={styles.searchInput}
              />
              {searchText.length > 0 && (
                <Pressable onPress={() => updateSearch("")} accessibilityRole="button"
                  accessibilityLabel="Clear pantry search" style={styles.clearSearch}>
                  <AppIcon name="close-circle" size={22} color={brand.muted} />
                </Pressable>
              )}
            </View>
            <Text style={[styles.productCount, { marginBottom: 14, textAlign: "left" }]}>
              {matchingItems.length} {matchingItems.length === 1 ? "product" : "products"}
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: editing ? 10 : 0 }}>
            <View style={{ flex: 1 }}><ProductListItem pantryItem={item} /></View>
            {editing && <DeletePantryButton item={item} />}
          </View>
        )}
        ListEmptyComponent={
          <View
            style={
              styles.emptyContainer
            }
          >
            <AppIcon
              name="basket-outline"
              size={40}
              color="#999"
            />

            <Text
              style={styles.emptyTitle}
            >
              {searchTerm ? "No matching products" : "Your pantry is empty"}
            </Text>

            <Text
              style={styles.emptyText}
            >
              {searchTerm ? "Try another name or clear your search." : "Search or scan a product to add it to your pantry."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default Pantry;

const styles = StyleSheet.create({
  editButton: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: brand.teal },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: brand.surface, borderWidth: 1, borderColor: brand.border, borderRadius: 16, paddingLeft: 14, paddingRight: 6, marginBottom: 18 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 52, fontSize: 16, color: brand.ink, paddingVertical: 12 },
  clearSearch: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  pagination: { gap: 12, paddingVertical: 18 },
  pageSummary: { color: brand.muted, fontSize: 13, textAlign: "center" },
  pageControls: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pageButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: brand.paleTeal },
  pageNumbers: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  pageNumber: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: brand.paleTeal },
  pageText: { color: brand.deepTeal, fontSize: 14, fontWeight: "600" },
  selectedPage: { backgroundColor: brand.teal },
  selectedPageText: { color: brand.surface },
  pageDisabled: { opacity: 0.4 },
  container: {
    flex: 1,
    backgroundColor: "#F3FAFB",
  },

  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3FAFB",
    padding: 20,
  },

  messageText: {
    color: "#617783",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },

  errorTitle: {
    color: "#102739",
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
    color: "#617783",
    fontSize: 14,
    marginBottom: 4,
  },

  title: {
    color: "#102739",
    fontSize: 38,
    fontWeight: "700",
  },

  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#007F95",
    justifyContent: "center",
    alignItems: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    gap: 8,
    justifyContent:
      "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 14,
  },

  sectionTitle: {
    flexShrink: 1,
    color: "#102739",
    fontSize: 19,
    fontWeight: "700",
  },

  productCount: {
    color: "#617783",
    fontSize: 14,
    fontWeight: "600",
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 50,
  },

  emptyTitle: {
    color: "#102739",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
  },

  emptyText: {
    color: "#617783",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
});
