import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

export type SocialProvider = "google" | "apple";
let lastCallback: { url: string; result: Promise<void> } | undefined;

export function completeSocialSignIn(url: string): Promise<void> {
 if(lastCallback?.url===url)return lastCallback.result;
 const result=(async()=>{
  const query=new URLSearchParams(url.split("?")[1]?.split("#")[0]??"");
  new URLSearchParams(url.split("#")[1]??"").forEach((v,k)=>query.set(k,v));
  if(query.has("error")||query.has("error_code"))throw new Error("Sign-in was cancelled or declined. Please try again.");
  if(query.get("type")==="recovery")throw new Error("Use the password reset screen for this link.");
  const access_token=query.get("access_token"),refresh_token=query.get("refresh_token");
  if(!access_token||!refresh_token)throw new Error("The sign-in link is incomplete. Please try again.");
  const {error}=await supabase.auth.setSession({access_token,refresh_token});
  if(error)throw new Error("Could not complete sign-in. Please try again.");
 })();
 lastCallback={url,result};
 return result;
}

export async function signInWithProvider(provider: SocialProvider) {
 const redirectTo=Linking.createURL("auth-callback");
 const {data,error}=await supabase.auth.signInWithOAuth({
  provider,options:{redirectTo,skipBrowserRedirect:true},
 });
 if(error)throw error;
 if(!data.url)throw new Error("This sign-in provider is not available yet.");
 if(Platform.OS==="web"){
  window.location.assign(data.url);
  return;
 }
 const result=await WebBrowser.openAuthSessionAsync(data.url,redirectTo);
 if(result.type==="success") {
  await completeSocialSignIn(result.url);
  return true;
 }
 return false;
}
