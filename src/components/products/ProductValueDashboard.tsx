import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { AppIcon } from "@/components/brand/AppIcon";
import { StyleSheet, Text, View } from "react-native";
import { useUserSettings } from "@/api/user-settings";
import { brand } from "@/components/brand/theme";
import { targetStatus, targetCoverage, overallCoverage, coverageGrade, type ValueGrade } from "@/utils/productValue";
export type { ValueGrade } from "@/utils/productValue";
type ProductValueDashboardProps = { caloriesPerPound: number | null; proteinPerPound: number | null };
type GradeStyle = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  description: string;
};

const gradeStyles: Record<ValueGrade, GradeStyle> = {
  A: {
    backgroundColor: "#DDF3E4",
    borderColor: "#73BC87",
    textColor: "#246B3A",
    description: "Excellent value",
  },

  B: {
    backgroundColor: "#EAF4D3",
    borderColor: "#A8CA68",
    textColor: "#587520",
    description: "Very good value",
  },

  C: {
    backgroundColor: "#FFF3C4",
    borderColor: "#E1C759",
    textColor: "#806815",
    description: "Good value",
  },

  D: {
    backgroundColor: "#FFE0B2",
    borderColor: "#E6A550",
    textColor: "#925A13",
    description: "Low value",
  },

  E: {
    backgroundColor: "#FFD6D6",
    borderColor: "#DF7A7A",
    textColor: "#A12F2F",
    description: "Poor value",
  },
};


const unknownColours: GradeStyle = {backgroundColor:brand.background,borderColor:brand.border,textColor:brand.muted,description:"Missing information"};
const format=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:1});

