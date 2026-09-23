import { AppThemeProvider, useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
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
import SettingsButton from "@/components/SettingsButton";

export default function RootLayout() {
  return <AppThemeProvider><RootNavigator /></AppThemeProvider>;
}

function RootNavigator() {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

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
          color={appTheme.color("#222", "text")}
        />

        <Text style={styles.loadingText}>
          Loading your account...
        </Text>
      </View>
    );
  }

  return (
    <QueryProvider>
      <Stack screenOptions={{ headerRight: () => session ? <SettingsButton /> : null }}>
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
            options={{ headerShown: false }}
          />
          <Stack.Screen name="shopping" options={{ title: "Shopping", headerBackTitle: "Back" }} />
          <Stack.Screen name="shoppingSearch" options={{ title: "Find a purchase", headerBackTitle: "Back" }} />
          <Stack.Screen name="shoppingItem" options={{ title: "Add to cart", headerBackTitle: "Back" }} />
          <Stack.Screen name="shoppingHistory" options={{ title: "Purchase history", headerBackTitle: "Back" }} />
          <Stack.Screen name="shoppingTrip" options={{ title: "Shopping details", headerBackTitle: "Back" }} />
          <Stack.Screen
            name="settings"
            options={{
              title: "Settings",
              headerRight: () => null,
              headerBackTitle: "Back",
            }}
          />

          <Stack.Screen name="admin/productImages" options={{ title: "Product image reviews", headerBackTitle: "Back" }} />
          {["exploreMeals", "publicMealDetails", "publicMealReplacement", "publicMealSearch", "publicMealProduct"].map(name => <Stack.Screen key={name} name={name} options={{ title: name === "exploreMeals" ? "Explore Meals" : name === "publicMealDetails" ? "Public meal" : "Choose ingredient", headerBackTitle: "Back" }} />)}
          <Stack.Screen name="createMeal" options={{ title: "Create meal", headerBackTitle: "Back" }} />
          <Stack.Screen name="mealDetails" options={{ title: "Meal details", headerBackTitle: "Back" }} />
          <Stack.Screen name="consumptionDetails" options={{ title: "Consumption details", headerBackTitle: "Back" }} />
          <Stack.Screen name="pantryDetails" options={{ title: "Pantry item", headerBackTitle: "Back" }} />
          <Stack.Screen name="mealReplacement" options={{ title: "Replace ingredient", headerBackTitle: "Back" }} />
          <Stack.Screen name="mealSearch" options={{ title: "Find ingredient", headerBackTitle: "Back" }} />
          <Stack.Screen name="mealIngredient" options={{ title: "Add ingredient", headerBackTitle: "Back" }} />

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
        <Stack.Screen name="forgot-password" options={{ title: "Forgot password", headerRight: () => null }} />
        <Stack.Screen name="privacy-policy" options={{ title: "Privacy Policy", headerBackTitle: "Back", headerRight: () => null }} />
        <Stack.Screen name="terms-and-conditions" options={{ title: "Terms and Conditions", headerBackTitle: "Back", headerRight: () => null }} />
        <Stack.Screen name="support" options={{ title: "Help and Support", headerBackTitle: "Back", headerRight: () => null }} />
        <Stack.Screen name="about" options={{ title: "About FoodWorth", headerBackTitle: "Back", headerRight: () => null }} />
        <Stack.Screen name="reset-password" options={{ title: "Reset password", headerRight: () => null, headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="auth-callback" options={{ title: "Sign in", headerRight: () => null, headerBackVisible: false }} />
      </Stack>
    </QueryProvider>
  );
}

const baseStyles = StyleSheet.create({
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
