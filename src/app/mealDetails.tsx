import { usePantryList } from "@/api/products";
import AvailabilityRing from "@/components/meals/AvailabilityRing";
import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { ingredientAvailability } from "@/utils/mealAvailability";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";
import NutritionTile from "@/components/brand/NutritionTile";
import MealPhoto from "@/components/meals/MealPhoto";
import ProductImage from "@/components/products/ProductImage";
import { barcodeProductImageUrl, genericProductImageUrl } from "@/utils/productImage";
import ConsumeMeal from "@/components/meals/ConsumeMeal";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMeal, useMealActions } from "@/api/meals";
import type { MealItem } from "@/api/meals";
import { getMealNutrition, nutrientKeys } from "@/api/meals/validation";
import { toNumber } from "@/api/products/productLookup/utils";
import MealForm from "@/components/meals/MealForm";
import { MealButton, MealStatus, mealStyles as s } from "@/components/meals/ui";

function Ingredient({ item, mealId, progress, checking, unavailable }: { item: MealItem; mealId: string; progress: number; checking: boolean; unavailable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [amount, setAmount] = useState(String(item.amount));
  const { updateItem, removeItem } = useMealActions();
  const product = item.product ?? item.generic_product;
  const imageUri = item.product
    ? barcodeProductImageUrl(item.product)
    : genericProductImageUrl(item.generic_product?.image_path);
  const busy = updateItem.isPending || removeItem.isPending;
  return <View style={s.card}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <AvailabilityRing progress={progress} loading={checking} unavailable={unavailable}
        label={(product?.product_name ?? "Ingredient") + ": " + Math.floor(progress * 100) + "% of recipe amount available in pantry"} />
      <ProductImage thumbnail uri={imageUri} name={product?.product_name ?? "Ingredient"} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.heading}>{product?.product_name ?? "Unavailable product"}</Text>
        <Text style={s.text}>{item.amount}{product?.measurement_unit ?? ""}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={showActions ? "Hide ingredient actions" : "Edit " + (product?.product_name ?? "ingredient")}
        accessibilityState={{ expanded: showActions, disabled: busy }} disabled={busy}
        onPress={() => { setShowActions(value => !value); setEditing(false); }}
        style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, backgroundColor: brand.teal, alignItems: "center", justifyContent: "center" }}>
        <AppIcon name={showActions ? "close" : "create-outline"} size={22} color={brand.surface} />
      </Pressable>
    </View>
    {item.product_barcode && !checking && !unavailable && progress < 1 && <MealButton secondary title="Replace" disabled={busy}
      onPress={() => router.push({ pathname: "/mealReplacement", params: { mealId, itemId: String(item.id) } })} />}
    {editing && <TextInput accessibilityLabel={`Amount of ${product?.product_name ?? "ingredient"}`} style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!busy} />}
    {showActions && <View style={s.actionRow}>
      <MealButton equalWidth secondary disabled={busy} title={editing ? "Save amount" : "Edit amount"} onPress={() => {
        if (!editing) { setAmount(String(item.amount)); setEditing(true); return; }
        updateItem.mutate({ mealId, itemId: item.id, amount: toNumber(amount) ?? 0 }, { onSuccess: () => setEditing(false) });
      }} />
      <MealButton equalWidth destructive icon="trash-outline" disabled={busy} title="Remove" onPress={() => Alert.alert("Remove ingredient?", product?.product_name ?? "This ingredient", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeItem.mutate({ mealId, itemId: item.id }) },
      ])} />
    </View>}
    {editing && <MealButton secondary title="Cancel" disabled={busy} onPress={() => setEditing(false)} />}
    {(updateItem.error || removeItem.error) && <Text style={s.error}>{(updateItem.error ?? removeItem.error)?.message}</Text>}
  </View>;
}

export default function MealDetailsScreen() {
  const { mealId = "" } = useLocalSearchParams<{ mealId: string }>();
  const query = useMeal(mealId);
  const pantry = usePantryList();
  useFocusEffect(useCallback(() => { void query.refetch(); void pantry.refetch(); }, [query.refetch, pantry.refetch]));
  const { update, remove } = useMealActions();
  const [editing, setEditing] = useState(false);
  if (query.isLoading) return <MealStatus loading />;
  if (query.error || !query.data) return <MealStatus error={query.error?.message ?? "Meal not found."} retry={() => query.refetch()} />;
  const meal = query.data;
  const nutrition = getMealNutrition(meal.items);
  return <ScrollView key={mealId} style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <MealPhoto meal={meal} editable />
    {editing ? <MealForm initial={meal} saving={update.isPending} error={update.error?.message}
      onCancel={() => setEditing(false)} onSave={(values) => update.mutate({ id: mealId, values }, { onSuccess: () => setEditing(false) })} /> : <View style={s.card}>
      <Text style={s.title}>{meal.meal_name}</Text>
      {meal.description && <Text style={s.text}>{meal.description}</Text>}
      {meal.instructions && <><Text style={s.heading}>Instructions</Text><Text style={s.text}>{meal.instructions}</Text></>}
      <MealButton secondary icon="create-outline" title="Edit meal details" onPress={() => setEditing(true)} />
    </View>}
    <Text style={s.heading}>Ingredients · {meal.items.length} / 50</Text>
    <View style={s.actionRow}>
      <MealButton equalWidth icon="search-outline" title="Search food" onPress={() => router.push({ pathname: "/mealSearch", params: { intent: "meal", mealId } })} />
      <MealButton equalWidth icon="barcode-outline" title="Scan barcode" secondary onPress={() => router.push({ pathname: "/camera", params: { intent: "meal", mealId } })} />
    </View>
    {meal.items.length === 0 && <Text style={s.muted}>Add ingredients and enter the amount used in this recipe.</Text>}
    {meal.items.length >= 50 && <Text style={s.muted}>Ingredient limit reached. You can still add more of a product already in this meal.</Text>}
    {pantry.isError && <View><Text style={s.error}>Could not check pantry availability.</Text><MealButton secondary title="Retry pantry check" onPress={() => void pantry.refetch()} /></View>}
    {meal.items.map((item) => <Ingredient key={item.id} item={item} mealId={mealId} progress={ingredientAvailability(item, pantry.data ?? [])} checking={pantry.isPending} unavailable={pantry.isError} />)}
    <View style={s.card}>
      <Text style={s.heading}>Nutrition for the whole meal</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {nutrientKeys.map((key) => <NutritionTile key={key} label={key[0].toUpperCase() + key.slice(1)} value={`${Number(nutrition.totals[key].toFixed(key === "calories" ? 0 : 1))}${key === "calories" ? " kcal" : "g"}`} />)}
      </View>
      {nutrition.incomplete && <Text style={s.muted}>Some ingredient nutrition is missing. Totals include known values only.</Text>}
    </View>
    <ConsumeMeal mealId={mealId} disabled={meal.items.length === 0 || editing || update.isPending || remove.isPending} />
    {remove.error && <Text style={s.error}>{remove.error.message}</Text>}
    <MealButton destructive icon="trash-outline" disabled={remove.isPending} title={remove.isPending ? "Deleting…" : "Delete meal"} onPress={() => Alert.alert("Delete meal?", `Delete ${meal.meal_name} and its ingredient list?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate(mealId, { onSuccess: () => router.replace("/(tabs)/meals") }) },
    ])} />
  </ScrollView>;
}
