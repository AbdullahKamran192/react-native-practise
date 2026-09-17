import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";

type Props = { value: string; onChangeText: (value: string) => void };

export default function FoodBudgetCard({ value, onChangeText }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          <AppIcon name="wallet-outline" size={26} color={brand.deepTeal} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Daily food budget</Text>
          <Text style={styles.description}>Your preferred daily food cost.</Text>
        </View>
      </View>
      <View style={styles.inputRow}>
        <Text style={styles.currency}>£</Text>
        <TextInput
          accessibilityLabel="Daily food budget in pounds"
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectTextOnFocus
          selectionColor={brand.teal}
        />
        <Text style={styles.description}>per day</Text>
      </View>
      <Text style={styles.hint}>Use Save preferences below to save your budget and nutrition targets.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: brand.surface, borderWidth: 1, borderColor: brand.border,
    borderTopWidth: 4, borderTopColor: brand.teal, borderRadius: 22, padding: 20, marginBottom: 24, gap: 18 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: brand.paleTeal,
    alignItems: "center", justifyContent: "center" },
  titleContainer: { flex: 1 },
  title: { color: brand.ink, fontSize: 20, fontWeight: "700" },
  description: { color: brand.muted, fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: brand.background,
    borderColor: brand.teal, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, minHeight: 64 },
  currency: { color: brand.deepTeal, fontSize: 26, fontWeight: "600" },
  input: { flex: 1, minWidth: 0, color: brand.deepTeal, fontSize: 28, fontWeight: "700", paddingVertical: 12 },
  hint: { color: brand.muted, fontSize: 12, lineHeight: 18 },
});
