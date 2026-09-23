import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { startPasswordRecovery, saveRecoveredPassword } from "@/api/passwordRecovery";
import { passwordStyles as baseS } from "@/components/auth/passwordStyles";

export default function ResetPassword() {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

 const url=Linking.useURL();
 const params=useLocalSearchParams<{token_hash?:string;type?:string}>();
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [busy,setBusy]=useState(false);
 const [done,setDone]=useState(false);
 const [error,setError]=useState("");
 const recovered=useRef<{url:string;userId:string}|null>(null);
 const lock=useRef(false);
 const client=useQueryClient();
 async function reset() {
  if(lock.current)return;
  if(password.length<8){setError("Use at least 8 characters for your new password.");return;}
  if(password!==confirm){setError("The passwords do not match.");return;}
  lock.current=true;setBusy(true);setError("");
  try {
   const link=params.token_hash
    ? "myapp://reset-password?"+new URLSearchParams({token_hash:params.token_hash,type:params.type??""}).toString()
    : Platform.OS==="web"&&typeof window!=="undefined"?window.location.href:url??"";
   if(recovered.current?.url!==link){
    await client.cancelQueries();
    client.clear();
    const userId=await startPasswordRecovery(link);
    recovered.current={url:link,userId};
   }
   await saveRecoveredPassword(password,recovered.current.userId);
   setPassword("");setConfirm("");setDone(true);
   await supabase.auth.signOut({scope:"local"});
   client.clear();
   if(Platform.OS==="web"&&typeof window!=="undefined")window.history.replaceState(null,"",window.location.pathname);
  }catch(e){setError(e instanceof Error?e.message:"Could not reset your password. Please try again.");}
  finally{lock.current=false;setBusy(false);}
 }
 return <KeyboardAvoidingView style={s.container} behavior={Platform.OS==="ios"?"padding":undefined}>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.title}>{done?"Password updated":"Reset password"}</Text>
   {done?<>
    <Text style={s.text}>Your new password is ready. Sign in to continue.</Text>
    <Link href="/(auth)/sign-in" replace style={s.link}>Back to sign in</Link>
   </>:<>
    <Text style={s.text}>Choose a new password with at least 8 characters.</Text>
    <Text style={s.label}>New password</Text>
    <TextInput accessibilityLabel="New password" style={s.input} value={password} onChangeText={setPassword} editable={!busy}
     secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
    <Text style={s.label}>Confirm new password</Text>
    <TextInput accessibilityLabel="Confirm new password" style={s.input} value={confirm} onChangeText={setConfirm} editable={!busy}
     secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
    {!!error&&<Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void reset()} style={[s.button,busy&&{opacity:0.6}]}>
     {busy?<ActivityIndicator color={appTheme.color("white", "text")}/>:<Text style={s.buttonText}>Update password</Text>}
    </Pressable>
    {!busy&&<Link href="/forgot-password" replace style={s.link}>Request a new reset link</Link>}
   </>}
  </ScrollView>
 </KeyboardAvoidingView>;
}
