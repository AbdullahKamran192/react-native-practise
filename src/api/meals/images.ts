import { supabase } from "@/lib/supabase";

export async function mealImageRequest(action: "view" | "upload" | "remove" | "delete-meal", mealId: string, body?: ArrayBuffer) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to manage meal photos.");
  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meal-images?action=${action}&mealId=${encodeURIComponent(mealId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", "Content-Type": body ? "image/webp" : "application/json" },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Meal photo service unavailable. Check its deployment and try again.");
  return data as { url?: string | null; image_path?: string | null };
}
