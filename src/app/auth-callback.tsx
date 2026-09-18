import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { Link, router } from "expo-router";
import * as Linking from "expo-linking";
import { completeSocialSignIn } from "@/api/socialAuth";
import { passwordStyles as s } from "@/components/auth/passwordStyles";

export default function AuthCallback(){
 const url=Linking.useURL();
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  const callback=Platform.OS==="web"?window.location.href:url;
  if(!callback)return;
  completeSocialSignIn(callback).then(()=>{
   if(!active)return;
   if(Platform.OS==="web")window.history.replaceState(null,"",window.location.pathname);
   router.replace("/");
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not complete sign-in.");});
  return ()=>{active=false;};
 },[url]);
 return <View style={[s.container,s.content]}>
  {error?<><Text style={s.error}>{error}</Text><Link href="/(auth)/sign-in" replace style={s.link}>Back to sign in</Link></>
   :<><ActivityIndicator/><Text style={s.text}>Completing sign-in...</Text></>}
 </View>;
}
