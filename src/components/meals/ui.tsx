import { Ionicons } from "@expo/vector-icons";
import { brand } from "@/components/brand/theme";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export function MealButton({ title, onPress, disabled = false, secondary = false, destructive = false, icon }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; destructive?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [mealStyles.button, secondary && mealStyles.secondary, destructive && mealStyles.destructive, (disabled || pressed) && { opacity: 0.5 }]}>
    {icon && <Ionicons name={icon} size={22} color={destructive ? brand.red : secondary ? brand.deepTeal : "#fff"} />}
    <Text style={[mealStyles.buttonText, secondary && { color: brand.deepTeal }, destructive && { color: brand.red }]}>{title}</Text>
  </Pressable>;
}

export function MealStatus({ loading, error, retry }: { loading?: boolean; error?: string; retry?: () => void }) {
  return <View style={mealStyles.content}>
    {loading ? <ActivityIndicator size="large" /> : <Text style={mealStyles.error}>{error}</Text>}
    {retry && <MealButton title="Try again" onPress={retry} secondary />}
  </View>;
}

export const mealStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.background },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  title: { fontSize: 30, fontWeight: "700", color: brand.ink },
  heading: { fontSize: 20, fontWeight: "700", color: brand.ink },
  text: { fontSize: 16, lineHeight: 25, color: brand.ink },
  muted: { fontSize: 15, lineHeight: 23, color: brand.muted },
  card: { padding: 20, borderRadius: 24, backgroundColor: "#fff", gap: 16, borderWidth: 1, borderColor: "#E7F1F3" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  input: { backgroundColor: "#fff", borderColor: brand.teal, borderWidth: 1, borderRadius: 12, padding: 16, minHeight: 54, color: brand.ink, fontSize: 16 },
  button: { backgroundColor: brand.teal, borderRadius: 18, minHeight: 54, paddingHorizontal: 18, paddingVertical: 15, flexDirection: "row", gap: 10, maxWidth: "100%", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600", flexShrink: 1, textAlign: "center" },
  secondary: { backgroundColor: brand.paleTeal },
  destructive: { backgroundColor: brand.paleRed, borderWidth: 1, borderColor: "#F5CCD2" },
  error: { color: "#B3261E", fontSize: 14, lineHeight: 20 },
});
