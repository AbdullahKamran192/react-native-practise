import { useThemeStyles } from "@/theme/AppThemeProvider";
import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { supabase } from "@/lib/supabase";
import { saveBarcodeProduct, type GenericProductRow, type ProductRow } from "@/api/products";
import { usePublicMeal, usePublicMealDraft } from "@/api/publicMeals";
import useSelectedProduct, { type ProductSource } from "@/hooks/products/useSelectedProduct";
import { createProductSubmission } from "@/utils/productSubmission";
import { roundRecipeAmount } from "@/utils/publicMealMatching";
import ProductReadOnlyDashboard from "@/components/products/ProductReadOnlyDashboard";
import ProductNutritionDashboard from "@/components/products/ProductNutritionDashboard";
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";
export default function PublicMealProduct() {
  const s = useThemeStyles(baseS);

  const {publicMealId="",ingredientId="",data,source,productId}=useLocalSearchParams<{publicMealId:string;ingredientId:string;data?:string;source?:ProductSource;productId?:string}>();
  const meal=usePublicMeal(publicMealId),{draft,setDraft}=usePublicMealDraft(publicMealId);
  const selected=useSelectedProduct({data,source,productId});
  const [editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const lock=useRef(false);
  const ingredient=meal.data?.ingredients.find(i=>String(i.id)===ingredientId),product=selected.product;
  async function choose() {
    if(lock.current || !ingredient || !product || !draft || !meal.data) return;
    lock.current=true;setSaving(true);setError("");
    try {
      if(product.measurement_unit!==ingredient.measurement_unit) throw new Error("Choose a product with the same measurement unit as this ingredient.");
      if(!selected.isGenericProduct) {
        const submission=createProductSubmission(selected.barcode!,product);
        if(!submission.success) throw new Error(submission.error);
        if(!submission.data.product_name) throw new Error("Enter a product name first.");
        await saveBarcodeProduct(submission.data);
      }
      const generic=selected.isGenericProduct;
      const result=await supabase.from(generic?"generic_products":"products").select("*")
        .eq(generic?"id":"barcode_number",generic?selected.genericProductId!:selected.barcode!).single();
      if(result.error) throw result.error;
      if(result.data.measurement_unit!==ingredient.measurement_unit) throw new Error("The saved product uses a different unit. Choose another product.");
      setDraft({...draft,selections:[...draft.selections.filter(s=>s.ingredient_id!==ingredient.id),{
        ingredient_id:ingredient.id,product_barcode:generic?null:selected.barcode!,generic_product_id:generic?Number(selected.genericProductId):null,
        amount:roundRecipeAmount(Number(ingredient.amount)),product:result.data as ProductRow|GenericProductRow,
      }]});
      router.dismissTo({pathname:"/publicMealDetails",params:{publicMealId}});
    } catch(e){setError(e instanceof Error?e.message:"Could not select product.");}finally{lock.current=false;setSaving(false);}
  }
  if(meal.isPending || selected.isLoading) return <MealStatus loading />;
  if(!product || !ingredient || !draft) return <MealStatus error="Return to the recipe and choose an ingredient again." />;
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Text style={s.heading}>Replace {(ingredient.name?.trim() || ingredient.generic_product.product_name)}</Text>
    {editing && !selected.isGenericProduct ? <><ProductNutritionDashboard product={product} myData={selected.productIdentifier} onProductChange={selected.setProduct} /><MealButton secondary title="Done editing" onPress={()=>setEditing(false)} /></>
      : <ProductReadOnlyDashboard product={product} isGenericProduct={selected.isGenericProduct} onEdit={selected.isGenericProduct || saving?undefined:()=>setEditing(true)} />}
    <Text style={s.muted}>Use this product for the recipe amount. Your pantry will not change until you log the meal with pantry deduction selected.</Text>
    {!!error && <Text style={s.error}>{error}</Text>}
    <MealButton title={saving?"Saving…":"Use as replacement"} disabled={saving} onPress={()=>void choose()} />
  </ScrollView>;
}
