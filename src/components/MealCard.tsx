import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";


type MealCardProps = {
  meal: string;
  food: string;
  calories: number;
  icon: keyof typeof Ionicons.glyphMap;
};

const MealCard = ({
  meal,
  food,
  calories,
  icon,
}: MealCardProps) => {
  return (
    <View style={styles.mealCard}>
      <View style={styles.mealIcon}>
        <Ionicons name={icon} size={24} color="#444" />
      </View>

      <View style={styles.mealInfo}>
        <Text style={styles.mealName}>{meal}</Text>
        <Text style={styles.foodName}>{food}</Text>
      </View>

      <Text style={styles.mealCalories}>{calories} kcal</Text>
    </View>
  );
};


export default MealCard

const styles = StyleSheet.create({
    // Meals
    mealCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },

    mealIcon: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: "#F0F0F0",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },

    mealInfo: {
        flex: 1,
    },

    mealName: {
        fontSize: 15,
        fontWeight: "700",
        color: "#222",
    },

    foodName: {
        fontSize: 13,
        color: "#777",
        marginTop: 3,
    },

    mealCalories: {
        fontSize: 14,
        fontWeight: "600",
        color: "#444",
    },
})