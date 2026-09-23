import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand, nutrients } from "./theme";

export default function NutritionTile({ label, value }: { label: string; value: string }) {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

  const tone = nutrients[label.toLowerCase() as keyof typeof nutrients] ?? nutrients.calories;
  return <View style={[styles.tile, { backgroundColor: appTheme.color(tone.background, "surface") }]}>
    <AppIcon name={tone.icon} size={24} color={appTheme.color(tone.color, "text")} />
    <Text style={[styles.label, { color: appTheme.color(tone.color, "text") }]}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>;
}

const baseStyles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: "44%", minWidth: 120, borderRadius: 18, padding: 16, gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  value: { fontSize: 21, fontWeight: "700", color: brand.ink },
});
