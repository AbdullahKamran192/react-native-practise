import { brand } from "@/components/brand/theme";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { dateKey, parseDay, dayColours } from "@/utils/consumptionHistory";

type Props = { dates: string[]; selected: string; onSelect: (date:string)=>void; scores: Record<string,keyof typeof dayColours> };
export default function HistoryDates({ dates, selected, onSelect, scores }: Props) {
  const strip = useRef<ScrollView>(null);
  const stripWidth = useRef(0);
  const [open,setOpen] = useState(false);
  const [month,setMonth] = useState(selected.slice(0,7));
  const scrollToSelected = useCallback((animated: boolean) => {
    // Oldest is on the left; keep the selected date at the visible right edge.
    if (selected === dates[0]) {
      strip.current?.scrollToEnd({animated});
    } else {
      const index = dates.length - 1 - dates.indexOf(selected);
      strip.current?.scrollTo({x: Math.max(0,index*72+64-stripWidth.current),animated});
    }
  }, [selected,dates]);
  useEffect(() => { scrollToSelected(true); }, [scrollToSelected]);
  const first = parseDay(month+"-01");
  const previous = new Date(first.getFullYear(),first.getMonth()-1,1,12);
  const next = new Date(first.getFullYear(),first.getMonth()+1,1,12);
  const count = new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  const offset = (first.getDay()+6)%7;
  const cells = Array.from({length: Math.ceil((offset+count)/7)*7},(_,i) => i-offset+1);
  return <View style={s.container}>
    <View style={s.row}>
      <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}
        onLayout={event=>{stripWidth.current=event.nativeEvent.layout.width;scrollToSelected(false);}}
        onContentSizeChange={()=>scrollToSelected(false)}>
        {[...dates].reverse().map(day => {
          const colour = dayColours[scores[day] ?? "neutral"];
          const date = parseDay(day);
          return <Pressable key={day} onPress={()=>onSelect(day)} accessibilityRole="button"
            accessibilityLabel={date.toLocaleDateString("en-GB",{dateStyle:"full"})+", "+colour.label}
            accessibilityState={{selected:day===selected}}
            style={[s.day,{backgroundColor:colour.background},day===selected && s.selected]}>
            <Text style={[s.small,{color:colour.text}]}>{day===dates[0] ? "Today" : date.toLocaleDateString("en-GB",{weekday:"short"})}</Text>
            <Text style={[s.number,{color:colour.text}]}>{date.getDate()}</Text>
            <Text style={[s.small,{color:colour.text}]}>{date.toLocaleDateString("en-GB",{month:"short"})}</Text>
          </Pressable>;
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose date from calendar" accessibilityState={{expanded:open}}
        style={s.calendarButton} onPress={()=>{setMonth(selected.slice(0,7));setOpen(!open);}}>
        <Ionicons name="calendar-outline" size={23} color={brand.deepTeal}/>
      </Pressable>
    </View>
    {open && <View style={s.calendar}>
      <View style={s.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={month<=dates[dates.length-1].slice(0,7)}
          onPress={()=>setMonth(dateKey(previous).slice(0,7))} style={s.arrow}>
          <Ionicons name="chevron-back" size={22} color={month<=dates[dates.length-1].slice(0,7) ? "#CCC" : brand.deepTeal}/>
        </Pressable>
        <Text style={s.month}>{first.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={month>=dates[0].slice(0,7)}
          onPress={()=>setMonth(dateKey(next).slice(0,7))} style={s.arrow}>
          <Ionicons name="chevron-forward" size={22} color={month>=dates[0].slice(0,7) ? "#CCC" : brand.deepTeal}/>
        </Pressable>
      </View>
      <View style={s.grid}>{["M","T","W","T","F","S","S"].map((label,i)=><Text key={i} style={s.weekday}>{label}</Text>)}</View>
      <View style={s.grid}>{cells.map((number,i)=>{
        if(number<1 || number>count) return <View key={i} style={s.cell}/>;
        const day=dateKey(new Date(first.getFullYear(),first.getMonth(),number,12));
        const allowed=dates.includes(day);
        const colour=dayColours[scores[day] ?? "neutral"];
        return <View key={i} style={s.cell}><Pressable disabled={!allowed} accessibilityRole="button"
          accessibilityLabel={day+", "+colour.label} accessibilityState={{disabled:!allowed,selected:day===selected}}
          onPress={()=>{onSelect(day);setOpen(false);}}
          style={[s.calendarDay,{backgroundColor:allowed?colour.background:"transparent"},day===selected&&s.selected]}>
          <Text style={{color:allowed?colour.text:"#BBB",fontWeight:day===selected?"700":"400"}}>{number}</Text>
        </Pressable></View>;
      })}</View>
      <Text style={s.help}>Today and the previous 29 days</Text>
    </View>}
    <Text style={s.help}>Calorie + protein targets: green 100%+ · yellow 75%+ · orange 50%+ · red below 50%. Grey: no logs, missing nutrition or no target.</Text>
  </View>;
}
const s=StyleSheet.create({
  container:{marginBottom:18},row:{flexDirection:"row",alignItems:"center",gap:8},
  strip:{gap:8,paddingVertical:4},day:{width:64,minHeight:82,borderRadius:16,borderWidth:2,borderColor:"transparent",alignItems:"center",justifyContent:"center",gap:2},
  selected:{borderColor:brand.teal,borderWidth:2},small:{fontSize:11},number:{fontSize:23,fontWeight:"700"},
  calendarButton:{width:44,height:48,backgroundColor:brand.paleTeal,borderRadius:14,alignItems:"center",justifyContent:"center"},
  calendar:{backgroundColor:"#FFF",borderRadius:20,padding:12,marginTop:12},
  monthRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},month:{color:brand.ink,fontSize:16,fontWeight:"700"},
  arrow:{padding:10},grid:{flexDirection:"row",flexWrap:"wrap"},weekday:{width:"14.2857%",textAlign:"center",paddingVertical:8,color:brand.muted},
  cell:{width:"14.2857%",height:44,padding:2},calendarDay:{flex:1,borderRadius:10,alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:"transparent"},
  help:{fontSize:11,color:brand.muted,lineHeight:16,marginTop:8},
});
