import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export async function deleteAccount() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error("Sign in again to delete your account.");
  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.deleted !== true) throw new Error(result.error ?? "Could not delete your account. Please try again.");
  // Clear this user's consumption retries and shopping cart; leave other storage alone.
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`foodworth:food-log:${session.user.id}:`) || key === `shopping-cart:${session.user.id}`);
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    console.warn("Account deleted; local saved data cleanup failed.");
  }
  await supabase.auth.signOut({ scope: "local" });
}
