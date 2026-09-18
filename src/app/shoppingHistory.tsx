import { formatNumber } from "@/utils/formatNumber";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteShoppingTrip, shoppingHistory, type Trip } from "@/api/shopping";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";
import { MealButton, MealStatus, mealStyles as s } from "@/components/meals/ui";
export default function ShoppingHistory() {
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Trip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removeFromPantry, setRemoveFromPantry] = useState(false);
  const [success, setSuccess] = useState("");
  const lock = useRef(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["shopping-history", page], queryFn: () => shoppingHistory(page) });
  async function remove() {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await deleteShoppingTrip(selected.id, removeFromPantry);
      await client.cancelQueries({ queryKey: ["shopping-history"] });
      client.removeQueries({ queryKey: ["shopping-history", "detail", selected.id], exact: true });
      setSelected(null);
      // Start at the first page so removing a last-page entry cannot leave an invalid range.
      setPage(0);
      setSuccess(!result.trip_deleted ? "This shopping trip has already been removed. No further pantry amounts were deducted."
        : !removeFromPantry ? "Shopping trip deleted. Pantry stock unchanged."
        : `Shopping trip deleted. ${result.pantry_items_updated} pantry products updated; ${result.pantry_items_unavailable} unavailable or no longer matching the purchased unit.`
          + (result.pantry_items_short ? ` For ${result.pantry_items_short} products, only the remaining stock was removed.` : ""));
      await Promise.all([
        client.invalidateQueries({ queryKey: ["shopping-history"] }),
        client.invalidateQueries({ queryKey: ["shopping-spending"] }),
        client.invalidateQueries({ queryKey: ["pantry"] }),
        client.invalidateQueries({ queryKey: ["meals"] }),
      ]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete this purchase. Please try again.");
    } finally { lock.current = false; setBusy(false); }
  }
  if (query.isLoading) return <MealStatus loading />;
  if (query.error) return <MealStatus error={query.error.message} retry={() => query.refetch()} />;
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text style={[s.title, { flex: 1 }]}>Purchase history</Text>
      <MealButton title={editing ? "Done" : "Edit"} icon={editing ? "close" : "create-outline"}
        disabled={busy} onPress={() => setEditing(value => !value)} />
    </View>
    <Text style={s.muted}>View your purchases, or use Edit to delete a shopping trip and optionally remove its purchased amounts from your pantry.</Text>
    {!!success && <Text style={[s.text, { color: brand.deepTeal }]} accessibilityRole="alert">✓ {success}</Text>}
    {!query.data?.length && <Text style={s.text}>No shopping trips yet.</Text>}
    {query.data?.slice(0, 20).map(trip => <View style={s.card} key={trip.id}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={[s.heading, { flex: 1 }]}>{new Date(trip.completed_at).toLocaleDateString()}</Text>
        {editing && <Pressable accessibilityRole="button"
          accessibilityLabel={`Delete purchase from ${new Date(trip.completed_at).toLocaleDateString()}`}
          disabled={busy} onPress={() => { setError(""); setSuccess(""); setRemoveFromPantry(false); setSelected(trip); }}
          style={{ minWidth: 48, minHeight: 48, borderRadius: 12, backgroundColor: brand.paleRed, alignItems: "center", justifyContent: "center" }}>
          <AppIcon name="trash-outline" size={24} color={brand.red} />
        </Pressable>}
      </View>
      <Text style={s.text}>{new Date(trip.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · £{formatNumber(trip.total_spent)}</Text>
      <MealButton title="View purchases" secondary onPress={() => router.push({ pathname: "/shoppingTrip", params: { id: trip.id } })} />
    </View>)}
    <View style={s.actionRow}>
      <MealButton title="Previous" equalWidth secondary disabled={page === 0} onPress={() => setPage(p => p - 1)} />
      <MealButton title="Next" equalWidth secondary disabled={(query.data?.length ?? 0) <= 20} onPress={() => setPage(p => p + 1)} />
    </View>
    <Text style={s.muted}>Page {page + 1}</Text>
    <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setSelected(null); }}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <ScrollView style={{ width: "100%", maxWidth: 420, maxHeight: "90%", flexGrow: 0, borderRadius: 24 }} contentContainerStyle={s.card} accessibilityViewIsModal>
          <Text style={s.heading}>Delete shopping trip?</Text>
          {selected && <Text style={s.text}>{new Date(selected.completed_at).toLocaleDateString()} · £{formatNumber(selected.total_spent)}</Text>}
          <Text style={s.muted}>This permanently removes this shopping trip and its purchased items from history and spending totals.</Text>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: removeFromPantry, disabled: busy }}
            disabled={busy} onPress={() => setRemoveFromPantry(value => !value)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
            <AppIcon name={removeFromPantry ? "checkbox" : "square-outline"} size={26} color={brand.teal} />
            <Text style={[s.text, { flex: 1 }]}>Also remove these purchased amounts from my pantry</Text>
          </Pressable>
          <Text style={s.muted}>Only available amounts will be removed; exhausted products will leave the pantry. Pantry stock is combined, so this may include amounts from later purchases.</Text>
          {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
          <View style={s.actionRow}>
            <MealButton title="Cancel" equalWidth secondary disabled={busy} onPress={() => setSelected(null)} />
            <MealButton title={busy ? "Deleting…" : "Delete trip"} equalWidth destructive disabled={busy} onPress={remove} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  </ScrollView>;
}
