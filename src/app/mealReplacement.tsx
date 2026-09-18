import { formatNumber } from "@/utils/formatNumber";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useMeal, useMealActions } from "@/api/meals";
import { usePantryList } from "@/api/products";
import { replacementCandidates } from "@/utils/mealReplacements";
import { ingredientAvailability } from "@/utils/mealAvailability";
import { barcodeProductImageUrl } from "@/utils/productImage";
import ProductImage from "@/components/products/ProductImage";
import { MealButton, MealStatus, mealStyles as s } from "@/components/meals/ui";

export default function MealReplacement() {
  const { mealId = "", itemId = "" } = useLocalSearchParams<{ mealId: string; itemId: string }>();
  const meal = useMeal(mealId);
  const pantry = usePantryList();
  const { replaceItem } = useMealActions();
  const refresh = useCallback(() => { void meal.refetch(); void pantry.refetch(); }, [meal.refetch, pantry.refetch]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  if (meal.isPending || pantry.isPending) return <MealStatus loading />;
  if (meal.error || pantry.error) return <MealStatus error={(meal.error ?? pantry.error)?.message} retry={refresh} />;
  const item = meal.data?.items.find(row => String(row.id) === itemId);
  if (!item?.product_barcode || !item.product) return <MealStatus error="This barcode ingredient is no longer available." />;
  const stock = pantry.data ?? [];
  if (ingredientAvailability(item, stock) >= 1) return <MealStatus error="This ingredient now has at least 100% available. Return to the meal to continue." />;
  const candidates = replacementCandidates(item, meal.data!.items, stock);
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Text style={s.title}>Replace ingredient</Text>
    <Text style={s.text}>{item.product.product_name} · {formatNumber(item.amount)}{item.product.measurement_unit} needed</Text>
    <Text style={s.muted}>Choose a product from your pantry. The recipe amount stays the same; stock is only deducted when you consume the meal.</Text>
    {replaceItem.error && <Text style={s.error} accessibilityLiveRegion="polite">{replaceItem.error.message}</Text>}
    {(["equivalent", "similar"] as const).map(section => <View key={section} style={{ gap: 14 }}>
      <Text style={s.heading}>{section === "equivalent" ? "Equivalent replacements" : "Similar pantry items"}</Text>
      {section === "similar" && <Text style={s.muted}>Not an exact replacement, but you may be able to adapt the meal.</Text>}
      {!candidates[section].length && <Text style={s.muted}>{section === "equivalent" ? "No equivalent replacements in your pantry." : "No similar pantry items found."}</Text>}
      {candidates[section].map(row => <View key={row.id} style={s.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <ProductImage thumbnail name={row.product?.product_name ?? "Product"} uri={barcodeProductImageUrl(row.product)} />
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>{row.product?.product_name}</Text>
            <Text style={s.text}>{formatNumber(row.amount_remaining)}{row.product?.measurement_unit} available</Text>
          </View>
        </View>
        {Number(row.amount_remaining) < Number(item.amount) && <Text style={s.muted}>Partial stock: this will not cover the full recipe amount.</Text>}
        <MealButton title="Use instead" disabled={replaceItem.isPending} onPress={() => {
          if (replaceItem.isPending) return;
          replaceItem.mutate({ mealId, itemId: item.id, pantryId: row.id, originalBarcode: item.product_barcode!, originalAmount: item.amount },
            { onSuccess: () => router.back() });
        }} />
      </View>)}
    </View>)}
    <MealButton secondary title="Refresh suggestions" disabled={replaceItem.isPending} onPress={refresh} />
  </ScrollView>;
}