export default function ProductValueDashboard({caloriesPerPound,proteinPerPound}:ProductValueDashboardProps) {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

 const settings=useUserSettings();
 const data=settings.isError?null:settings.data;
 const budget=data?Number(data.cost_target_per_day):null;
 const calorieTarget=data?Number(data.calories_target_per_day):null;
 const proteinTarget=data?Number(data.protein_target_per_day):null;
 const calories=targetCoverage(caloriesPerPound,budget,calorieTarget);
 const protein=targetCoverage(proteinPerPound,budget,proteinTarget);
 const overall=overallCoverage(calories?.percentage??null,protein?.percentage??null);
 const grade=coverageGrade(overall);
 const colours=grade?gradeStyles[grade]:unknownColours;
 const validBudget=budget!==null&&Number.isFinite(budget)&&budget>0;
 const cards=[
  {label:"Calories",icon:"flame-outline" as const,coverage:calories,target:calorieTarget,perPound:caloriesPerPound,unit:"kcal"},
  {label:"Protein",icon:"barbell-outline" as const,coverage:protein,target:proteinTarget,perPound:proteinPerPound,unit:"g"},
 ];
 return <View style={styles.container}>
  <View style={styles.headingRow}>
   <View style={{flex:1}}>
    <Text style={styles.title}>Value for your targets</Text>
    <Text style={styles.subtitle}>{validBudget?`Based on your ?${format(budget!)} daily food budget`:"Set your daily food budget and targets in Settings."}</Text>
   </View>
   <View style={styles.poundIcon}><Text style={styles.poundIconText}>?</Text></View>
  </View>
  {settings.isLoading&&<Text style={styles.subtitle}>Loading your targets...</Text>}
  {settings.isError&&<Text style={styles.subtitle}>Could not load your targets. Reopen this page to retry.</Text>}
  <View style={styles.valueGrid}>
   {cards.map(card=>{
    const c=card.coverage?gradeStyles[card.coverage.grade]:unknownColours;
    return <View key={card.label} style={[styles.valueCard,{backgroundColor:appTheme.color(c.backgroundColor, "surface"),borderColor:appTheme.color(c.borderColor, "border")}]}>
     <View style={styles.valueHeader}>
      <AppIcon name={card.icon} size={22} color={appTheme.color(c.textColor, "text")}/>
      <View style={[styles.smallGrade,{backgroundColor:appTheme.color(c.textColor, "surface")}]}>
       <Text style={styles.smallGradeText}>{card.coverage?.grade??"?"}</Text>
      </View>
     </View>
     <Text style={styles.valueLabel}>{card.label}</Text>
     <Text style={[styles.value,{color:appTheme.color(c.textColor, "text")}]}>{card.coverage?format(card.coverage.percentage)+"%":"Unknown"}</Text>
     {targetStatus(card.coverage?.percentage)&&<Text style={[styles.unit,{color:appTheme.color(c.textColor, "text")}]}>{targetStatus(card.coverage?.percentage)}</Text>}
     {card.coverage&&<>
      <View style={{height:5,backgroundColor:appTheme.color(brand.border, "surface"),borderRadius:3,overflow:"hidden",marginVertical:8}}
       accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.min(card.coverage.percentage,100)}}>
       <View style={{height:5,width:`${Math.min(card.coverage.percentage,100)}%`,backgroundColor:appTheme.color(c.textColor, "surface")}}/>
      </View>
      <Text style={styles.unit}>{format(card.coverage.withinBudget)} of {format(card.target!)} {card.unit}</Text>
     </>}
     <Text style={styles.unit}>{card.perPound===null?"Nutrition unavailable":`${format(card.perPound)} ${card.unit} per ?1`}</Text>
    </View>;
   })}
  </View>
  <View style={[styles.overallCard,{backgroundColor:appTheme.color(colours.backgroundColor, "surface"),borderColor:appTheme.color(colours.borderColor, "border")}]}>
   <View style={[styles.overallGrade,{backgroundColor:appTheme.color(colours.textColor, "surface")}]}><Text style={styles.overallGradeText}>{grade??"?"}</Text></View>
   <View style={styles.overallInformation}>
    <Text style={[styles.overallTitle,{color:appTheme.color(colours.textColor, "text")}]}>Overall grade: {grade??"Unknown"}</Text>
    <Text style={styles.overallDescription}>{overall===null?"Both nutrition values and positive targets are needed.":`${format(overall)}% ? ${colours.description} for your targets`}</Text>
    {targetStatus(overall)&&<Text style={[styles.unit,{color:appTheme.color(colours.textColor, "text")}]}>{targetStatus(overall)}</Text>}
   </View>
  </View>
  <View style={styles.explanation}>
   <AppIcon name="information-circle-outline" size={18} color={appTheme.color(brand.muted, "text")}/>
   <Text style={styles.explanationText}>Calculated as if your selected daily food budget were spent on this product. Overall coverage averages calories and protein, each capped at 100%. This is an affordability score, not a health rating.</Text>
  </View>
 </View>;
}
const baseStyles = StyleSheet.create({
  container: {
    marginTop: 18,
  },

  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  title: {
    color: brand.ink,
    fontSize: 19,
    fontWeight: "700",
  },

  subtitle: {
    color: brand.muted,
    fontSize: 12,
    marginTop: 3,
  },

  poundIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: brand.paleTeal,
    justifyContent: "center",
    alignItems: "center",
  },

  poundIconText: {
    color: brand.ink,
    fontSize: 20,
    fontWeight: "700",
  },

  valueGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  valueCard: {
    width: "48%",
    minHeight: 155,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },

  valueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  smallGrade: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  smallGradeText: {
    color: brand.surface,
    fontSize: 14,
    fontWeight: "800",
  },

  valueLabel: {
    color: brand.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
  },

  value: {
    fontSize: 25,
    fontWeight: "800",
    marginTop: 5,
  },

  unit: {
    color: brand.muted,
    fontSize: 11,
    marginTop: 2,
  },

  overallCard: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },

  overallGrade: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  overallGradeText: {
    color: brand.surface,
    fontSize: 30,
    fontWeight: "800",
  },

  overallInformation: {
    flex: 1,
    marginLeft: 15,
  },

  overallTitle: {
    fontSize: 17,
    fontWeight: "800",
  },

  overallDescription: {
    color: brand.muted,
    fontSize: 13,
    marginTop: 4,
  },

  explanation: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 4,
  },

  explanationText: {
    flex: 1,
    color: brand.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});