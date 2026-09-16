import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { localDate } from "@/api/consumption";
import { useConsumptionLog } from "@/hooks/useConsumptionLog";
import { MealButton, mealStyles as s } from "./ui";

export default function ConsumeMeal({ mealId, disabled }: { mealId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [removeFromPantry, setRemoveFromPantry] = useState(true);
  const log = useConsumptionLog("meal:" + mealId);
  const busy = log.saving || log.checking || !!log.storageError;

  async function consume() {
    const rows = await log.submit(log.pending ? undefined : {
      mealId, consumedOn: localDate(date), removeFromPantry,
    });
    if (rows) {
      setOpen(false);
      setShowDate(false);
      Alert.alert("Meal logged", (rows[0].meal_name_snapshot ?? "Meal") + " saved for " + rows[0].consumed_on +
        ". " + rows.length + " ingredients recorded.");
    }
  }

  return <View style={s.card}>
    {!open && !log.pending ? <MealButton icon="restaurant-outline" title="Consume meal" disabled={disabled || busy} onPress={() => setOpen(true)} /> : <>
      <Text style={s.heading}>Log meal</Text>
      {log.pending ? <Text style={s.muted}>Retry the previous log for {log.pending.input.consumedOn}. Its original pantry choice will be used without logging twice.</Text> : <>
        <MealButton title={"Date consumed: " + date.toLocaleDateString("en-GB")} secondary disabled={busy} onPress={() => setShowDate(!showDate)} />
        {showDate && <DateTimePicker value={date} mode="date" maximumDate={new Date()} disabled={busy} onChange={(event, selected) => {
          if (Platform.OS === "android") setShowDate(false);
          if (event.type === "set" && selected) setDate(selected);
        }} />}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: removeFromPantry, disabled: busy }}
          disabled={busy} onPress={() => setRemoveFromPantry(!removeFromPantry)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
          <Ionicons name={removeFromPantry ? "checkbox" : "square-outline"} size={25} color="#222" />
          <Text style={[s.text, { flex: 1 }]}>Remove available ingredients from my pantry</Text>
        </Pressable>
        <Text style={s.muted}>All ingredients will be logged. When checked, available pantry amounts are reduced and exhausted items removed.</Text>
      </>}
      <MealButton title={log.saving ? "Logging…" : log.pending ? "Retry previous log" : "Log meal"}
        disabled={busy || (disabled && !log.pending)} onPress={consume} />
      {!log.pending && <MealButton title="Cancel" secondary disabled={busy} onPress={() => { setOpen(false); setShowDate(false); }} />}
    </>}
    {!!log.error && <Text style={s.error}>{log.error}</Text>}
    {!!log.storageError && <><Text style={s.error}>{log.storageError}</Text><MealButton title="Check again" secondary onPress={log.refresh} /></>}
  </View>;
}
