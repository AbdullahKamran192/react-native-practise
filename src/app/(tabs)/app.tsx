import { useState } from "react";
import {
  Alert,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";

export default function AccountScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    try {
      setIsSigningOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        Alert.alert("Sign-out failed", error.message);
      }
    } catch {
      Alert.alert(
        "Something went wrong",
        "Could not sign you out. Please try again."
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>

      <Text style={styles.description}>
        Sign out of your account on this device.
      </Text>

      <Button
        title={isSigningOut ? "Signing out..." : "Sign out"}
        onPress={signOut}
        disabled={isSigningOut}
        color="#D32F2F"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F7F7",
  },

  title: {
    marginBottom: 10,
    color: "#222",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },

  description: {
    marginBottom: 24,
    color: "#666",
    fontSize: 15,
    textAlign: "center",
  },
});