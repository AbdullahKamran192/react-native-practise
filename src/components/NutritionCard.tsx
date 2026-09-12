import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import ProgressRing from './ProgressRing';

type NutritionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  goal: string;
  progress: number;
  animationKey: string;
  colour?: string;
};

const NutritionCard = ({
  icon,
  label,
  value,
  goal,
  progress,
  animationKey,
  colour = "#5A9D79",
}: NutritionCardProps) => {
  return (
    <View style={styles.nutritionCard}>
      <ProgressRing progress={progress} animationKey={animationKey} colour={colour}
        label={label + ": " + value + " of " + goal}>
        <Ionicons name={icon} size={22} color={colour} />
      </ProgressRing>

      <Text style={styles.nutritionLabel}>{label}</Text>

      <Text style={styles.nutritionValue}>{value}</Text>

      <Text style={styles.nutritionGoal}>of {goal}</Text>
    </View>
  );
};

export default NutritionCard

const styles = StyleSheet.create({
  // Nutrition
  nutritionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },

  nutritionCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
  },
  nutritionLabel: {
    fontSize: 13,
    color: "#777",
    marginTop: 10,
  },

  nutritionValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    marginTop: 4,
  },

  nutritionGoal: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
})


