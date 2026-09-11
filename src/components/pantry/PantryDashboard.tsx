import { Ionicons } from "@expo/vector-icons";
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
  icon: keyof typeof Ionicons.glyphMap;
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
      return days.toFixed(1);
    }

    return Math.floor(days).toString();
  }

  return (
    <View>
      <View style={styles.dashboard}>
        <Text style={styles.dashboardLabel}>
          Nutrition available
        </Text>

        <View style={styles.totalRow}>
          <View style={styles.totalItem}>
            <Ionicons
              name="flame-outline"
              size={22}
              color="#fff"
            />

            <Text style={styles.totalValue}>
              {totals.calories.toLocaleString()}
            </Text>

            <Text style={styles.totalLabel}>
              total kcal
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalItem}>
            <Ionicons
              name="barbell-outline"
              size={22}
              color="#fff"
            />

            <Text style={styles.totalValue}>
              {totals.protein.toLocaleString()}
              g
            </Text>

            <Text style={styles.totalLabel}>
              total protein
            </Text>
          </View>
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
              style={styles.daysCard}
            >
              <View style={styles.daysIcon}>
                <Ionicons
                  name={nutrition.icon}
                  size={21}
                  color="#222"
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
                {nutrition.dailyTarget}
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

const styles = StyleSheet.create({
  dashboard: {
    backgroundColor: "#222",
    borderRadius: 20,
    padding: 24,
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
    width: 160,
    minHeight: 158,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
  },

  daysIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  daysValue: {
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 14,
  },

  daysLabel: {
    color: "#777",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  targetLabel: {
    color: "#999",
    fontSize: 10,
    marginTop: 8,
  },
});