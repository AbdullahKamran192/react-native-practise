import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export function MealButton({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [mealStyles.button, secondary && mealStyles.secondary, (disabled || pressed) && { opacity: 0.5 }]}>
    <Text style={[mealStyles.buttonText, secondary && { color: "#222" }]}>{title}</Text>
  </Pressable>;
}

export function MealStatus({ loading, error, retry }: { loading?: boolean; error?: string; retry?: () => void }) {
  return <View style={mealStyles.content}>
    {loading ? <ActivityIndicator size="large" /> : <Text style={mealStyles.error}>{error}</Text>}
    {retry && <MealButton title="Try again" onPress={retry} secondary />}
  </View>;
}

export const mealStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "700", color: "#222" },
  heading: { fontSize: 18, fontWeight: "700", color: "#222" },
  text: { fontSize: 15, lineHeight: 22, color: "#333" },
  muted: { fontSize: 13, lineHeight: 19, color: "#777" },
  card: { padding: 16, borderRadius: 16, backgroundColor: "#fff", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  input: { backgroundColor: "#fff", borderColor: "#DDD", borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48, color: "#222", fontSize: 16 },
  button: { backgroundColor: "#222", borderRadius: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  secondary: { backgroundColor: "#E7E7E7" },
  error: { color: "#B3261E", fontSize: 14, lineHeight: 20 },
});
