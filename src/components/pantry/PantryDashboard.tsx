import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type PantryDashboardProps = {
  caloriesTotal: number;
  proteinTotal: number;
};

const PantryDashboard = ({
  caloriesTotal,
  proteinTotal,
}: PantryDashboardProps) => {
  const dailyCalorieGoal = 2200;
  const dailyProteinGoal = 150;

  const calorieDays = caloriesTotal / dailyCalorieGoal;
  const proteinDays = proteinTotal / dailyProteinGoal;

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
        <Text style={styles.dashboardLabel}>Nutrition available</Text>

        <View style={styles.totalRow}>
          <View style={styles.totalItem}>
            <Ionicons name="flame-outline" size={22} color="#fff" />

            <Text style={styles.totalValue}>
              {caloriesTotal.toLocaleString()}
            </Text>

            <Text style={styles.totalLabel}>total kcal</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalItem}>
            <Ionicons name="barbell-outline" size={22} color="#fff" />

            <Text style={styles.totalValue}>{proteinTotal}g</Text>

            <Text style={styles.totalLabel}>total protein</Text>
          </View>
        </View>
      </View>

      <View style={styles.daysRow}>
        <View style={styles.daysCard}>
          <View style={styles.daysIcon}>
            <Ionicons name="flame-outline" size={21} color="#222" />
          </View>

          <Text style={styles.daysValue}>
            {formatDays(calorieDays)} days
          </Text>

          <Text style={styles.daysLabel}>of calories remaining</Text>
        </View>

        <View style={styles.daysCard}>
          <View style={styles.daysIcon}>
            <Ionicons name="barbell-outline" size={21} color="#222" />
          </View>

          <Text style={styles.daysValue}>
            {formatDays(proteinDays)} days
          </Text>

          <Text style={styles.daysLabel}>of protein remaining</Text>
        </View>
      </View>
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

  daysRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },

  daysCard: {
    flex: 1,
    minHeight: 145,
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
});