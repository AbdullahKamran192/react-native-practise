import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getConsumptionHistory } from "@/api/consumption/history";
import { useUserSettings } from "@/api/user-settings";
import HistoryDates from "@/components/HistoryDates";
import NutritionCard from "@/components/NutritionCard";
import ProgressRing from "@/components/ProgressRing";
import SettingsButton from "@/components/SettingsButton";
import DeleteFoodLogButton from "@/components/DeleteFoodLogButton";
import { dateKey, parseDay, recentDates, nutrients, summarize, groupConsumptions, dayScore } from "@/utils/consumptionHistory";
import type { HistoryRow, Nutrient } from "@/utils/consumptionHistory";

const labels: Record<Nutrient,string> = {calories:"Calories",protein:"Protein",carbs:"Carbs",fat:"Fat",sugars:"Sugars",salt:"Salt",fibre:"Fibre"};
const colours: Record<Nutrient,string> = {calories:"#E0AA56",protein:"#599C7B",carbs:"#648DC4",fat:"#BC8A59",sugars:"#BA7597",salt:"#7C85B5",fibre:"#79A05E"};
const icons: Record<Nutrient,keyof typeof Ionicons.glyphMap> = {
  calories:"flame-outline",protein:"restaurant-outline",carbs:"water-outline",
  fat:"nutrition-outline",sugars:"cube-outline",salt:"flask-outline",fibre:"leaf-outline",
};
const format=(value:number)=>Number(value.toFixed(1)).toLocaleString("en-GB");

