import { router } from "expo-router";
import { ScrollView, Text } from "react-native";
import { useMealActions } from "@/api/meals";
import MealForm from "@/components/meals/MealForm";
import { mealStyles as s } from "@/components/meals/ui";

export default function CreateMealScreen() {
  const { create } = useMealActions();
  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Create meal</Text>
    <Text style={s.muted}>Save your meal first, then choose its ingredients.</Text>
    <MealForm saving={create.isPending} error={create.error?.message} onSave={(values) => {
      create.mutate(values, { onSuccess: (meal) => router.replace({ pathname: "/mealDetails", params: { mealId: String(meal.id) } }) });
    }} />
  </ScrollView>;
}
