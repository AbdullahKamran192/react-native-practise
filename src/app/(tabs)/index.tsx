import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import MealCard from "@/components/MealCard";
import NutritionCard from "@/components/NutritionCard";

const Index = () => {
  const router = useRouter();

  const caloriesConsumed = 1250;
  const calorieGoal = 2200;
  const caloriesRemaining =
    calorieGoal - caloriesConsumed;
  const progress =
    caloriesConsumed / calorieGoal;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Good morning 👋
            </Text>

            <Text style={styles.title}>
              Today's Calories
            </Text>
          </View>

          <Pressable style={styles.profileButton}>
            <Ionicons
              name="person-outline"
              size={22}
              color="#222"
            />
          </Pressable>
        </View>

        {/* Calorie Summary */}
        <View style={styles.calorieCard}>
          <Text style={styles.cardLabel}>
            Calories remaining
          </Text>

          <Text style={styles.caloriesRemaining}>
            {caloriesRemaining}
          </Text>

          <Text style={styles.calorieGoal}>
            of {calorieGoal} kcal
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>

          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>
              {caloriesConsumed} consumed
            </Text>

            <Text style={styles.progressText}>
              {calorieGoal} goal
            </Text>
          </View>
        </View>

        {/* Today's Nutrition */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Today's Nutrition
          </Text>

          <Pressable>
            <Text style={styles.seeAll}>
              Details
            </Text>
          </Pressable>
        </View>

        <View style={styles.nutritionRow}>
          <NutritionCard
            icon="restaurant-outline"
            label="Protein"
            value="82g"
            goal="150g"
          />

          <NutritionCard
            icon="water-outline"
            label="Carbs"
            value="140g"
            goal="250g"
          />

          <NutritionCard
            icon="nutrition-outline"
            label="Fat"
            value="42g"
            goal="70g"
          />
        </View>

        {/* Meals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Today's Meals
          </Text>

          <Pressable>
            <Text style={styles.seeAll}>
              See all
            </Text>
          </Pressable>
        </View>

        <MealCard
          meal="Breakfast"
          food="Oats with banana"
          calories={420}
          icon="sunny-outline"
        />

        <MealCard
          meal="Lunch"
          food="Chicken & rice"
          calories={610}
          icon="restaurant-outline"
        />

        {/* Food actions */}
        <View style={styles.foodActions}>
          <Pressable
            style={({ pressed }) => [
              styles.consumeFoodButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() =>
              router.push({
                pathname: "/camera",
                params: {
                  intent: "consume",
                },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Consume food"
          >
            <Ionicons
              name="restaurant-outline"
              size={22}
              color="#fff"
            />

            <Text style={styles.consumeFoodText}>
              Consume Food
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.addFoodButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() =>
              router.push({
                pathname: "/camera",
                params: {
                  intent: "pantry",
                },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Add food to pantry"
          >
            <Ionicons
              name="basket-outline"
              size={22}
              color="#222"
            />

            <Text style={styles.addFoodText}>
              Add Food to Pantry
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  nutritionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  greeting: {
    fontSize: 14,
    color: "#777",
    marginBottom: 4,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#222",
  },

  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  /* Calorie card */
  calorieCard: {
    backgroundColor: "#222",
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
  },

  cardLabel: {
    color: "#BDBDBD",
    fontSize: 14,
    marginBottom: 8,
  },

  caloriesRemaining: {
    color: "#fff",
    fontSize: 44,
    fontWeight: "700",
  },

  calorieGoal: {
    color: "#BDBDBD",
    fontSize: 14,
    marginTop: 2,
    marginBottom: 22,
  },

  progressBackground: {
    height: 10,
    backgroundColor: "#444",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
  },

  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  progressText: {
    color: "#BDBDBD",
    fontSize: 12,
  },

  /* Sections */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#222",
  },

  seeAll: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },

  /* Food actions */
  foodActions: {
    gap: 12,
    marginTop: 14,
  },

  consumeFoodButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  consumeFoodText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  addFoodButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#E7E7E7",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  addFoodText: {
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.7,
  },
});
