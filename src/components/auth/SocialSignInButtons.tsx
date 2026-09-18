import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/brand/AppIcon";
import { brand } from "@/components/brand/theme";
import { signInWithProvider, type SocialProvider } from "@/api/socialAuth";

export default function SocialSignInButtons({disabled=false,onBusyChange}:{disabled?:boolean;onBusyChange?:(busy:boolean)=>void}) {
 const [busy,setBusy]=useState<SocialProvider|null>(null);
 const [error,setError]=useState("");
 const lock=useRef(false);
 async function signIn(provider:SocialProvider){
  if(lock.current||disabled)return;
  lock.current=true;setBusy(provider);setError("");onBusyChange?.(true);
  try{await signInWithProvider(provider);}
  catch(e){setError(e instanceof Error?e.message:"Could not sign in. Please try again.");}
  finally{lock.current=false;setBusy(null);onBusyChange?.(false);}
 }
 return <View style={s.container}>
  <View style={s.separator}><View style={s.line}/><Text style={s.or}>or continue with</Text><View style={s.line}/></View>
  {(["google","apple"] as const).map(provider=><Pressable key={provider} accessibilityRole="button"
   disabled={disabled||!!busy} onPress={()=>void signIn(provider)}
   style={[s.button,provider==="apple"&&s.apple,(disabled||!!busy)&&{opacity:0.6}]}>
   {busy===provider?<ActivityIndicator color={provider==="apple"?"white":brand.ink}/>:<AppIcon name={provider==="apple"?"logo-apple":"logo-google"} size={23} color={provider==="apple"?"white":brand.ink}/>}
   <Text style={[s.label,provider==="apple"&&{color:"white"}]}>Continue with {provider==="apple"?"Apple":"Google"}</Text>
  </Pressable>)}
  {!!error&&<Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
 </View>;
}
const s=StyleSheet.create({
 container:{gap:12,marginTop:20},separator:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:4},
 line:{height:1,flex:1,backgroundColor:brand.border},or:{color:brand.muted,fontSize:13},
 button:{minHeight:52,borderRadius:12,borderWidth:1,borderColor:brand.border,backgroundColor:brand.surface,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12,padding:12},
 apple:{backgroundColor:"#000",borderColor:"#000"},label:{color:brand.ink,fontSize:16,fontWeight:"600"},error:{color:brand.red,fontSize:14,lineHeight:20},
});
