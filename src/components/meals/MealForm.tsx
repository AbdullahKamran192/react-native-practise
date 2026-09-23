import { useThemeStyles } from "@/theme/AppThemeProvider";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { MealInput } from "@/api/meals";
import { MealButton, mealStyles as baseS } from "./ui";

export default function MealForm({ initial, onSave, onCancel, saving, error }: {
  initial?: MealInput; onSave: (values: MealInput) => void; onCancel?: () => void; saving: boolean; error?: string;
}) {
  const s = useThemeStyles(baseS);

  const [values, setValues] = useState<MealInput>(initial ?? { meal_name: "", description: "", instructions: "" });
  const fields = [
    { key: "meal_name", label: "Meal name", max: 100 },
    { key: "description", label: "Description (optional)", max: 500 },
    { key: "instructions", label: "Instructions (optional)", max: 5000 },
  ] as const;
  return <View style={{ gap: 12 }}>
    {fields.map(({ key, label, max }) => <View key={key} style={{ gap: 6 }}>
      <Text style={s.text}>{label}</Text>
      <TextInput accessibilityLabel={label} style={[s.input, key === "instructions" && { minHeight: 100, textAlignVertical: "top" }]}
        value={values[key] ?? ""} onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
        maxLength={max} multiline={key !== "meal_name"} editable={!saving} />
    </View>)}
    {error && <Text style={s.error}>{error}</Text>}
    <MealButton title={saving ? "Saving…" : "Save meal"} disabled={saving || !values.meal_name.trim()} onPress={() => onSave(values)} />
    {onCancel && <MealButton title="Cancel" secondary disabled={saving} onPress={onCancel} />}
  </View>;
}
