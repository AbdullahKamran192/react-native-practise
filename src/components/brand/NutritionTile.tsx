import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand, nutrients } from "./theme";

export default function NutritionTile({ label, value }: { label: string; value: string }) {
  const tone = nutrients[label.toLowerCase() as keyof typeof nutrients] ?? nutrients.calories;
  return <View style={[styles.tile, { backgroundColor: tone.background }]}>
    <AppIcon name={tone.icon} size={24} color={tone.color} />
    <Text style={[styles.label, { color: tone.color }]}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>;
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: "44%", minWidth: 120, borderRadius: 18, padding: 16, gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  value: { fontSize: 21, fontWeight: "700", color: brand.ink },
});
