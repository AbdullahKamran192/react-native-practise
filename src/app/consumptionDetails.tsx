import { formatNumber } from "@/utils/formatNumber";
import ConsumptionPeriodEditor from "@/components/ConsumptionPeriodEditor";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand, nutrients as nutrientTheme } from "@/components/brand/theme";
import ConsumptionImage from "@/components/ConsumptionImage";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getConsumptionDetails } from "@/api/consumption/history";
import { nutrients, parseDay, summarize } from "@/utils/consumptionHistory";
import type { HistoryRow, Nutrient } from "@/utils/consumptionHistory";
import { MealStatus } from "@/components/meals/ui";

const labels:Record<Nutrient,string>={calories:"Calories",protein:"Protein",carbs:"Carbohydrates",fat:"Fat",sugars:"Sugars",salt:"Salt",fibre:"Fibre"};
const format=(value:number)=>formatNumber(value);

function Nutrition({rows}:{rows:HistoryRow[]}) {
  const {totals,missing}=summarize(rows);
  return <View>
    {nutrients.map(n=>{
      const known=rows.some(row=>row[`${n}_consumed`]!==null && row[`${n}_consumed`]!==undefined);
      return <View key={n} style={s.nutrientRow}>
        <View style={s.nutrientLabel}>
          <AppIcon name={nutrientTheme[n].icon} size={20} color={nutrientTheme[n].color} accessible={false} />
          <Text style={[s.text, s.labelText]}>{labels[n]}</Text>
        </View>
        <Text style={s.value}>{known?format(totals[n])+(n==="calories"?" kcal":" g")+(missing[n]?"*":""):"Not recorded"}</Text>
      </View>;
    })}
    {nutrients.some(n=>missing[n])&&<Text style={s.note}>Missing values are not treated as zero. * Known amounts only.</Text>}
  </View>;
}
export default function ConsumptionDetails(){
  const {groupId}=useLocalSearchParams<{groupId?:string}>();
  const query=useQuery({
    queryKey:["food-consumption","detail",groupId],
    queryFn:()=>getConsumptionDetails(groupId??""),
  });
  useFocusEffect(useCallback(()=>{void query.refetch();},[query.refetch]));
  if(query.isPending)return <MealStatus loading/>;
  if(query.error)return <MealStatus error={query.error.message} retry={()=>void query.refetch()}/>;
  const rows=query.data??[];
  if(!rows.length)return <MealStatus error="This consumption entry is no longer available."/>;
  const first=rows[0];
  const isMeal=first.meal_name_snapshot!==null;
  return <SafeAreaView style={s.screen} edges={["left","right","bottom"]}>
    <ScrollView contentContainerStyle={s.content}>
      <ConsumptionImage row={first} />
      <View>
        <Text style={s.caption}>{isMeal?"Consumed meal":"Consumed food"}</Text>
        <Text style={s.title}>{first.meal_name_snapshot??first.product_name_snapshot}</Text>
        <Text style={s.subtitle}>{parseDay(first.consumed_on).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</Text>
        <Text style={s.note}>Nutrition and product details are saved from when this was logged.</Text>
      </View>
      <View style={s.card}><ConsumptionPeriodEditor key={first.consumption_group_id} row={first} /></View>
      {!isMeal&&<View style={s.card}>
        <Text style={s.heading}>Amount consumed</Text>
        <Text style={s.amount}>{format(Number(first.amount_consumed))} {first.measurement_unit}</Text>
        {!!first.brand_snapshot&&<Text style={s.text}>{first.brand_snapshot}</Text>}
      </View>}
      <View style={s.card}>
        <Text style={s.heading}>{isMeal?"Nutrition for the whole meal":"Nutrition consumed"}</Text>
        <Nutrition rows={rows}/>
      </View>
      {isMeal&&<>
        <Text style={s.heading}>Ingredients · {rows.length}</Text>
        {rows.map(row=><View key={row.id} style={s.card}>
          <ConsumptionImage row={row} ingredient />
          <Text style={s.heading}>{row.product_name_snapshot}</Text>
          {!!row.brand_snapshot&&<Text style={s.subtitle}>{row.brand_snapshot}</Text>}
          <Text style={s.amount}>{format(Number(row.amount_consumed))} {row.measurement_unit} consumed</Text>
          <Nutrition rows={[row]}/>
        </View>)}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  nutrientLabel:{flexDirection:"row",alignItems:"center",gap:8,flexShrink:1},
  labelText:{flexShrink:1},
  screen:{flex:1,backgroundColor:brand.background},content:{padding:20,paddingBottom:40,gap:18},
  caption:{fontSize:13,color:brand.teal,marginBottom:6},title:{fontSize:26,fontWeight:"700",color:brand.ink},
  subtitle:{fontSize:14,color:brand.muted,marginTop:6},note:{fontSize:12,lineHeight:18,color:brand.muted,marginTop:10},
  card:{backgroundColor:brand.surface,padding:18,borderRadius:18,gap:10},heading:{fontSize:18,fontWeight:"600",color:brand.ink},
  amount:{fontSize:17,fontWeight:"600",color:brand.teal},text:{fontSize:15,color:brand.muted},
  nutrientRow:{flexDirection:"row",justifyContent:"space-between",gap:14,paddingVertical:11,borderBottomWidth:1,borderBottomColor:brand.border},
  value:{fontSize:15,fontWeight:"600",color:brand.ink,flexShrink:1,textAlign:"right"},
});

