import { supabase } from "@/lib/supabase";
export const rejectionReasons = {
 wrong_product: "Wrong product", poor_quality: "Poor image quality", duplicate: "Duplicate image",
 personal_information: "Personal information visible", offensive: "Offensive content", abusive: "Abusive submission", other: "Other",
} as const;
export type RejectionReason = keyof typeof rejectionReasons;
export type PendingProductImage = { user_id: string; product_barcode: string; product_name: string | null; image_submitted_at: string; url: string };
export type OwnProductImage = { status: "pending" | "approved" | "rejected" | null; reason: RejectionReason | null; blocked: boolean; url: string | null; shared: {image_path: string | null;image_url: string | null} | null };
export async function productImageRequest<T>(action: string, params: Record<string,string> = {}, bytes?: ArrayBuffer): Promise<T> {
 const {data:{session}} = await supabase.auth.getSession();
 if(!session) throw new Error("Sign in to manage product photos.");
 const query = new URLSearchParams({action,...params});
 const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/product-images?${query}`,{
  method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"","Content-Type":bytes?"image/webp":"application/json"},body:bytes,
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(data.error??"Product photo service unavailable.");
 return data as T;
}