export default function Home() {
  const router=useRouter();
  const [today,setToday]=useState(()=>dateKey(new Date()));
  const [selected,setSelected]=useState(today);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [editing,setEditing]=useState(false);
  const dates=useMemo(()=>recentDates(today),[today]);
  const history=useQuery({
    queryKey:["food-consumption","history",dates[29],today],
    queryFn:()=>getConsumptionHistory(dates[29],today),
  });
  const settings=useUserSettings();
  const refresh=useCallback(()=>{
    const now=dateKey(new Date());
    setSelected(current=>current===today?now:current<recentDates(now)[29]?recentDates(now)[29]:current);
    setToday(now);
    void history.refetch();
    void settings.refetch();
  },[history.refetch,settings.refetch,today]);
  useFocusEffect(useCallback(()=>{
    refresh();
    const subscription=AppState.addEventListener("change",state=>{if(state==="active")refresh();});
    const timer=setInterval(()=>{
      if(dateKey(new Date())!==today)refresh();
    },60000);
    return ()=>{subscription.remove();clearInterval(timer);};
  },[refresh,today]));
  const byDay=useMemo(()=>{
    const result:Record<string,HistoryRow[]>={};
    for(const row of history.data??[]) (result[row.consumed_on]??=[]).push(row);
    return result;
  },[history.data]);
  const targets=Object.fromEntries(nutrients.map(n=>[n,settings.data?.[`${n}_target_per_day`]??0])) as Record<Nutrient,number>;
  const rows=byDay[selected]??[];
  const summary=summarize(rows);
  const events=groupConsumptions(rows);
  const ready=history.isSuccess && settings.isSuccess;
  const scores=Object.fromEntries(dates.map(day=>[day,ready?dayScore(byDay[day]??[],targets.calories,targets.protein):"neutral"]));
  const isToday=selected===today;
  const selectedLabel=parseDay(selected).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
  const calories=summary.totals.calories;
  const difference=targets.calories-calories;
  const progress=targets.calories>0?Math.min(1,Math.max(0,calories/targets.calories)):0;
  const error=history.error??settings.error;
  const header=<View>
    <View style={s.header}>
      <View style={{flex:1}}>
        <Text style={s.greeting}>{isToday?"Your daily overview":selectedLabel}</Text>
        <Text style={s.title}>{isToday?"Today's Calories":"Calories"}</Text>
      </View>
      <SettingsButton />
    </View>
    <HistoryDates dates={dates} selected={selected} scores={scores} onSelect={day=>{setSelected(day);setExpanded(null);}}/>
    {(history.isPending||settings.isPending)&&<View style={s.message}><ActivityIndicator color="#222"/><Text>Loading your consumption…</Text></View>}
    {error&&<View style={s.message}><Text>{error.message}</Text><Pressable onPress={refresh} accessibilityRole="button"><Text style={s.link}>Try again</Text></Pressable></View>}
    {ready&&<>
      <View style={s.calorieCard}>
        <View style={s.calorieRing}>
          <ProgressRing size={190} strokeWidth={10} progress={progress} animationKey={selected}
            colour="#E0AA56" trackColour="#414141"
            label={"Calories consumed: "+format(calories)+" kcal"+(targets.calories>0?" of "+format(targets.calories)+" kcal":"; no target set")}>
            <Text style={s.cardLabel}>Consumed{summary.missing.calories?"*":""}</Text>
            <Text style={s.caloriesConsumed} numberOfLines={1} adjustsFontSizeToFit>{format(calories)}</Text>
            <Text style={s.calorieUnit}>kcal</Text>
            <Text style={s.calorieGoal}>{targets.calories>0?"of "+format(targets.calories)+" kcal":"No target set"}</Text>
          </ProgressRing>
        </View>
        <Text style={s.calorieFooter}>{targets.calories>0
          ? format(Math.abs(difference))+" kcal "+(difference<0?"over target":"remaining")
          : "Set a calorie target in Settings"}</Text>
      </View>
      {nutrients.some(n=>summary.missing[n])&&<Text style={s.notice}>Some nutrition is missing. Values marked * include known amounts only.</Text>}
      {!settings.data&&<Pressable onPress={()=>router.push("/settings")}><Text style={s.link}>Set your daily targets in Settings</Text></Pressable>}
      <Text style={s.sectionTitle}>{isToday?"Today's Nutrition":"Nutrition · "+selectedLabel}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.nutritionRow}>
        {nutrients.map(n=><View key={n} style={{width:132}}><NutritionCard icon={icons[n]} label={labels[n]}
          progress={targets[n]>0?summary.totals[n]/targets[n]:0} animationKey={selected} colour={colours[n]}
          value={format(summary.totals[n])+(n==="calories"?" kcal":"g")+(summary.missing[n]?"*":"")}
          goal={targets[n]>0?format(targets[n])+(n==="calories"?" kcal":"g"):"—"}/></View>)}
      </ScrollView>
    </>}
    <View style={s.foodActions}>
      <Pressable style={({pressed})=>[s.consumeFoodButton,pressed&&s.buttonPressed]}
        onPress={()=>router.push({pathname:"/camera",params:{intent:"consume"}})}
        accessibilityRole="button" accessibilityLabel="Consume food">
        <Ionicons name="restaurant-outline" size={22} color="#fff"/>
        <Text style={s.consumeFoodText}>Consume Food</Text>
      </Pressable>
      <Pressable style={({pressed})=>[s.addFoodButton,pressed&&s.buttonPressed]}
        onPress={()=>router.push({pathname:"/camera",params:{intent:"pantry"}})}
        accessibilityRole="button" accessibilityLabel="Add food to pantry">
        <Ionicons name="basket-outline" size={22} color="#222"/>
        <Text style={s.addFoodText}>Add Food to Pantry</Text>
      </Pressable>
    </View>
    <View style={s.mealsHeading}>
      <Text style={[s.sectionTitle,{flex:1,marginBottom:0}]}>{isToday?"Today's Meals":"Food & meals · "+selectedLabel}</Text>
      <Pressable onPress={()=>setEditing(value=>!value)} style={s.editButton}
        accessibilityRole="button" accessibilityLabel={editing?"Stop editing food logs":"Edit food logs"}
        accessibilityState={{selected:editing}}>
        <Ionicons name={editing?"close":"create-outline"} size={21} color="#fff"/>
        <Text style={{fontWeight:"700",color:"#fff"}}>{editing?"Done":"Edit"}</Text>
      </Pressable>
    </View>
  </View>;
  return <SafeAreaView style={s.container} edges={["top","left","right"]}>
    <FlatList data={ready?events:[]} keyExtractor={item=>item.id} ListHeaderComponent={header}
      contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
      refreshing={history.isRefetching||settings.isRefetching} onRefresh={refresh}
      ListEmptyComponent={ready?<Text style={s.empty}>No food logged for {isToday?"today":selectedLabel} yet.</Text>:null}
      renderItem={({item})=><View style={s.eventCard}>
        <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
        <Pressable accessibilityRole="button" accessibilityLabel={"View consumed "+item.name}
          style={[s.eventRow,{flex:1}]} onPress={()=>router.push({pathname:"/consumptionDetails",params:{groupId:item.items[0].consumption_group_id}})}>
          <View style={s.eventIcon}><Ionicons name={item.isMeal?"restaurant-outline":"nutrition-outline"} size={23} color="#444"/></View>
          <View style={{flex:1}}>
            <Text style={s.eventName}>{item.name}</Text>
            <Text style={s.eventSubtitle}>{item.isMeal?item.items.length+" ingredients":
              format(Number(item.items[0].amount_consumed))+item.items[0].measurement_unit+
              (item.items[0].brand_snapshot?" · "+item.items[0].brand_snapshot:"")}</Text>
          </View>
          <Text style={s.eventCalories}>{Math.round(item.totals.calories)} kcal{item.missing.calories?"*":""}</Text>
        </Pressable>
        {item.isMeal&&<Pressable onPress={()=>setExpanded(expanded===item.id?null:item.id)}
          accessibilityRole="button" accessibilityLabel={(expanded===item.id?"Hide":"Show")+" ingredients for "+item.name}
          accessibilityState={{expanded:expanded===item.id}} style={{width:44,height:44,alignItems:"center",justifyContent:"center"}}>
          <Ionicons name={expanded===item.id?"chevron-up":"chevron-down"} size={20} color="#555"/>
        </Pressable>}
        {editing&&<DeleteFoodLogButton groupId={item.items[0].consumption_group_id} name={item.name}/>}
        </View>
        {item.isMeal&&expanded===item.id&&item.items.map(ingredient=><View key={ingredient.id} style={s.ingredient}>
          <Text style={{flex:1,color:"#555"}}>{ingredient.product_name_snapshot}</Text>
          <Text style={{color:"#555"}}>{format(Number(ingredient.amount_consumed))}{ingredient.measurement_unit}</Text>
        </View>)}
      </View>}/>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  mealsHeading:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:14},
  editButton:{minWidth:84,minHeight:44,paddingHorizontal:14,borderRadius:12,backgroundColor:"#222",flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center"},
  container:{flex:1,backgroundColor:"#F7F7F7"},scrollContent:{padding:20,paddingBottom:40},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:12},
  greeting:{fontSize:14,color:"#777",marginBottom:4},title:{fontSize:26,fontWeight:"700",color:"#222"},
  calorieCard:{backgroundColor:"#222",borderRadius:20,padding:22,marginBottom:20},
  calorieRing:{alignItems:"center"},cardLabel:{color:"#BDBDBD",fontSize:13,marginBottom:4},
  caloriesConsumed:{color:"#fff",fontSize:30,fontWeight:"700",maxWidth:150},
  calorieUnit:{color:"#DDD",fontSize:14,marginTop:2},
  calorieGoal:{color:"#BDBDBD",fontSize:12,marginTop:5},
  calorieFooter:{color:"#DDD",fontSize:14,textAlign:"center",marginTop:14},
  sectionTitle:{fontSize:19,fontWeight:"700",color:"#222",marginBottom:14},
  nutritionRow:{gap:10,paddingBottom:20},foodActions:{flexDirection:"row",gap:10,marginBottom:24},
  consumeFoodButton:{flex:1,minHeight:64,padding:10,borderRadius:16,backgroundColor:"#222",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7},
  addFoodButton:{flex:1,minHeight:64,padding:10,borderRadius:16,backgroundColor:"#E7E7E7",borderWidth:1,borderColor:"#D4D4D4",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7},
  consumeFoodText:{flexShrink:1,color:"#fff",fontSize:14,fontWeight:"700"},addFoodText:{flexShrink:1,color:"#222",fontSize:14,fontWeight:"700"},
  buttonPressed:{opacity:.7},message:{padding:20,gap:10,alignItems:"center"},link:{color:"#365A40",fontWeight:"600",marginBottom:14},
  notice:{color:"#777",fontSize:12,marginBottom:14},empty:{color:"#777",paddingVertical:20},
  eventCard:{backgroundColor:"#fff",borderRadius:16,padding:14,marginBottom:10},eventRow:{flexDirection:"row",alignItems:"center",gap:10},
  eventIcon:{width:42,height:42,borderRadius:13,backgroundColor:"#F2F2F2",alignItems:"center",justifyContent:"center"},
  eventName:{fontWeight:"600",fontSize:16,color:"#222"},eventSubtitle:{fontSize:12,color:"#777",marginTop:4},
  eventCalories:{fontWeight:"600",fontSize:13,color:"#444"},ingredient:{flexDirection:"row",gap:10,borderTopWidth:1,borderColor:"#EEE",paddingTop:10,marginTop:10},
});
