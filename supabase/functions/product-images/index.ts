import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type":"application/json", "Cache-Control":"no-store" } });
const env = (name: string) => { const value=Deno.env.get(name); if (!value) throw new Error(`Missing setting ${name}`); return value; };
const reasons = ["wrong_product","poor_quality","duplicate","personal_information","offensive","abusive","other"];
const privateBucket="foodworth-private-images", publicBucket="foodworth-public-images";
const maxBytes=2*1024*1024;

async function readPhoto(body: unknown): Promise<Uint8Array> {
 const sdkBody=body as {getReader?:unknown;transformToWebStream?:()=>ReadableStream<Uint8Array>}|undefined;
 const stream=typeof sdkBody?.getReader==="function"
  ? body as ReadableStream<Uint8Array>
  : sdkBody?.transformToWebStream?.();
 if(!stream) throw new Error("Photo body is unavailable.");
 let length=0;
 const limited=stream.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
  transform(chunk,controller) {
   length+=chunk.byteLength;
   if(length>maxBytes) throw new Error("Photo must be under 2 MiB.");
   controller.enqueue(chunk);
  },
 }));
 const bytes=new Uint8Array(await new Response(limited).arrayBuffer());
 const decoder=new TextDecoder();
 if(bytes.length<12 || decoder.decode(bytes.subarray(0,4))!=="RIFF" || decoder.decode(bytes.subarray(8,12))!=="WEBP") {
  throw new Error("Invalid WebP photo.");
 }
 return bytes;
}

// Log selected diagnostics only, never SDK request/response objects or URLs.
const safeText = (value: unknown) => {
 if(typeof value!=="string") return null;
 let text=value;
 for(const name of ["R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","SUPABASE_SERVICE_ROLE_KEY"]) {
  const secret=Deno.env.get(name); if(secret) text=text.split(secret).join("[redacted]");
 }
 return text.replace(/https?:\/\/\S+/gi,"[url redacted]")
  .replace(/Bearer\s+\S+/gi,"Bearer [redacted]")
  .replace(/(?:Authorization|X-Amz-[\w-]+|AWSAccessKeyId|Signature)\s*[=:]\s*[^\r\n]+/gi,"[authentication redacted]")
  .slice(0,600);
};
const logError = (operation: string, error: unknown, bucket: string|null=null) => {
 const e=error as {name?:unknown;code?:unknown;Code?:unknown;message?:unknown;$metadata?:{httpStatusCode?:number}}|null;
 console.error(JSON.stringify({event:"product_image_error",operation,bucket,
  http_status:e?.$metadata?.httpStatusCode??null,
  code:safeText(e?.Code??e?.code??e?.name),message:safeText(e?.message)}));
};
async function r2Request<T>(operation: string, bucket: string, send: ()=>Promise<T>): Promise<T> {
 try {
  const result=await send();
  const metadata=(result as {$metadata?:{httpStatusCode?:number}})?.$metadata;
  console.info(JSON.stringify({event:"product_image_r2",operation,bucket,http_status:metadata?.httpStatusCode??null}));
  return result;
 } catch(error) { logError(operation,error,bucket); throw error; }
}

