import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Alert, Text, View } from "react-native";
import { consumeMeal } from "@/api/meals/consumption";
import { MealButton, mealStyles as s } from "./ui";

export default function ConsumeMeal({ mealId, disabled }: { mealId: string; disabled: boolean }) {
  const lock = useRef(false);
  const client = useQueryClient();
  const mutation = useMutation({ mutationFn: () => consumeMeal(mealId), retry: false });

  async function consume() {
    if (lock.current || disabled) return;
    lock.current = true;
    try {
      const result = await mutation.mutateAsync();
      Alert.alert("Pantry updated",
        result.pantry_items_deducted === 0
          ? "None of this meal's ingredients were available in your pantry."
          : result.pantry_items_deducted + " pantry items reduced; " + result.pantry_items_exhausted + " exhausted items removed." +
            (result.pantry_items_short > 0 ? "\nSome ingredients were missing or had less than the required amount. Only available amounts were removed." : ""));
    } catch {
      // Display the mutation error below. Do not automatically retry a deduction.
    } finally {
      void client.invalidateQueries({ queryKey: ["pantry"] });
      lock.current = false;
    }
  }

  return <View style={s.card}>
    <MealButton title={mutation.isPending ? "Updating pantry…" : "Consume meal"}
      disabled={disabled || mutation.isPending} onPress={consume} />
    {mutation.error && <Text style={s.error}>{mutation.error.message}</Text>}
    {mutation.error && <Text style={s.muted}>If the connection was interrupted, check your pantry before consuming again.</Text>}
  </View>;
}
