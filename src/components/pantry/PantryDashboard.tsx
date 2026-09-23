import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { formatNumber } from "@/utils/formatNumber";
import { BrandArtwork } from "@/components/brand/Artwork";
import NutritionTile from "@/components/brand/NutritionTile";
import { brand, nutrients } from "@/components/brand/theme";
import { AppIcon } from "@/components/brand/AppIcon";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { UserSettings } from "@/api/user-settings";

export type PantryNutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  salt: number;
  fibre: number;
};

type PantryDashboardProps = {
  totals: PantryNutritionTotals;
  userSettings: UserSettings | null;
};

type NutritionCard = {
  key: keyof PantryNutritionTotals;
  label: string;
  icon: keyof typeof AppIcon.glyphMap;
  total: number;
  dailyTarget: number;
};

/*
 * These values match the defaults configured in the
 * user_settings table.
 *
 * They are used only when the user does not yet have
 * a settings row.
 */
const DEFAULT_DAILY_TARGETS = {
  calories: 2000,
  protein: 100,
  carbs: 350,
  fat: 70,
  sugars: 90,
  salt: 6,
  fibre: 30,
};

const PantryDashboard = ({
  totals,
  userSettings,
}: PantryDashboardProps) => {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

  /*
   * Use the signed-in user's saved daily targets.
   *
   * Database defaults are used only when no settings
   * row exists yet.
   */
  const dailyTargets = {
    calories:
      userSettings
        ?.calories_target_per_day ??
      DEFAULT_DAILY_TARGETS.calories,

    protein:
      userSettings
        ?.protein_target_per_day ??
      DEFAULT_DAILY_TARGETS.protein,

    carbs:
      userSettings
        ?.carbs_target_per_day ??
      DEFAULT_DAILY_TARGETS.carbs,

    fat:
      userSettings
        ?.fat_target_per_day ??
      DEFAULT_DAILY_TARGETS.fat,

    sugars:
      userSettings
        ?.sugars_target_per_day ??
      DEFAULT_DAILY_TARGETS.sugars,

    salt:
      userSettings
        ?.salt_target_per_day ??
      DEFAULT_DAILY_TARGETS.salt,

    fibre:
      userSettings
        ?.fibre_target_per_day ??
      DEFAULT_DAILY_TARGETS.fibre,
  };

  /*
   * Calories and protein are shown first because they
   * are the main values. The remaining cards can be
   * reached by scrolling horizontally.
   */
  const nutritionCards: NutritionCard[] = [
    {
      key: "calories",
      label: "calories",
      icon: "flame-outline",
      total: totals.calories,
      dailyTarget:
        dailyTargets.calories,
    },
    {
      key: "protein",
      label: "protein",
      icon: "barbell-outline",
      total: totals.protein,
      dailyTarget:
        dailyTargets.protein,
    },
    {
      key: "carbs",
      label: "carbohydrates",
      icon: "restaurant-outline",
      total: totals.carbs,
      dailyTarget:
        dailyTargets.carbs,
    },
    {
      key: "fat",
      label: "fat",
      icon: "water-outline",
      total: totals.fat,
      dailyTarget:
        dailyTargets.fat,
    },
    {
      key: "fibre",
      label: "fibre",
      icon: "leaf-outline",
      total: totals.fibre,
      dailyTarget:
        dailyTargets.fibre,
    },
    {
      key: "sugars",
      label: "sugars",
      icon: "cube-outline",
      total: totals.sugars,
      dailyTarget:
        dailyTargets.sugars,
    },
    {
      key: "salt",
      label: "salt",
      icon: "ellipse-outline",
      total: totals.salt,
      dailyTarget:
        dailyTargets.salt,
    },
  ];

  /*
   * Converts the nutrition total into the number of
   * days supported by the user's daily target.
   */
  function calculateDays(
    total: number,
    dailyTarget: number
  ) {
    if (
      total <= 0 ||
      dailyTarget <= 0
    ) {
      return 0;
    }

    return total / dailyTarget;
  }

  function formatDays(days: number) {
    if (days === 0) {
      return "0";
    }

    if (days < 1) {
      return formatNumber(days);
    }

    return Math.floor(days).toString();
  }

  return (
    <View>
      <View style={styles.dashboard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <BrandArtwork name="pantryBasket" size={64} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 21, fontWeight: "700", color: appTheme.color(brand.ink, "text") }}>Pantry nutrition</Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: appTheme.color(brand.muted, "text") }}>Nutrition available from your stored items</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <NutritionTile label="Calories" value={formatNumber(totals.calories) + " kcal"} />
          <NutritionTile label="Protein" value={formatNumber(totals.protein) + "g"} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={
          styles.daysContent
        }
      >
        {nutritionCards.map((nutrition) => {
          const days = calculateDays(
            nutrition.total,
            nutrition.dailyTarget
          );

          return (
            <View
              key={nutrition.key}
              style={[styles.daysCard, { backgroundColor: appTheme.color(nutrients[nutrition.key].background, "surface") }]}
            >
              <View style={styles.daysIcon}>
                <AppIcon
                  name={nutrition.icon}
                  size={21}
                  color={appTheme.color(nutrients[nutrition.key].color, "text")}
                />
              </View>

              <Text style={styles.daysValue}>
                {formatDays(days)} days
              </Text>

              <Text style={styles.daysLabel}>
                of {nutrition.label} remaining
              </Text>

              <Text style={styles.targetLabel}>
                Daily target:{" "}
                {formatNumber(nutrition.dailyTarget)}
                {nutrition.key === "calories"
                  ? " kcal"
                  : "g"}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default PantryDashboard;

const baseStyles = StyleSheet.create({
  dashboard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
  },

  dashboardLabel: {
    color: "#BDBDBD",
    fontSize: 14,
    marginBottom: 20,
  },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  totalItem: {
    flex: 1,
  },

  divider: {
    width: 1,
    height: 80,
    backgroundColor: "#444",
    marginHorizontal: 20,
  },

  totalValue: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "700",
    marginTop: 10,
  },

  totalLabel: {
    color: "#BDBDBD",
    fontSize: 12,
    marginTop: 4,
  },

  daysContent: {
    gap: 12,
    paddingTop: 12,
    paddingRight: 20,
  },

  daysCard: {
    width: 180,
    minHeight: 158,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
  },

  daysIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  daysValue: {
    color: brand.ink,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 14,
  },

  daysLabel: {
    color: brand.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },

  targetLabel: {
    color: brand.muted,
    fontSize: 13,
    marginTop: 8,
  },
});