Deno.serve(async req => {
 if(req.method==="OPTIONS") return new Response(null,{headers:cors});
 if(req.method!=="POST") return reply({error:"Use POST."},405);
 try {
  const db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
  const token=req.headers.get("authorization")?.replace(/^Bearer /i,"");
  if(!token) return reply({error:"Sign in to continue."},401);
  const auth=await db.auth.getUser(token);
  if(auth.error || !auth.data.user) return reply({error:"Sign in again."},401);
  const actor=auth.data.user.id;
  const params=new URL(req.url).searchParams;
  const action=params.get("action");
  const admin=await db.from("admin_users").select("user_id").eq("user_id",actor).maybeSingle();
  if(admin.error) throw admin.error;
  if(action==="admin-status") return reply({isAdmin:!!admin.data});
  if(!["list-pending","approve","reject","upload","own-status"].includes(action??"")) return reply({error:"Unknown action."},400);
  if(["list-pending","approve","reject"].includes(action!) && !admin.data) return reply({error:"Not authorised."},403);
  const r2=new S3Client({region:"auto",requestChecksumCalculation:"WHEN_REQUIRED",responseChecksumValidation:"WHEN_REQUIRED",endpoint:`https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,credentials:{accessKeyId:env("R2_ACCESS_KEY_ID"),secretAccessKey:env("R2_SECRET_ACCESS_KEY")}});
  const signed=(key:string)=>r2Request("SignGetObject",privateBucket,()=>getSignedUrl(r2,new GetObjectCommand({Bucket:privateBucket,Key:key,ResponseCacheControl:"no-store"}),{expiresIn:300}));
  if(action==="list-pending") {
   const result=await db.from("product_corrections").select("user_id,product_barcode,product_name,image_path,image_submitted_at",{count:"exact"})
    .eq("image_status","pending").is("image_reviewed_by",null).not("image_path","is",null).order("image_submitted_at").limit(20);
   if(result.error) throw result.error;
   const items=await Promise.all((result.data??[]).map(async row=>({...row,url:await signed(row.image_path)})));
   return reply({items,count:result.count??0});
  }
  const barcode=params.get("barcode")??"";
  if(!/^(?:[0-9]{8}|[0-9]{12,14})$/.test(barcode)) return reply({error:"Choose a valid barcode."},400);
  const user=action==="approve"||action==="reject" ? params.get("userId")??"" : actor;
  if(!/^[0-9a-f-]{36}$/i.test(user)) return reply({error:"Invalid submission."},400);
  const path=`product-corrections/${user}/${barcode}/image.webp`;
  const publicPath=`products/${barcode}/image.webp`;
  if(action==="own-status") {
   const correction=await db.from("product_corrections").select("image_status,image_path,image_rejection_reason,image_reviewed_by").eq("user_id",actor).eq("product_barcode",barcode).maybeSingle();
   const moderation=await db.from("user_image_moderation").select("violation_count,image_upload_blocked").eq("user_id",actor).maybeSingle();
   const product=await db.from("products").select("image_path,image_url").eq("barcode_number",barcode).maybeSingle();
   if(correction.error||moderation.error||product.error) throw correction.error??moderation.error??product.error;
   const c=correction.data;
   return reply({status:c?.image_status??null,reason:c?.image_rejection_reason??null,
    blocked:!!moderation.data?.image_upload_blocked || (moderation.data?.violation_count??0)>=3,
    shared:product.data, url:c?.image_status==="pending" && c.image_path===path && !c.image_reviewed_by ? await signed(path):null});
  }
  const reason=params.get("reason");
  if(action==="reject" && !reasons.includes(reason??"")) return reply({error:"Choose a rejection reason."},400);
  let bytes:Uint8Array|undefined;
  if(action==="upload") {
   if(req.headers.get("content-type")!=="image/webp") return reply({error:"Choose a WebP photo."},400);
   const reader=req.body?.getReader(); if(!reader) return reply({error:"Empty photo."},400);
   const chunks:Uint8Array[]=[]; let length=0;
   while(true) { const {value,done}=await reader.read(); if(done)break; length+=value.length;
    if(length>maxBytes) { await reader.cancel(); return reply({error:"Photo must be under 2 MiB."},413); } chunks.push(value); }
   bytes=new Uint8Array(length); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const decoder=new TextDecoder();
   if(length<12 || decoder.decode(bytes.slice(0,4))!=="RIFF" || decoder.decode(bytes.slice(8,12))!=="WEBP") return reply({error:"Invalid WebP photo."},400);
  }
  const claim=await db.rpc("begin_product_image_action",{p_actor:actor,p_user:user,p_barcode:barcode,p_action:action,p_submitted:params.get("submittedAt")});
  if(claim.error) { logError("begin_product_image_action",claim.error); return reply({error:claim.error.message},409); }
  const {ticket,previous}=claim.data;
  let privateDeleted=false, committed=false;
  try {
   if(action==="upload") {
    await r2Request("PutObject",privateBucket,()=>r2.send(new PutObjectCommand({Bucket:privateBucket,Key:path,Body:bytes,ContentType:"image/webp",CacheControl:"no-store"})));
   } else {
    if(previous.image_path!==path) throw new Error("Invalid private image path.");
    const object=await r2Request("GetObject",privateBucket,()=>r2.send(new GetObjectCommand({Bucket:privateBucket,Key:path})));
    bytes=await r2Request("ReadObjectBody",privateBucket,()=>readPhoto(object.Body));
    if(action==="approve") await r2Request("PutObject",publicBucket,()=>r2.send(new PutObjectCommand({Bucket:publicBucket,Key:publicPath,Body:bytes,ContentType:"image/webp",CacheControl:"no-store"})));
    await r2Request("DeleteObject",privateBucket,()=>r2.send(new DeleteObjectCommand({Bucket:privateBucket,Key:path}))); privateDeleted=true;
   }
   const finish=await db.rpc("finish_product_image_action",{p_actor:actor,p_user:user,p_barcode:barcode,p_action:action,p_ticket:ticket,p_reason:reason});
   if(finish.error) { logError("finish_product_image_action",finish.error); throw finish.error; }
   committed=true;
   return reply({success:true});
  } catch(error) {
   if(!committed) {
    // Best-effort synchronous rollback. No scheduled cleanup is introduced.
    try {
     // A lost database response may conceal a successful commit. Check before
     // restoring a rejected private image or releasing a completed review.
     const current=await db.from("product_corrections").select("image_reviewed_at,image_reviewed_by,image_status").eq("user_id",user).eq("product_barcode",barcode).single();
     if(current.error) { logError("rollback_read",current.error); throw current.error; }
     if(current.data.image_reviewed_by===actor && new Date(current.data.image_reviewed_at).getTime()===new Date(ticket).getTime() && current.data.image_status==="pending") {
      if(action==="upload") {
       // PUT may have failed before creating an object, or its response may have
       // been lost. Attempt cleanup, but R2 denial must not prevent DB release.
       try { await r2Request("RollbackDeleteObject",privateBucket,()=>r2.send(new DeleteObjectCommand({Bucket:privateBucket,Key:path}))); }
       catch { /* Failure is already logged; still restore the correction. */ }
      } else if(privateDeleted && bytes) await r2Request("RollbackPutObject",privateBucket,()=>r2.send(new PutObjectCommand({Bucket:privateBucket,Key:path,Body:bytes,ContentType:"image/webp",CacheControl:"no-store"})));
      const restored=await db.from("product_corrections").update({image_status:previous.image_status,image_reviewed_by:previous.image_reviewed_by,image_reviewed_at:previous.image_reviewed_at})
       .eq("user_id",user).eq("product_barcode",barcode).eq("image_reviewed_at",ticket).eq("image_reviewed_by",actor).eq("image_status","pending");
      if(restored.error) { logError("rollback_restore",restored.error); throw restored.error; }
     }
    } catch(recoveryError) { logError("manual_recovery_required",recoveryError); }
   }
   throw error;
  }
 } catch(error) {
  logError("request_failed",error);
  return reply({error:"Could not complete the product photo operation. Refresh and try again."},500);
 }
});
