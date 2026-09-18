import { supabase } from "@/lib/supabase";

export function recoveryParameters(url: string) {
 const query = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
 const params = new URLSearchParams(query);
 const fragment = new URLSearchParams(url.split("#")[1] ?? "");
 fragment.forEach((value,key)=>params.set(key,value));
 if(params.has("error") || params.has("error_code")) throw new Error("This reset link is invalid or expired. Request a new one.");
 if(params.get("type") !== "recovery") throw new Error("Open the password reset link from your email first.");
 const hash=params.get("token_hash");
 if(hash)return {token_hash:hash};
 const access=params.get("access_token"),refresh=params.get("refresh_token");
 if(access&&refresh)return {access_token:access,refresh_token:refresh};
 throw new Error("This reset link is incomplete. Request a new one.");
}

export async function startPasswordRecovery(url: string) {
 const credentials=recoveryParameters(url);
 const result="token_hash" in credentials
  ? await supabase.auth.verifyOtp({token_hash:credentials.token_hash!,type:"recovery"})
  : await supabase.auth.setSession({access_token:credentials.access_token!,refresh_token:credentials.refresh_token!});
 if(result.error || !result.data.session)throw new Error("This reset link is invalid or expired. Request a new one.");
 return result.data.session.user.id;
}

export async function saveRecoveredPassword(password: string, userId: string) {
 const {data:{session}}=await supabase.auth.getSession();
 if(!session || session.user.id!==userId)throw new Error("Your reset session ended. Request a new reset link.");
 const {error}=await supabase.auth.updateUser({password});
 if(error)throw error;
}
