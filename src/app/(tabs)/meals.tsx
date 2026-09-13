import MealPhoto from "@/components/meals/MealPhoto";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMeals } from "@/api/meals";
import { MAX_MEALS } from "@/api/meals/validation";
import SettingsButton from "@/components/SettingsButton";
import { MealButton, MealStatus, mealStyles as s } from "@/components/meals/ui";

export default function MealsScreen() {
  const query = useMeals();
  if (query.isLoading) return <MealStatus loading />;
  if (query.error) return <MealStatus error={query.error.message} retry={() => query.refetch()} />;
  const meals = query.data ?? [];
  return <SafeAreaView style={s.screen}>
    <FlatList data={meals} keyExtractor={(meal) => String(meal.id)} contentContainerStyle={s.content}
      refreshing={query.isRefetching} onRefresh={() => query.refetch()}
      ListHeaderComponent={<View style={{ gap: 12 }}>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
          <Text style={s.title}>Meals</Text>
          <SettingsButton />
        </View>
        <Text style={s.muted}>{meals.length} / {MAX_MEALS} meals</Text>
        <MealButton title="Create meal" disabled={meals.length >= MAX_MEALS} onPress={() => router.push("/createMeal")} />
        {meals.length >= MAX_MEALS && <Text style={s.muted}>You have 10 meals. Delete one to make room for another.</Text>}
      </View>}
      ListEmptyComponent={<View style={s.card}><Text style={s.heading}>Your recipes start here</Text><Text style={s.text}>Create a meal, then add ingredients by searching or scanning food.</Text></View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.meal_name}`}
        style={s.card} onPress={() => router.push({ pathname: "/mealDetails", params: { mealId: String(item.id) } })}>
        <View style={s.row}><MealPhoto meal={item} /><Text style={[s.heading, { flex: 1 }]}>{item.meal_name}</Text><Ionicons name="chevron-forward" size={20} color="#777" /></View>
        {item.description && <Text numberOfLines={2} style={s.muted}>{item.description}</Text>}
      </Pressable>} />
  </SafeAreaView>;
}
