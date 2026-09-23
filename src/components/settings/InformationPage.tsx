import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";

export default function InformationPage({ title, icon }: {
  title: string;
  icon: keyof typeof AppIcon.glyphMap;
}) {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

  return <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.icon}><AppIcon name={icon} size={30} color={appTheme.color(brand.deepTeal, "text")} /></View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>Content will be added here soon.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.background },
  content: { padding: 20, paddingBottom: 40 },
  card: { padding: 24, gap: 18, backgroundColor: brand.surface, borderRadius: 24, borderWidth: 1, borderColor: brand.border },
  icon: { width: 60, height: 60, borderRadius: 18, backgroundColor: brand.paleTeal, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", color: brand.ink },
  message: { fontSize: 16, lineHeight: 24, color: brand.muted },
});
