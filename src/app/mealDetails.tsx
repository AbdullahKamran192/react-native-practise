import NutritionTile from "@/components/brand/NutritionTile";
import MealPhoto from "@/components/meals/MealPhoto";
import ProductImage from "@/components/products/ProductImage";
import { barcodeProductImageUrl, genericProductImageUrl } from "@/utils/productImage";
import ConsumeMeal from "@/components/meals/ConsumeMeal";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { useMeal, useMealActions } from "@/api/meals";
import type { MealItem } from "@/api/meals";
import { getMealNutrition, nutrientKeys } from "@/api/meals/validation";
import { toNumber } from "@/api/products/productLookup/utils";
import MealForm from "@/components/meals/MealForm";
import { MealButton, MealStatus, mealStyles as s } from "@/components/meals/ui";

function Ingredient({ item, mealId }: { item: MealItem; mealId: string }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(item.amount));
  const { updateItem, removeItem } = useMealActions();
  const product = item.product ?? item.generic_product;
  const imageUri = item.product
    ? barcodeProductImageUrl(item.product)
    : genericProductImageUrl(item.generic_product?.image_path);
  const busy = updateItem.isPending || removeItem.isPending;
  return <View style={s.card}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <ProductImage thumbnail uri={imageUri} name={product?.product_name ?? "Ingredient"} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.heading}>{product?.product_name ?? "Unavailable product"}</Text>
        <Text style={s.text}>{item.amount}{product?.measurement_unit ?? ""}</Text>
      </View>
    </View>
    {editing && <TextInput accessibilityLabel={`Amount of ${product?.product_name ?? "ingredient"}`} style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!busy} />}
    <View style={s.row}>
      <MealButton secondary disabled={busy} title={editing ? "Save amount" : "Edit amount"} onPress={() => {
        if (!editing) { setAmount(String(item.amount)); setEditing(true); return; }
        updateItem.mutate({ mealId, itemId: item.id, amount: toNumber(amount) ?? 0 }, { onSuccess: () => setEditing(false) });
      }} />
      {editing && <MealButton secondary title="Cancel" disabled={busy} onPress={() => setEditing(false)} />}
      <MealButton destructive icon="trash-outline" disabled={busy} title="Remove" onPress={() => Alert.alert("Remove ingredient?", product?.product_name ?? "This ingredient", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeItem.mutate({ mealId, itemId: item.id }) },
      ])} />
    </View>
    {(updateItem.error || removeItem.error) && <Text style={s.error}>{(updateItem.error ?? removeItem.error)?.message}</Text>}
  </View>;
}

export default function MealDetailsScreen() {
  const { mealId = "" } = useLocalSearchParams<{ mealId: string }>();
  const query = useMeal(mealId);
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
    <View style={s.row}>
      <MealButton icon="search-outline" title="Search food" onPress={() => router.push({ pathname: "/mealSearch", params: { intent: "meal", mealId } })} />
      <MealButton icon="barcode-outline" title="Scan barcode" secondary onPress={() => router.push({ pathname: "/camera", params: { intent: "meal", mealId } })} />
    </View>
    {meal.items.length === 0 && <Text style={s.muted}>Add ingredients and enter the amount used in this recipe.</Text>}
    {meal.items.length >= 50 && <Text style={s.muted}>Ingredient limit reached. You can still add more of a product already in this meal.</Text>}
    {meal.items.map((item) => <Ingredient key={item.id} item={item} mealId={mealId} />)}
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
