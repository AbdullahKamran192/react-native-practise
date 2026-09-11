import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { User } from "@supabase/supabase-js";

import { useSaveUserSettings, useUserSettings } from "@/api/user-settings";

import PolicySection from "@/components/settings/PolicySection";
import PreferenceSection, {
  SettingsFormField,
  SettingsFormValues,
} from "@/components/settings/PreferenceSection";
import ProfileCard from "@/components/settings/ProfileCard";
import { supabase } from "@/lib/supabase";

const defaultSettings: SettingsFormValues = {
  calories: "2000",
  protein: "100",
  carbs: "350",
  fat: "70",
  sugars: "90",
  salt: "6",
  fibre: "30",
  cost: "3.00",
};

export default function SettingsScreen() {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);

  const [isUserLoading, setIsUserLoading] =
    useState(true);

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const [formValues, setFormValues] =
    useState<SettingsFormValues>(defaultSettings);

  /*
   * Prevent query refetches from overwriting changes
   * the user is currently typing.
   */
  const settingsInitialised = useRef(false);

  const {
    data: userSettings,
    error: settingsError,
    isLoading: isSettingsLoading,
    refetch,
  } = useUserSettings();

  const {
    mutateAsync: saveUserSettings,
    isPending: isSaving,
  } = useSaveUserSettings();

  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        setUser(user);
      } catch (error) {
        console.error(
          "Could not load user profile:",
          error
        );

        Alert.alert(
          "Profile error",
          "Could not load your account information."
        );
      } finally {
        setIsUserLoading(false);
      }
    }

    loadUser();
  }, []);

  useEffect(() => {
    if (
      isSettingsLoading ||
      settingsInitialised.current
    ) {
      return;
    }

    if (userSettings) {
      setFormValues({
        calories: String(
          userSettings.calories_target_per_day
        ),

        protein: String(
          userSettings.protein_target_per_day
        ),

        carbs: String(
          userSettings.carbs_target_per_day
        ),

        fat: String(
          userSettings.fat_target_per_day
        ),

        sugars: String(
          userSettings.sugars_target_per_day
        ),

        salt: String(
          userSettings.salt_target_per_day
        ),

        fibre: String(
          userSettings.fibre_target_per_day
        ),

        cost: Number(
          userSettings.cost_target_per_day
        ).toFixed(2),
      });
    }

    /*
     * If userSettings is null, the component keeps
     * the defaultSettings values.
     */
    settingsInitialised.current = true;
  }, [userSettings, isSettingsLoading]);

  function handlePreferenceChange(
    field: SettingsFormField,
    value: string
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  function convertValue(
    value: string
  ): number | null {
    const convertedValue = Number(
      value.trim().replace(",", ".")
    );

    if (
      !Number.isFinite(convertedValue) ||
      convertedValue < 0
    ) {
      return null;
    }

    return convertedValue;
  }

  async function handleSavePreferences() {
    const calories = convertValue(
      formValues.calories
    );

    const protein = convertValue(
      formValues.protein
    );

    const carbs = convertValue(formValues.carbs);
    const fat = convertValue(formValues.fat);

    const sugars = convertValue(
      formValues.sugars
    );

    const salt = convertValue(formValues.salt);

    const fibre = convertValue(
      formValues.fibre
    );

    const cost = convertValue(formValues.cost);

    if (
      calories === null ||
      protein === null ||
      carbs === null ||
      fat === null ||
      sugars === null ||
      salt === null ||
      fibre === null ||
      cost === null
    ) {
      Alert.alert(
        "Invalid preferences",
        "Every preference must contain a valid number."
      );

      return;
    }

    if (calories === 0) {
      Alert.alert(
        "Invalid calorie target",
        "Your daily calorie target must be greater than zero."
      );

      return;
    }

    if (cost === 0) {
      Alert.alert(
        "Invalid cost target",
        "Your daily food budget must be greater than zero."
      );

      return;
    }

    try {
      await saveUserSettings({
        calories_target_per_day:
          Math.round(calories),

        protein_target_per_day:
          Math.round(protein),

        carbs_target_per_day:
          Math.round(carbs),

        fat_target_per_day:
          Math.round(fat),

        sugars_target_per_day:
          Math.round(sugars),

        salt_target_per_day:
          Math.round(salt),

        fibre_target_per_day:
          Math.round(fibre),

        cost_target_per_day: cost,
      });

      setFormValues((currentValues) => ({
        ...currentValues,
        cost: cost.toFixed(2),
      }));

      Alert.alert(
        "Preferences saved",
        "Your daily targets have been updated."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save your preferences.";

      Alert.alert("Save failed", message);
    }
  }

  async function signOut() {
    try {
      setIsSigningOut(true);

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      /*
       * Remove the signed-out user's cached pantry
       * and settings data.
       */
      queryClient.clear();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not sign you out.";

      Alert.alert("Sign-out failed", message);
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isSettingsLoading || isUserLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator
          size="large"
          color="#222"
        />

        <Text style={styles.loadingText}>
          Loading your profile...
        </Text>
      </SafeAreaView>
    );
  }

  if (settingsError) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={44}
          color="#B3261E"
        />

        <Text style={styles.errorTitle}>
          Could not load preferences
        </Text>

        <Text style={styles.errorText}>
          {settingsError.message}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => refetch()}
        >
          <Text style={styles.retryButtonText}>
            Try again
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageLabel}>
          Your account
        </Text>

        <Text style={styles.pageTitle}>
          Profile
        </Text>

        <ProfileCard user={user} />

        <PreferenceSection
          values={formValues}
          onChange={handlePreferenceChange}
          onSave={handleSavePreferences}
          isSaving={isSaving}
        />

        <PolicySection />

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.buttonPressed,

            isSigningOut &&
              styles.disabledButton,
          ]}
          onPress={signOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator
              size="small"
              color="#B3261E"
            />
          ) : (
            <Ionicons
              name="log-out-outline"
              size={21}
              color="#B3261E"
            />
          )}

          <Text style={styles.signOutText}>
            {isSigningOut
              ? "Signing out..."
              : "Sign out"}
          </Text>
        </Pressable>

        <Text style={styles.versionText}>
          FoodWorth · Version 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },

  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    padding: 24,
  },

  loadingText: {
    color: "#777",
    fontSize: 14,
    marginTop: 12,
  },

  errorTitle: {
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 14,
  },

  errorText: {
    color: "#777",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
  },

  retryButton: {
    backgroundColor: "#222",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 18,
  },

  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  pageLabel: {
    color: "#777",
    fontSize: 14,
    marginBottom: 4,
  },

  pageTitle: {
    color: "#222",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 20,
  },

  signOutButton: {
    height: 54,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: "#F1C4C4",
    borderRadius: 16,
    marginTop: 28,
  },

  signOutText: {
    color: "#B3261E",
    fontSize: 15,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.7,
  },

  disabledButton: {
    opacity: 0.55,
  },

  versionText: {
    color: "#999",
    fontSize: 12,
    textAlign: "center",
    marginTop: 18,
  },
});