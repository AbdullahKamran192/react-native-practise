import { usePantryList } from "@/api/products";
import AvailabilityRing from "@/components/meals/AvailabilityRing";
import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { mealAvailability } from "@/utils/mealAvailability";
import MealPhoto from "@/components/meals/MealPhoto";
import { BrandArtwork, MealsBackdrop } from "@/components/brand/Artwork";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AppIcon } from "@/components/brand/AppIcon";
import { useMeals } from "@/api/meals";
import { MAX_MEALS } from "@/api/meals/validation";
import SettingsButton from "@/components/SettingsButton";
import { MealButton, MealStatus, mealStyles as s } from "@/components/meals/ui";

export default function MealsScreen() {
  const query = useMeals();
  const pantry = usePantryList();
  useFocusEffect(useCallback(() => { void query.refetch(); void pantry.refetch(); }, [query.refetch, pantry.refetch]));
  if (query.isLoading) return <MealStatus loading />;
  if (query.error) return <MealStatus error={query.error.message} retry={() => query.refetch()} />;
  const meals = query.data ?? [];
  return <SafeAreaView style={s.screen}>
    <MealsBackdrop />
    <FlatList data={meals} keyExtractor={(meal) => String(meal.id)} contentContainerStyle={s.content}
      refreshing={query.isRefetching || pantry.isRefetching} onRefresh={() => { void query.refetch(); void pantry.refetch(); }}
      ListHeaderComponent={<View style={{ gap: 20, marginBottom: 20 }}>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
          <Text style={[s.title, { fontSize: 38 }]}>Meals</Text>
          <SettingsButton />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
          <View style={{ flex: 1, gap: 10 }}>
            <Text style={s.heading}>{meals.length} / {MAX_MEALS} meals</Text>
            <Text style={s.muted}>Your favourite meals and their nutrition, in one place.</Text>
          </View>
          <BrandArtwork name="mealsHero" size={88} />
        </View>
        <MealButton icon="basket-outline" title="Create meal" disabled={meals.length >= MAX_MEALS} onPress={() => router.push("/createMeal")} />
        {meals.length >= MAX_MEALS && <Text style={s.muted}>You have 10 meals. Delete one to make room for another.</Text>}
      </View>}
      ListEmptyComponent={<View style={s.card}><Text style={s.heading}>Your recipes start here</Text><Text style={s.text}>Create a meal, then add ingredients by searching or scanning food.</Text></View>}
      renderItem={({ item }) => {
        const availability = mealAvailability(item.items ?? [], pantry.data ?? []);
        return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.meal_name}`}
        style={[s.card, { marginBottom: 16 }]} onPress={() => router.push({ pathname: "/mealDetails", params: { mealId: String(item.id) } })}>
        <View style={s.row}><MealPhoto meal={item} /><Text style={[s.heading, { flex: 1 }]}>{item.meal_name}</Text><AppIcon name="chevron-forward" size={20} color="#777" /></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AvailabilityRing progress={availability.progress} loading={pantry.isPending} unavailable={pantry.isError}
            label={availability.available + " of " + availability.total + " ingredients have enough pantry stock"} />
          <Text style={[s.muted, { flex: 1 }]}>{pantry.isError ? "Could not check pantry stock" : pantry.isPending ? "Checking pantry stock?" : availability.total === 0 ? "No ingredients yet" : availability.available + " / " + availability.total + " ingredients ready"}</Text>
        </View>
        {item.description && <Text numberOfLines={2} style={s.muted}>{item.description}</Text>}
      </Pressable>; }} />
  </SafeAreaView>;
}
