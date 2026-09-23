import { Pressable, Text, View } from "react-native";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";
import { useAppTheme, type ThemePreference } from "@/theme/AppThemeProvider";

const options = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
] as const;

export default function AppearanceSection() {
  const { preference, setPreference, color, saveError } = useAppTheme();
  return <View style={{ marginTop: 28, gap: 12 }}>
    <Text style={{ fontSize: 19, fontWeight: "700", color: color(brand.ink) }}>Appearance</Text>
    <Text style={{ fontSize: 13, lineHeight: 19, color: color(brand.muted) }}>Choose a theme or follow your device settings.</Text>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {options.map(option => {
        const selected = preference === option.value;
        const foreground = selected ? "#FFFFFF" : color(brand.deepTeal);
        return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }}
          accessibilityLabel={option.label} onPress={() => setPreference(option.value as ThemePreference)}
          style={({ pressed }) => ({ flex: 1, minHeight: 72, padding: 12, gap: 6, alignItems: "center", justifyContent: "center",
            borderRadius: 16, borderWidth: 1, borderColor: color(selected ? brand.teal : brand.border, "border"),
            backgroundColor: color(selected ? brand.teal : brand.surface, "surface"), opacity: pressed ? 0.7 : 1 })}>
          <AppIcon name={option.icon} size={22} color={foreground} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: foreground }}>{option.label}</Text>
        </Pressable>;
      })}
    </View>
    {!!saveError && <Text style={{ color: color(brand.red), fontSize: 13 }}>{saveError}</Text>}
  </View>;
}
