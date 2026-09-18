import { brand } from "@/components/brand/theme";
import { AppIcon } from "@/components/brand/AppIcon";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { toNumber } from "@/api/products/productLookup/utils";
import { formatPantryQuantity, resolvePantryAddition } from "@/utils/pantryAmounts";
import type { PantryAmountSelection } from "@/utils/pantryAmounts";

type Props = {
  selection: PantryAmountSelection;
  onChange: (selection: PantryAmountSelection) => void;
  packageSize: number | null;
  unit: "g" | "ml";
  disabled: boolean;
  purpose?: "add" | "remaining" | "recipe";
};

export default function AmountToAdd({ selection, onChange, packageSize, unit, disabled, purpose = "add" }: Props) {
  const amountLabel = purpose === "recipe" ? "Amount in this recipe" : purpose === "remaining" ? "Amount remaining" : "Amount to add";
  const [editing, setEditing] = useState(purpose === "recipe");
  const total = resolvePantryAddition(selection, packageSize);
  const quantity = selection.mode === "quantity"
    ? toNumber(selection.value)
    : total !== null && packageSize !== null && packageSize > 0
      ? total / packageSize : null;
  const quantityText = selection.mode === "quantity"
    ? selection.value : quantity === null ? "" : formatPantryQuantity(quantity);
  const amountText = selection.mode === "amount"
    ? selection.value : total === null ? "" : String(total);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.summary}>
          <Text style={styles.heading}>{amountLabel}</Text>
          <Text style={styles.summaryText}>
            Quantity {quantity !== null && quantity > 0 ? formatPantryQuantity(quantity) : "—"}
            {" · "}{total === null ? "Enter amount" : `${total}${unit}`}
          </Text>
        </View>
        <Pressable
          onPress={() => setEditing((current) => !current)}
          disabled={disabled}
          style={({ pressed }) => [styles.edit, (pressed || disabled) && styles.dimmed]}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Close amount editor" : `Edit ${amountLabel.toLowerCase()}`}
          accessibilityState={{ expanded: editing, disabled }}
        >
          <AppIcon name={editing ? "checkmark-outline" : "create-outline"} size={20} color={brand.ink} />
          <Text style={styles.buttonText}>{editing ? "Done" : "Edit"}</Text>
        </Pressable>
      </View>
      {editing && (
        <View style={styles.editor}>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={quantityText}
                onChangeText={(value) => onChange({ mode: "quantity", value })}
                editable={!disabled && packageSize !== null && packageSize > 0}
                keyboardType="decimal-pad"
                accessibilityLabel={purpose === "recipe" ? "Quantity in this recipe" : purpose === "remaining" ? "Quantity remaining" : "Quantity to add"}
                placeholder="1"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Total amount ({unit})</Text>
              <TextInput
                style={styles.input}
                value={amountText}
                onChangeText={(value) => onChange({ mode: "amount", value })}
                editable={!disabled}
                keyboardType="decimal-pad"
                accessibilityLabel={`${amountLabel} in ${unit}`}
                placeholder="0"
              />
            </View>
          </View>
          <Text style={styles.help}>
            {packageSize !== null && packageSize > 0
              ? `1 item = ${packageSize}${unit}. Edit either field.`
              : `Item size unavailable. Enter the total ${unit}${purpose === "remaining" ? " remaining" : " to add"}.`}
          </Text>
          {total === null && <Text style={styles.error}>Enter a valid amount greater than zero.</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: brand.border, backgroundColor: brand.surface, borderRadius: 16, padding: 14, marginTop: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  summary: { flex: 1 },
  heading: { fontSize: 14, color: brand.muted, marginBottom: 5 },
  summaryText: { fontSize: 16, fontWeight: "600", color: brand.ink },
  edit: { backgroundColor: brand.paleTeal, borderRadius: 12, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8 },
  buttonText: { color: brand.deepTeal, fontWeight: "600" },
  dimmed: { opacity: 0.5 },
  editor: { marginTop: 12 },
  field: { flex: 1 },
  label: { color: brand.muted, fontSize: 12, marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: brand.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, color: brand.ink },
  help: { color: brand.muted, fontSize: 12, marginTop: 8 },
  error: { color: brand.red, fontSize: 12, marginTop: 8 },
});
