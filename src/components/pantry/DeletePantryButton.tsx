import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { deletePantryItem } from "@/api/products/pantryDetails";
import type { PantryItem } from "@/api/products";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";

export default function DeletePantryButton({ item, fullWidth = false, disabled = false, onDeleted, onBusyChange }: {
  item: PantryItem; fullWidth?: boolean; disabled?: boolean;
  onDeleted?: () => void; onBusyChange?: (busy: boolean) => void;
}) {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const name = item.product?.product_name ?? item.generic_product?.product_name ?? "this product";
  async function remove() {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(""); onBusyChange?.(true);
    try {
      await deletePantryItem(item.id);
      await client.cancelQueries({ queryKey: ["pantry"] });
      setOpen(false);
      onDeleted?.();
      client.setQueriesData<PantryItem[]>({ queryKey: ["pantry", "amount-remaining"] },
        rows => rows?.filter(row => row.id !== item.id));
      client.setQueryData(["pantry", "detail", String(item.id)], null);
      void client.invalidateQueries({ queryKey: ["pantry"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this pantry item.");
    } finally { lock.current = false; setSaving(false); onBusyChange?.(false); }
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${name} from pantry`}
      disabled={disabled || saving} accessibilityState={{ disabled: disabled || saving }}
      onPress={() => { setError(""); setOpen(true); }}
      style={[s.trigger, fullWidth && s.fullWidth, (disabled || saving) && { opacity: 0.45 }]}>
      <AppIcon name="trash-outline" size={23} color={appTheme.color(brand.red, "text")} />
      {fullWidth && <Text style={s.deleteText}>Delete from pantry</Text>}
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!saving) setOpen(false); }}>
      <View style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal>
        <Text style={s.title}>Delete {name}?</Text>
        <Text style={s.description}>Remove all of this product from your pantry? To remove only part of it, cancel and edit the amount remaining.</Text>
        {!!error && <Text style={s.deleteText} accessibilityLiveRegion="polite">{error}</Text>}
        <View style={s.actions}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => setOpen(false)} style={s.cancel}><Text style={s.description}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Confirm pantry deletion" disabled={saving} onPress={() => void remove()} style={s.confirm}>
            {saving ? <ActivityIndicator color={appTheme.color(brand.surface, "text")} /> : <Text style={s.white}>Delete</Text>}
          </Pressable>
        </View>
      </View></View>
    </Modal>
  </>;
}
const baseS = StyleSheet.create({
  trigger: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: brand.paleRed, borderRadius: 12 },
  fullWidth: { flexDirection: "row", gap: 10, padding: 16, marginTop: 20 },
  deleteText: { color: brand.red, fontSize: 15, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 420, backgroundColor: brand.surface, borderRadius: 20, padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: "700", color: brand.ink },
  description: { fontSize: 15, lineHeight: 22, color: brand.muted },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  cancel: { padding: 14, minWidth: 80, alignItems: "center" },
  confirm: { padding: 14, minWidth: 90, borderRadius: 12, backgroundColor: brand.red, alignItems: "center" },
  white: { color: brand.surface, fontWeight: "600" },
});
