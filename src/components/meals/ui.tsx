import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export function MealButton({ title, onPress, disabled = false, secondary = false, destructive = false, icon, equalWidth = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; destructive?: boolean; icon?: keyof typeof AppIcon.glyphMap; equalWidth?: boolean;
}) {
  const appTheme = useAppTheme();
  const mealStyles = useThemeStyles(baseMealStyles);

  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [mealStyles.button, equalWidth && { flex: 1, minWidth: 0, paddingHorizontal: 8, gap: 6 }, secondary && mealStyles.secondary, destructive && mealStyles.destructive, (disabled || pressed) && { opacity: 0.5 }]}>
    {icon && <AppIcon name={icon} size={22} color={appTheme.color(destructive ? brand.red : secondary ? brand.deepTeal : "#fff", "text")} />}
    <Text numberOfLines={equalWidth ? 1 : undefined} adjustsFontSizeToFit={equalWidth} style={[mealStyles.buttonText, secondary && { color: appTheme.color(brand.deepTeal, "text") }, destructive && { color: appTheme.color(brand.red, "text") }]}>{title}</Text>
  </Pressable>;
}

export function MealStatus({ loading, error, retry }: { loading?: boolean; error?: string; retry?: () => void }) {
  const mealStyles = useThemeStyles(baseMealStyles);

  return <View style={mealStyles.content}>
    {loading ? <ActivityIndicator size="large" /> : <Text style={mealStyles.error}>{error}</Text>}
    {retry && <MealButton title="Try again" onPress={retry} secondary />}
  </View>;
}

export const baseMealStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.background },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  title: { fontSize: 30, fontWeight: "700", color: brand.ink },
  heading: { fontSize: 20, fontWeight: "700", color: brand.ink },
  text: { fontSize: 16, lineHeight: 25, color: brand.ink },
  muted: { fontSize: 15, lineHeight: 23, color: brand.muted },
  card: { padding: 20, borderRadius: 24, backgroundColor: "#fff", gap: 16, borderWidth: 1, borderColor: "#E7F1F3" },
  actionRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  input: { backgroundColor: "#fff", borderColor: brand.teal, borderWidth: 1, borderRadius: 12, padding: 16, minHeight: 54, color: brand.ink, fontSize: 16 },
  button: { backgroundColor: brand.teal, borderRadius: 18, minHeight: 54, paddingHorizontal: 18, paddingVertical: 15, flexDirection: "row", gap: 10, maxWidth: "100%", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600", flexShrink: 1, textAlign: "center" },
  secondary: { backgroundColor: brand.paleTeal },
  destructive: { backgroundColor: brand.paleRed, borderWidth: 1, borderColor: "#F5CCD2" },
  error: { color: "#B3261E", fontSize: 14, lineHeight: 20 },
});

export { baseMealStyles as mealStyles };
