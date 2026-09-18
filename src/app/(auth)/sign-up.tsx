import SocialSignInButtons from "@/components/auth/SocialSignInButtons";
import { useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, Stack } from "expo-router";

import Colors from "@/constants/Colors";
import { supabase } from "@/lib/supabase";

const SignUpScreen = () => {
  const [socialBusy, setSocialBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function signUpWithEmail() {
    if (!email.trim() || !password) {
      Alert.alert(
        "Missing information",
        "Enter your email and password."
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Password too short",
        "Your password must contain at least 6 characters."
      );
      return;
    }

    try {
      setIsLoading(true);

      const {
        data: { session },
        error,
      } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        Alert.alert("Sign-up failed", error.message);
        return;
      }

      if (!session) {
        Alert.alert(
          "Check your email",
          "We sent you a link to confirm your account. Confirm it and then sign in."
        );
      }
    } catch {
      Alert.alert(
        "Something went wrong",
        "Check your internet connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Sign up" }} />

      <Text style={styles.label}>Email</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />

      <Text style={styles.label}>Password</Text>

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <Button
        onPress={signUpWithEmail}
        title={isLoading ? "Creating account..." : "Create account"}
        disabled={isLoading || socialBusy}
      />

      <SocialSignInButtons disabled={isLoading} onBusyChange={setSocialBusy} />

      <Link href="/(auth)/sign-in" style={styles.textButton}>
        Already have an account? Sign in
      </Link>
    </ScrollView>
  );
};

export default SignUpScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    backgroundColor: "#F7F7F7",
    padding: 20,
  },

  label: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D5D5D5",
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 14,
    fontSize: 16,
    color: "#222",
  },

  textButton: {
    alignSelf: "center",
    fontWeight: "700",
    color: Colors.light.tint,
    marginVertical: 18,
  },
});