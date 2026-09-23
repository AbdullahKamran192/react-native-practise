import { useLocalSearchParams } from "expo-router";
import ProductSearchScreen from "@/components/ProductSearchScreen";
import { MealStatus } from "@/components/meals/ui";

export default function MealSearchScreen() {

  const { mealId, replaceItemId } = useLocalSearchParams<{ mealId: string; replaceItemId?: string }>();
  if (!mealId || !/^[1-9][0-9]*$/.test(mealId)) return <MealStatus error="Open a meal before choosing ingredients." />;
  return <ProductSearchScreen mealId={mealId} replaceItemId={replaceItemId} />;
}
