import { useThemeStyles } from "@/theme/AppThemeProvider";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { usePublicMeal, usePublicMealDraft } from "@/api/publicMeals";
import { usePantryList } from "@/api/products";
import { replacementCandidates } from "@/utils/mealReplacements";
import type { MealItem } from "@/api/meals";
import { roundRecipeAmount } from "@/utils/publicMealMatching";
import { formatNumber } from "@/utils/formatNumber";
import { barcodeProductImageUrl, genericProductImageUrl } from "@/utils/productImage";
import ProductImage from "@/components/products/ProductImage";
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";
export default function PublicMealReplacement() {
  const s = useThemeStyles(baseS);

  const {publicMealId="",ingredientId=""}=useLocalSearchParams<{publicMealId:string;ingredientId:string}>();
  const meal=usePublicMeal(publicMealId),pantry=usePantryList(),{draft,setDraft}=usePublicMealDraft(publicMealId);
  if(meal.isPending || pantry.isPending) return <MealStatus loading />;
  if(meal.error || pantry.error) return <MealStatus error={(meal.error ?? pantry.error)?.message} retry={()=>{void meal.refetch();void pantry.refetch();}} />;
  const ingredient=meal.data?.ingredients.find(i=>String(i.id)===ingredientId);
  if(!ingredient || !draft) return <MealStatus error="Return to the public meal and choose an ingredient." />;
  const amount=roundRecipeAmount(Number(ingredient.amount));
  const candidates=replacementCandidates({id:ingredient.id,meal_id:0,amount,product_barcode:null,generic_product_id:ingredient.generic_product_id,product:null,generic_product:ingredient.generic_product} as MealItem,[],pantry.data ?? []);
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Text style={s.title}>Replace ingredient</Text><Text style={s.text}>{(ingredient.name?.trim() || ingredient.generic_product.product_name)} · {formatNumber(amount)}{ingredient.measurement_unit}</Text>
    <View style={s.actionRow}><MealButton equalWidth icon="search-outline" title="Search food" onPress={()=>router.push({pathname:"/publicMealSearch",params:{publicMealId,ingredientId}})} />
      <MealButton equalWidth secondary icon="barcode-outline" title="Scan food" onPress={()=>router.push({pathname:"/camera",params:{intent:"public-meal",publicMealId,ingredientId}})} /></View>
    <Text style={s.muted}>Selecting a product replaces this ingredient's full recipe amount. It does not add stock or change the public recipe.</Text>
    <Text style={s.muted}>Same-food-group suggestions are different foods from the same category. Check they suit your recipe.</Text>
    {([{title:"Exact matches",items:candidates.equivalent},{title:"Compatible family replacements",items:candidates.compatible},{title:"Similar pantry products - check suitability",items:candidates.similar},{title:"Broader food group alternatives",items:candidates.sameGroup}]).map(section=><View key={section.title} style={{gap:16}}>
      <Text style={s.heading}>{section.title}</Text>{!section.items.length && <Text style={s.muted}>No matching pantry products. You can still search or scan another food.</Text>}
      {section.items.map(row=>{const product=(row.product ?? row.generic_product)!;return <View key={row.id} style={s.card}>
        <View style={s.actionRow}><ProductImage thumbnail name={product.product_name ?? "Product"} uri={row.product_barcode?barcodeProductImageUrl(product):genericProductImageUrl(product.image_path)} /><View style={{flex:1}}><Text style={s.heading}>{product.product_name}</Text><Text style={s.muted}>{formatNumber(row.amount_remaining)}{ingredient.measurement_unit} available</Text></View></View>
        <MealButton title="Use instead" onPress={()=>{setDraft({...draft,selections:[...draft.selections.filter(s=>s.ingredient_id!==ingredient.id),{ingredient_id:ingredient.id,product_barcode:row.product_barcode,generic_product_id:row.generic_product_id,product,amount}]});router.back();}} />
      </View>;})}</View>)}
  </ScrollView>;
}
