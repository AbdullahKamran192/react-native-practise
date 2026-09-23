import { useLocalSearchParams } from "expo-router";
import ProductSearchScreen from "@/components/ProductSearchScreen";
export default function PublicMealSearch() {

  const {publicMealId,ingredientId}=useLocalSearchParams<{publicMealId:string;ingredientId:string}>();
  return <ProductSearchScreen publicMealId={publicMealId} ingredientId={ingredientId} />;
}
