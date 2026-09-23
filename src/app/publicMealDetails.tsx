import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { usePantryList } from "@/api/products";
import { savePublicMeal, selectionPayload, usePublicMeal, usePublicMealDraft } from "@/api/publicMeals";
import { initialPublicMeal, matchPublicMeal, selectionCoverage } from "@/utils/publicMealMatching";
import { replacementCandidates } from "@/utils/mealReplacements";
import type { MealItem } from "@/api/meals";
import { formatNumber } from "@/utils/formatNumber";
import { barcodeProductImageUrl, genericProductImageUrl } from "@/utils/productImage";
import ProductImage from "@/components/products/ProductImage";
import AvailabilityRing from "@/components/meals/AvailabilityRing";
import ConsumeMeal from "@/components/meals/ConsumeMeal";
import { nutrients } from "@/components/brand/theme";
import { AppIcon } from "@/components/brand/AppIcon";
import { nutrientKeys } from "@/api/meals/validation";
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";

export default function PublicMealDetails() {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  const { publicMealId = "" } = useLocalSearchParams<{ publicMealId: string }>();
  const query=usePublicMeal(publicMealId), pantry=usePantryList();
  const {draft,setDraft}=usePublicMealDraft(publicMealId);
  const client=useQueryClient();
  const [saving,setSaving]=useState(false), [checking,setChecking]=useState(false), [error,setError]=useState("");
  const [savedId,setSavedId]=useState<string|null>(null);
  const saveLock=useRef(false);
  useEffect(()=>{ if(query.data && !draft) setDraft(initialPublicMeal(query.data)); },[query.data,draft]);
  useEffect(()=>setSavedId(null),[draft]);
  if(query.isPending) return <MealStatus loading />;
  if(query.error || !query.data) return <MealStatus error={query.error?.message ?? "Recipe unavailable"} retry={()=>void query.refetch()} />;
  if(!draft) return <MealStatus loading />;
  const meal=query.data, coverage=selectionCoverage(draft.selections,pantry.data ?? []);
  const required=meal.ingredients.filter(i=>!i.is_optional);
  const overall=required.length ? required.reduce((sum,i)=>{const c=coverage.get(i.id);return sum+(c?.needed ? c.available/c.needed : 0);},0)/required.length : 0;
  async function checkPantry() {
    setChecking(true);setError("");
    try { const result=await pantry.refetch(); if(result.error) throw result.error; setDraft(matchPublicMeal(meal,result.data ?? []));setSavedId(null); }
    catch(e){setError(e instanceof Error?e.message:"Could not check pantry.");} finally{setChecking(false);}
  }
  async function save() {
    if(saveLock.current) return;
    saveLock.current=true;
    setSaving(true);setError("");
    try { const id=await savePublicMeal(publicMealId,draft!);setSavedId(id);await client.invalidateQueries({queryKey:["meals"]}); }
    catch(e){setError(e instanceof Error?e.message:"Could not save meal.");}finally{saveLock.current=false;setSaving(false);}
  }
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={s.card}><ProductImage aspectRatio={4 / 3} name={meal.meal_name} uri={genericProductImageUrl(meal.image_path)} /><Text style={s.title}>{meal.meal_name}</Text>
      {!!meal.description && <Text style={s.text}>{meal.description}</Text>}
      {!!meal.instructions && <><Text style={s.heading}>Instructions</Text><Text style={s.text}>{meal.instructions}</Text></>}
    </View>
    <View style={s.card}>
      <MealButton title={checking?"Checking pantry…":"Check my pantry"} icon="basket-outline" disabled={checking || saving} onPress={()=>void checkPantry()} />
      {draft.checked && <View style={s.actionRow}><AvailabilityRing progress={overall} loading={pantry.isPending} unavailable={pantry.isError} label="Required ingredients available" /><Text style={[s.text,{flex:1}]}>{formatNumber(overall*100)}% of required ingredients available</Text></View>}
    </View>
    <Text style={s.heading}>Ingredients</Text>
    {meal.ingredients.map(i=>{
      const parts=draft.selections.filter(p=>p.ingredient_id===i.id), c=coverage.get(i.id);
      const ingredientName = i.name?.trim() || i.generic_product.product_name;
      const alternatives = draft.checked && !checking && !pantry.isError && parts.length > 0 && !c?.available
        ? replacementCandidates({ id:i.id, meal_id:0, amount:Number(i.amount), product_barcode:null,
            generic_product_id:i.generic_product_id, product:null, generic_product:i.generic_product } as MealItem, [], pantry.data ?? [])
        : null;
      const hasOtherIngredients = alternatives && !alternatives.equivalent.length && !alternatives.compatible.length &&
        (alternatives.similar.length > 0 || alternatives.sameGroup.length > 0);
      return <View key={i.id} style={s.card}>
        <View style={s.actionRow}><AvailabilityRing progress={c?.needed ? c.available/c.needed : 0} loading={pantry.isPending} unavailable={pantry.isError} label={`${ingredientName} available`} />
          <View style={{flex:1}}><Text style={s.heading}>{ingredientName}</Text><Text style={s.muted}>{formatNumber(Number(i.amount))}{i.measurement_unit} required{i.is_optional?" · Optional":""}</Text></View></View>
        {parts.map((part,index)=>{
          const displayName = !part.product_barcode && part.generic_product_id === i.generic_product_id
            ? ingredientName : part.product.product_name ?? "Ingredient";
          return <View key={index} style={s.actionRow}><ProductImage thumbnail name={displayName} uri={part.product_barcode?barcodeProductImageUrl(part.product):genericProductImageUrl(part.product.image_path)} />
            <View style={{flex:1}}><Text style={s.text}>{displayName}</Text><Text style={s.muted}>{formatNumber(part.amount)}{i.measurement_unit}</Text></View></View>;
        })}
        {!!parts.length && <Text style={s.muted}>{pantry.isError?"Pantry availability unavailable":`${formatNumber(c?.available ?? 0)}${i.measurement_unit} available for this recipe`}</Text>}
        {!!hasOtherIngredients && <View style={{flexDirection:"row",alignItems:"flex-start",gap:10,backgroundColor:appTheme.color("#FFF8DB", "surface"),borderColor:appTheme.color("#F2E2A6", "border"),borderWidth:1,borderRadius:12,padding:12}}>
          <AppIcon name="information-circle-outline" size={22} color={appTheme.color("#916500", "text")} />
          <View style={{flex:1,gap:4}}>
            <Text style={[s.text,{color:appTheme.color("#705000", "text"),fontWeight:"600"}]}>Other ingredients available</Text>
            <Text style={[s.muted,{color:appTheme.color("#705000", "text")}]}>Tap Replace to view alternatives.</Text>
          </View>
        </View>}
        <View style={s.actionRow}><MealButton equalWidth secondary title="Replace" icon="create-outline" disabled={saving} onPress={()=>router.push({pathname:"/publicMealReplacement",params:{publicMealId,ingredientId:String(i.id)}})} />
          {i.is_optional && <MealButton equalWidth secondary title={parts.length?"Skip":"Include"} disabled={saving} onPress={()=>{setDraft({...draft,selections:parts.length?draft.selections.filter(p=>p.ingredient_id!==i.id):[...draft.selections,...initialPublicMeal(meal).selections.filter(p=>p.ingredient_id===i.id)]});setSavedId(null);}} />}</View>
      </View>;
    })}
    <Text style={s.muted}>Missing ingredients stay generic. Replace lets you select a pantry product or search and scan another food. Logging records all selected amounts, including any shortage.</Text>
    <View style={s.card}><Text style={s.heading}>Nutrition for the whole meal</Text>
      {nutrientKeys.map(key=>{
        const known=draft.selections.filter(p=>p.product[`${key}_per_100`] != null);
        const total=known.reduce((sum,p)=>sum+Number(p.product[`${key}_per_100`])*p.amount/100,0);
        const theme=nutrients[key];
        return <View key={key} style={{flexDirection:"row",alignItems:"center",gap:10,paddingBottom:12,borderBottomWidth:1,borderBottomColor:appTheme.color("#E7F1F3", "border")}}>
          <AppIcon name={theme.icon} size={20} color={appTheme.color(theme.color, "text")} /><Text style={[s.text,{flex:1}]}>{key[0].toUpperCase()+key.slice(1)}</Text>
          <Text style={s.text}>{known.length?`${formatNumber(total)}${key==="calories"?" kcal":"g"}${known.length<draft.selections.length?"*":""}`:"Unknown"}</Text>
        </View>;
      })}<Text style={s.muted}>* Partial total when some ingredient nutrition is unknown.</Text>
    </View>
    <ConsumeMeal mealId={publicMealId} disabled={saving || !draft.selections.length} publicSelection={{items:selectionPayload(draft.selections)}} />
    <MealButton title={saving?"Saving…":savedId?"Saved to My Meals":"Save to My Meals"} secondary disabled={saving || !!savedId || !draft.selections.length} onPress={()=>void save()} />
    {savedId && <MealButton title="Open saved meal" onPress={()=>router.push({pathname:"/mealDetails",params:{mealId:savedId}})} />}
    {!!error && <Text style={s.error}>{error}</Text>}
  </ScrollView>;
}
