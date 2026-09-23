import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from "react-native";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { passwordStyles as baseS } from "@/components/auth/passwordStyles";

export default function ForgotPassword() {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

 const [email,setEmail]=useState("");
 const [busy,setBusy]=useState(false);
 const [sent,setSent]=useState(false);
 const [error,setError]=useState("");
 const lock=useRef(false);
 async function send() {
  if(lock.current)return;
  const address=email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){setError("Enter a valid email address.");return;}
  lock.current=true;setBusy(true);setError("");
  try {
   const redirectTo=Linking.createURL("reset-password");
   const {error}=await supabase.auth.resetPasswordForEmail(address,{redirectTo});
   if(error)throw error;
   setSent(true);
  }catch(e){setError(e instanceof Error?e.message:"Could not send the email. Please try again.");}
  finally{lock.current=false;setBusy(false);}
 }
 return <KeyboardAvoidingView style={s.container} behavior={Platform.OS==="ios"?"padding":undefined}>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.title}>Forgot password?</Text>
   {sent ? <Text style={s.text} accessibilityLiveRegion="polite">If an account exists for this email, you?ll receive a password reset link. Check your inbox and spam folder.</Text> : <>
    <Text style={s.text}>Enter your account email and we?ll send you a reset link.</Text>
    <Text style={s.label}>Email</Text>
    <TextInput accessibilityLabel="Email address" style={s.input} value={email} onChangeText={setEmail} editable={!busy}
     keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@example.com" />
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void send()} style={[s.button,busy&&{opacity:0.6}]}>
     {busy?<ActivityIndicator color={appTheme.color("white", "text")}/>:<Text style={s.buttonText}>Send reset link</Text>}
    </Pressable>
   </>}
   {!!error&&<Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
   <Link href="/(auth)/sign-in" replace style={s.link}>Back to sign in</Link>
  </ScrollView>
 </KeyboardAvoidingView>;
}
