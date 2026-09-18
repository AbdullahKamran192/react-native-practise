import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error("Missing server configuration"); return value; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  let operation = "authenticate";
  try {
    const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!token) return reply({ error: "Sign in again to delete your account." }, 401);
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return reply({ error: "Sign in again to delete your account." }, 401);
    const body = await req.json().catch(() => null);
    if (body?.confirmation !== "DELETE") return reply({ error: "Confirm account deletion first." }, 400);
    // Never accept a user ID or object path from the client.
    const user = data.user.id;
    const r2 = new S3Client({ region: "auto", requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
      endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") } });
    const Bucket = "foodworth-private-images";
    // Includes legacy filenames and abandoned uploads in this owner's folders.
    for (const Prefix of [`meals/${user}/`, `product-corrections/${user}/`]) {
      let ContinuationToken: string | undefined;
      do {
        operation = "ListObjectsV2";
        const page = await r2.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }));
        for (const object of page.Contents ?? []) {
          if (!object.Key?.startsWith(Prefix)) throw new Error("Unexpected object key");
          operation = "DeleteObject";
          await r2.send(new DeleteObjectCommand({ Bucket, Key: object.Key }));
        }
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
        if (page.IsTruncated && !ContinuationToken) throw new Error("Incomplete object listing");
      } while (ContinuationToken);
    }
    operation = "deleteUser";
    // The SQL trigger removes personal database rows in this same transaction.
    const deleted = await db.auth.admin.deleteUser(user, false);
    if (deleted.error) throw deleted.error;
    return reply({ deleted: true });
  } catch (error) {
    const failure = error as { name?: string; code?: string; status?: number; $metadata?: { httpStatusCode?: number } };
    console.error(JSON.stringify({ operation, code: failure.code ?? failure.name, status: failure.$metadata?.httpStatusCode ?? failure.status }));
    return reply({ error: "Account deletion could not finish. Some private photos may already be removed. Please retry." }, 500);
  }
});
