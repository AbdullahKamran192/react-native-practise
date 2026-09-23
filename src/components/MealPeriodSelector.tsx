import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { brand } from "@/components/brand/theme";
import { mealPeriods, type MealPeriod } from "@/utils/mealPeriod";

export default function MealPeriodSelector({ value, onChange, disabled = false }: {
  value: MealPeriod; onChange: (period: MealPeriod) => void; disabled?: boolean;
}) {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  return <View style={s.container}>
    <Text style={s.heading}>Meal period</Text>
    <View style={s.options}>
      {mealPeriods.map(period => <Pressable key={period} disabled={disabled}
        accessibilityRole="radio" accessibilityLabel={period}
        accessibilityState={{ checked: value === period, disabled }}
        onPress={() => onChange(period)}
        style={[s.option, value === period && s.selected, disabled && { opacity: 0.5 }]}>
        <Text style={[s.text, value === period && { color: appTheme.color(brand.surface, "text") }]}>{period}</Text>
      </Pressable>)}
    </View>
  </View>;
}
const baseS = StyleSheet.create({
  container: { gap: 10 },
  heading: { color: brand.ink, fontSize: 17, fontWeight: "600" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: brand.paleTeal },
  selected: { backgroundColor: brand.teal },
  text: { color: brand.deepTeal, fontSize: 14, fontWeight: "600" },
});
