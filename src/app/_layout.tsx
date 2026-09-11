import type { Session } from "@supabase/supabase-js";
import { Stack } from "expo-router";
import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";
import QueryProvider from "@/providers/QueryProvider";

export default function RootLayout() {
  const [session, setSession] =
    useState<Session | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          "Could not load session:",
          error.message
        );
      }

      setSession(session);
      setIsLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#222"
        />

        <Text style={styles.loadingText}>
          Loading your account...
        </Text>
      </View>
    );
  }

  return (
    <QueryProvider>
      <Stack>
        {/* Available only when signed out */}
        <Stack.Protected guard={!session}>
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
            }}
          />
        </Stack.Protected>

        {/* Available only when signed in */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="camera"
            options={{
              title: "Scan Food",
              headerBackTitle: "Back",
            }}
          />

          <Stack.Screen
            name="productPantry"
            options={{
              title: "Product Details",
              headerBackTitle: "Back",
            }}
          />

          <Stack.Screen
            name="productConsume"
            options={{
              title: "Consume Food",
              headerBackTitle: "Back",
            }}
          />

          {/*
           * Keep the old product route temporarily
           * while productPantry is being tested.
           * Remove this screen after all old route
           * references have been replaced.
           */}
          <Stack.Screen
            name="product"
            options={{
              title: "Product Details",
              headerBackTitle: "Back",
            }}
          />
        </Stack.Protected>
      </Stack>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#777",
    fontSize: 14,
    marginTop: 14,
  },
});
