import { useThemeStyles } from "@/theme/AppThemeProvider";
import { formatNumber } from "@/utils/formatNumber";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useMeal, useMealActions } from "@/api/meals";
import { usePantryList } from "@/api/products";
import { replacementCandidates } from "@/utils/mealReplacements";
import { ingredientAvailability } from "@/utils/mealAvailability";
import { barcodeProductImageUrl, genericProductImageUrl } from "@/utils/productImage";
import ProductImage from "@/components/products/ProductImage";
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";

export default function MealReplacement() {
  const s = useThemeStyles(baseS);

  const { mealId = "", itemId = "" } = useLocalSearchParams<{ mealId: string; itemId: string }>();
  const meal = useMeal(mealId);
  const pantry = usePantryList();
  const { replaceItem } = useMealActions();
  const refresh = useCallback(() => { void meal.refetch(); void pantry.refetch(); }, [meal.refetch, pantry.refetch]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  if (meal.isPending || pantry.isPending) return <MealStatus loading />;
  if (meal.error || pantry.error) return <MealStatus error={(meal.error ?? pantry.error)?.message} retry={refresh} />;
  const item = meal.data?.items.find(row => String(row.id) === itemId);
  const product = item?.product ?? item?.generic_product;
  if (!item || !product) return <MealStatus error="This ingredient is no longer available." />;
  const stock = pantry.data ?? [];
  if (ingredientAvailability(item, stock) >= 1) return <MealStatus error="This ingredient now has at least 100% available. Return to the meal to continue." />;
  const candidates = replacementCandidates(item, meal.data!.items, stock);
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Text style={s.title}>Replace ingredient</Text>
    <Text style={s.text}>{product.product_name} · {formatNumber(item.amount)}{product.measurement_unit} needed</Text>
    <Text style={s.muted}>Choose a product from your pantry. The recipe amount stays the same; stock is only deducted when you consume the meal.</Text>
    <View style={s.actionRow}>
      <MealButton title="Search food" icon="search-outline" equalWidth disabled={replaceItem.isPending}
        onPress={() => router.push({ pathname: "/mealSearch", params: { mealId, replaceItemId: itemId } })} />
      <MealButton title="Scan food" icon="barcode-outline" equalWidth secondary disabled={replaceItem.isPending}
        onPress={() => router.push({ pathname: "/camera", params: { intent: "meal", mealId, replaceItemId: itemId } })} />
    </View>
    <Text style={s.muted}>Search or scan to choose a different product even if it is not in your pantry. Replacing an ingredient does not add pantry stock.</Text>
    {replaceItem.error && <Text style={s.error} accessibilityLiveRegion="polite">{replaceItem.error.message}</Text>}
    {(["equivalent", "compatible", "similar", "sameGroup"] as const).map(section => <View key={section} style={{ gap: 14 }}>
      <Text style={s.heading}>{section === "equivalent" ? "Exact matches" : section === "compatible" ? "Compatible family replacements" : section === "sameGroup" ? "Same food group" : "Similar pantry items"}</Text>
      {section === "sameGroup" && <Text style={s.muted}>Different foods in the same category. Choose one that suits your recipe.</Text>}
      {section === "similar" && <Text style={s.muted}>Not an exact replacement, but you may be able to adapt the meal.</Text>}
      {!candidates[section].length && <Text style={s.muted}>{section === "equivalent" ? "No exact matches in your pantry." : section === "compatible" ? "No compatible family replacements in your pantry." : section === "sameGroup" ? "No other foods from this group in your pantry." : "No similar pantry items found."}</Text>}
      {candidates[section].map(row => <View key={row.id} style={s.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <ProductImage thumbnail name={(row.product ?? row.generic_product)?.product_name ?? "Product"} uri={row.product_barcode ? barcodeProductImageUrl(row.product) : genericProductImageUrl(row.generic_product?.image_path)} />
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>{(row.product ?? row.generic_product)?.product_name}</Text>
            <Text style={s.text}>{formatNumber(row.amount_remaining)}{(row.product ?? row.generic_product)?.measurement_unit} available</Text>
          </View>
        </View>
        {Number(row.amount_remaining) < Number(item.amount) && <Text style={s.muted}>Partial stock: this will not cover the full recipe amount.</Text>}
        <MealButton title="Use instead" disabled={replaceItem.isPending} onPress={() => {
          if (replaceItem.isPending) return;
          replaceItem.mutate({ mealId, itemId: item.id, pantryId: row.id, originalBarcode: item.product_barcode, originalGenericId: item.generic_product_id, originalAmount: item.amount },
            { onSuccess: () => router.back() });
        }} />
      </View>)}
    </View>)}

  </ScrollView>;
}
