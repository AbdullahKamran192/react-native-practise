import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing server setting: ${name}`); return value; };
const MAX_BYTES = 2 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  try {
    const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const action = new URL(req.url).searchParams.get("action");
    if (!["view", "upload", "remove", "delete-meal"].includes(action ?? "")) return reply({ error: "Unknown action." }, 400);
    const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) return reply({ error: "Sign in to manage meal photos." }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Sign in again." }, 401);
    const userId = auth.user.id;
    const r2 = new S3Client({ region: "auto", endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") } });
    const Bucket = "foodworth-private-images";
    const id = new URL(req.url).searchParams.get("mealId") ?? "";
    if (!/^[1-9][0-9]*$/.test(id)) return reply({ error: "Choose a meal." }, 400);
    const { data: meal, error } = await db.from("meals").select("id,image_path").eq("id", id).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!meal) return reply({ error: "Meal not found." }, 404);
    const path = `meals/${userId}/${id}/image.webp`;
    // Accept a legacy UUID filename only inside this owner's exact meal folder.
    // Never trust a stored path to identify another user's object.
    if (meal.image_path && meal.image_path !== path &&
      !new RegExp(`^meals/${userId}/${id}/[0-9a-f-]{36}\\.webp$`).test(meal.image_path)) {
      return reply({ error: "This meal has an invalid photo path." }, 400);
    }
    const signedUrl = (key: string) => getSignedUrl(r2, new GetObjectCommand({
      Bucket, Key: key, ResponseCacheControl: "no-store",
      // This signed response parameter makes every viewing URL distinct, even
      // for two replacements within the same second. The R2 key stays fixed.
      ResponseContentDisposition: `inline; filename="meal-${Date.now()}-${Math.random().toString(36).slice(2)}.webp"`,
    }), { expiresIn: 900 });
    if (action === "view") return reply({ url: meal.image_path ? await signedUrl(meal.image_path) : null });
    if (action === "remove" || action === "delete-meal") {
      for (const key of new Set([path, ...(meal.image_path ? [meal.image_path] : [])])) {
        await r2.send(new DeleteObjectCommand({ Bucket, Key: key }));
      }
      // Do not change the database if any R2 deletion failed.
      const result = action === "delete-meal"
        ? await db.from("meals").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle()
        : await db.from("meals").update({ image_path: null }).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return reply({ error: "Meal no longer available." }, 404);
      return reply({ image_path: null, url: null });
    }
    if (action === "upload") {
      if (req.headers.get("content-type") !== "image/webp") return reply({ error: "Upload a WebP photo." }, 400);
      // Read with a hard cap even when Content-Length is missing or dishonest.
      const reader = req.body?.getReader();
      if (!reader) return reply({ error: "Photo is empty." }, 400);
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.length;
        if (length > MAX_BYTES) { await reader.cancel(); return reply({ error: "Photo must be under 2 MB." }, 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const decoder = new TextDecoder();
      if (length < 12 || decoder.decode(bytes.slice(0,4)) !== "RIFF" || decoder.decode(bytes.slice(8,12)) !== "WEBP") return reply({ error: "Invalid WebP photo." }, 400);
      if (meal.image_path && meal.image_path !== path) {
        await r2.send(new DeleteObjectCommand({ Bucket, Key: meal.image_path }));
      }
      await r2.send(new PutObjectCommand({ Bucket, Key: path, Body: bytes, ContentType: "image/webp", CacheControl: "no-store" }));
    }
    const saved = await db.from("meals").update({ image_path: path }).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) return reply({ error: "Meal no longer available." }, 404);
    return reply({ image_path: path, url: await signedUrl(path) });
  } catch (error) {
    console.error("Meal image operation failed", error instanceof Error ? error.name : "Backend error");
    return reply({ error: "Could not complete the photo operation. Please try again." }, 500);
  }
});
