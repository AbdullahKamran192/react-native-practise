import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import FoodBudgetCard from "@/components/settings/FoodBudgetCard";
import AppearanceSection from "@/components/settings/AppearanceSection";
import DeleteAccountButton from "@/components/settings/DeleteAccountButton";
import { brand } from "@/components/brand/theme";
import ProductImageReviewsLink from "@/components/settings/ProductImageReviewsLink";
import { AppIcon } from "@/components/brand/AppIcon";
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
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

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
      <SafeAreaView edges={["left", "right", "bottom"]} style={styles.centeredContainer}>
        <ActivityIndicator
          size="large"
          color={appTheme.color(brand.ink, "text")}
        />

        <Text style={styles.loadingText}>
          Loading your profile...
        </Text>
      </SafeAreaView>
    );
  }

  if (settingsError) {
    return (
      <SafeAreaView edges={["left", "right", "bottom"]} style={styles.centeredContainer}>
        <AppIcon
          name="alert-circle-outline"
          size={44}
          color={appTheme.color(brand.red, "text")}
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
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageLabel}>
          Your preferences
        </Text>

        <Text style={styles.pageTitle}>
          Settings
        </Text>

        <FoodBudgetCard
          value={formValues.cost}
          onChangeText={(value) => handlePreferenceChange("cost", value)}
        />

        <ProfileCard user={user} />

        <PreferenceSection
          values={formValues}
          onChange={handlePreferenceChange}
          onSave={handleSavePreferences}
          isSaving={isSaving}
        />

        <AppearanceSection />
        <ProductImageReviewsLink />

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
              color={appTheme.color(brand.red, "text")}
            />
          ) : (
            <AppIcon
              name="log-out-outline"
              size={21}
              color={appTheme.color(brand.red, "text")}
            />
          )}

          <Text style={styles.signOutText}>
            {isSigningOut
              ? "Signing out..."
              : "Sign out"}
          </Text>
        </Pressable>

        <DeleteAccountButton disabled={isSigningOut || isSaving} />

        <Text style={styles.versionText}>
          FoodWorth · Version 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.background,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },

  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: brand.background,
    padding: 24,
  },

  loadingText: {
    color: brand.muted,
    fontSize: 14,
    marginTop: 12,
  },

  errorTitle: {
    color: brand.ink,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 14,
  },

  errorText: {
    color: brand.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
  },

  retryButton: {
    backgroundColor: brand.teal,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 18,
  },

  retryButtonText: {
    color: brand.surface,
    fontSize: 14,
    fontWeight: "700",
  },

  pageLabel: {
    color: brand.muted,
    fontSize: 14,
    marginBottom: 4,
  },

  pageTitle: {
    color: brand.ink,
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
    backgroundColor: brand.paleRed,
    borderWidth: 1,
    borderColor: "#F1C4C4",
    borderRadius: 16,
    marginTop: 28,
  },

  signOutText: {
    color: brand.red,
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
    color: brand.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 18,
  },
});
