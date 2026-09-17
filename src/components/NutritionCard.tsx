import { brand } from "@/components/brand/theme";
import { View, Text } from 'react-native'
import { AppIcon } from "@/components/brand/AppIcon";
import { StyleSheet } from 'react-native';
import ProgressRing from './ProgressRing';

type NutritionCardProps = {
  icon: keyof typeof AppIcon.glyphMap;
  label: string;
  value: string;
  goal: string;
  progress: number;
  animationKey: string;
  colour?: string;
  backgroundColour?: string;
};

const NutritionCard = ({
  icon,
  label,
  value,
  goal,
  progress,
  animationKey,
  colour = brand.teal,
  backgroundColour = brand.surface,
}: NutritionCardProps) => {
  return (
    <View style={[styles.nutritionCard, { backgroundColor: backgroundColour }]}>
      <ProgressRing progress={progress} animationKey={animationKey} colour={colour} trackColour={brand.border}
        label={label + ": " + value + " of " + goal}>
        <AppIcon name={icon} size={22} color={colour} />
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
    color: brand.muted,
    marginTop: 10,
  },

  nutritionValue: {
    fontSize: 20,
    fontWeight: "700",
    color: brand.ink,
    marginTop: 4,
  },

  nutritionGoal: {
    fontSize: 11,
    color: brand.muted,
    marginTop: 2,
  },
})


