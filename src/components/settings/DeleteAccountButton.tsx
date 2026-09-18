import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { deleteAccount } from "@/api/deleteAccount";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";

export default function DeleteAccountButton({ disabled }: { disabled?: boolean }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function remove() {
    if (lock.current || confirmation !== "DELETE") return;
    lock.current = true; setBusy(true); setError("");
    try {
      await client.cancelQueries();
      await deleteAccount();
      client.clear();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your account.");
    } finally { lock.current = false; setBusy(false); }
  }
  return <>
    <Pressable accessibilityRole="button" disabled={disabled || busy} style={[styles.trigger, disabled && styles.disabled]}
      onPress={() => { setConfirmation(""); setError(""); setOpen(true); }}>
      <AppIcon name="trash-outline" size={21} color={brand.red} />
      <Text style={styles.red}>Delete account</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.dialog} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" accessibilityViewIsModal>
          <Text style={styles.title}>Permanently delete account?</Text>
          <Text style={styles.text}>This removes your account, pantry, food history, meals and ingredients, private photos, preferences, corrections and any admin access. This cannot be undone.</Text>
          <Text style={styles.text}>Shared catalogue products and approved public product photos remain available to everyone, without your account link.</Text>
          <Text style={styles.text}>Type DELETE to confirm.</Text>
          <TextInput accessibilityLabel="Type DELETE to confirm account deletion" value={confirmation} onChangeText={setConfirmation}
            editable={!busy} autoCapitalize="characters" autoCorrect={false} style={styles.input} />
          {!!error && <Text style={styles.red} accessibilityLiveRegion="polite">{error}</Text>}
          <Pressable accessibilityRole="button" disabled={busy || confirmation !== "DELETE"} onPress={() => void remove()}
            style={[styles.confirm, (busy || confirmation !== "DELETE") && styles.disabled]}>
            {busy ? <ActivityIndicator color={brand.surface} /> : <Text style={styles.white}>Permanently delete account</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setOpen(false)} style={styles.cancel}>
            <Text style={styles.text}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 54, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: brand.red },
  red: { color: brand.red, fontSize: 15, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { flexGrow: 0, maxHeight: "90%", width: "100%", maxWidth: 440, borderRadius: 20, backgroundColor: brand.surface },
  content: { padding: 24, gap: 16 },
  title: { color: brand.ink, fontSize: 22, fontWeight: "700" },
  text: { color: brand.muted, fontSize: 15, lineHeight: 22 },
  input: { minHeight: 48, borderWidth: 1, borderColor: brand.border, borderRadius: 12, padding: 12, color: brand.ink, fontSize: 18 },
  confirm: { backgroundColor: brand.red, borderRadius: 12, minHeight: 52, padding: 14, alignItems: "center", justifyContent: "center" },
  white: { color: brand.surface, fontSize: 15, fontWeight: "700", textAlign: "center" },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.45 },
});
