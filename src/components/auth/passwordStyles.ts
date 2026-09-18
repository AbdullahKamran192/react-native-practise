import { StyleSheet } from "react-native";
import { brand } from "@/components/brand/theme";
export const passwordStyles = StyleSheet.create({
 container: { flex: 1, backgroundColor: brand.background },
 content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 18 },
 title: { color: brand.ink, fontSize: 26, fontWeight: "700" },
 text: { color: brand.muted, fontSize: 15, lineHeight: 22 },
 label: { color: brand.ink, fontSize: 15, fontWeight: "600" },
 input: { minHeight: 54, borderWidth: 1, borderColor: brand.border, borderRadius: 14, padding: 14, backgroundColor: brand.surface, color: brand.ink, fontSize: 16 },
 button: { minHeight: 54, padding: 14, backgroundColor: brand.teal, borderRadius: 14, alignItems: "center", justifyContent: "center" },
 buttonText: { color: brand.surface, fontWeight: "700", fontSize: 16 },
 error: { color: brand.red, fontSize: 15, lineHeight: 22 },
 link: { color: brand.deepTeal, paddingVertical: 12, textAlign: "center", fontSize: 16 },
});
