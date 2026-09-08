import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export type ValueGrade = "A" | "B" | "C" | "D" | "E";

type ProductValueDashboardProps = {
  caloriesPerPound: number;
  proteinPerPound: number;
};

type GradeStyle = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  description: string;
};

const gradeStyles: Record<ValueGrade, GradeStyle> = {
  A: {
    backgroundColor: "#DDF3E4",
    borderColor: "#73BC87",
    textColor: "#246B3A",
    description: "Excellent value",
  },

  B: {
    backgroundColor: "#EAF4D3",
    borderColor: "#A8CA68",
    textColor: "#587520",
    description: "Very good value",
  },

  C: {
    backgroundColor: "#FFF3C4",
    borderColor: "#E1C759",
    textColor: "#806815",
    description: "Good value",
  },

  D: {
    backgroundColor: "#FFE0B2",
    borderColor: "#E6A550",
    textColor: "#925A13",
    description: "Low value",
  },

  E: {
    backgroundColor: "#FFD6D6",
    borderColor: "#DF7A7A",
    textColor: "#A12F2F",
    description: "Poor value",
  },
};

function getCaloriesGrade(
  caloriesPerPound: number
): ValueGrade {
  if (caloriesPerPound >= 2000) return "A";
  if (caloriesPerPound >= 1250) return "B";
  if (caloriesPerPound >= 800) return "C";
  if (caloriesPerPound >= 400) return "D";

  return "E";
}

function getProteinGrade(
  proteinPerPound: number
): ValueGrade {
  if (proteinPerPound >= 75) return "A";
  if (proteinPerPound >= 50) return "B";
  if (proteinPerPound >= 30) return "C";
  if (proteinPerPound >= 15) return "D";

  return "E";
}

function getBetterGrade(
  firstGrade: ValueGrade,
  secondGrade: ValueGrade
): ValueGrade {
  const gradeOrder: ValueGrade[] = [
    "A",
    "B",
    "C",
    "D",
    "E",
  ];

  const firstPosition =
    gradeOrder.indexOf(firstGrade);

  const secondPosition =
    gradeOrder.indexOf(secondGrade);

  return firstPosition <= secondPosition
    ? firstGrade
    : secondGrade;
}

const ProductValueDashboard = ({
  caloriesPerPound,
  proteinPerPound,
}: ProductValueDashboardProps) => {
  const caloriesGrade = getCaloriesGrade(
    caloriesPerPound
  );

  const proteinGrade = getProteinGrade(
    proteinPerPound
  );

  const overallGrade = getBetterGrade(
    caloriesGrade,
    proteinGrade
  );

  const caloriesColours =
    gradeStyles[caloriesGrade];

  const proteinColours =
    gradeStyles[proteinGrade];

  const overallColours =
    gradeStyles[overallGrade];

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.title}>
            Nutrition value
          </Text>

          <Text style={styles.subtitle}>
            What you receive for every £1 spent
          </Text>
        </View>

        <View style={styles.poundIcon}>
          <Text style={styles.poundIconText}>£</Text>
        </View>
      </View>

      <View style={styles.valueGrid}>
        <View
          style={[
            styles.valueCard,
            {
              backgroundColor:
                caloriesColours.backgroundColor,

              borderColor:
                caloriesColours.borderColor,
            },
          ]}
        >
          <View style={styles.valueHeader}>
            <Ionicons
              name="flame-outline"
              size={22}
              color={caloriesColours.textColor}
            />

            <View
              style={[
                styles.smallGrade,
                {
                  backgroundColor:
                    caloriesColours.textColor,
                },
              ]}
            >
              <Text style={styles.smallGradeText}>
                {caloriesGrade}
              </Text>
            </View>
          </View>

          <Text style={styles.valueLabel}>
            Calories per £
          </Text>

          <Text
            style={[
              styles.value,
              {
                color: caloriesColours.textColor,
              },
            ]}
          >
            {Math.round(caloriesPerPound).toLocaleString()}
          </Text>

          <Text style={styles.unit}>kcal per £1</Text>
        </View>

        <View
          style={[
            styles.valueCard,
            {
              backgroundColor:
                proteinColours.backgroundColor,

              borderColor:
                proteinColours.borderColor,
            },
          ]}
        >
          <View style={styles.valueHeader}>
            <Ionicons
              name="barbell-outline"
              size={22}
              color={proteinColours.textColor}
            />

            <View
              style={[
                styles.smallGrade,
                {
                  backgroundColor:
                    proteinColours.textColor,
                },
              ]}
            >
              <Text style={styles.smallGradeText}>
                {proteinGrade}
              </Text>
            </View>
          </View>

          <Text style={styles.valueLabel}>
            Protein per £
          </Text>

          <Text
            style={[
              styles.value,
              {
                color: proteinColours.textColor,
              },
            ]}
          >
            {proteinPerPound.toFixed(1)}
          </Text>

          <Text style={styles.unit}>grams per £1</Text>
        </View>
      </View>

      <View
        style={[
          styles.overallCard,
          {
            backgroundColor:
              overallColours.backgroundColor,

            borderColor:
              overallColours.borderColor,
          },
        ]}
      >
        <View
          style={[
            styles.overallGrade,
            {
              backgroundColor:
                overallColours.textColor,
            },
          ]}
        >
          <Text style={styles.overallGradeText}>
            {overallGrade}
          </Text>
        </View>

        <View style={styles.overallInformation}>
          <Text
            style={[
              styles.overallTitle,
              {
                color: overallColours.textColor,
              },
            ]}
          >
            Overall grade: {overallGrade}
          </Text>

          <Text style={styles.overallDescription}>
            {overallColours.description}
          </Text>
        </View>
      </View>

      <View style={styles.explanation}>
        <Ionicons
          name="information-circle-outline"
          size={18}
          color="#777"
        />

        <Text style={styles.explanationText}>
          Grades are based on how much energy or
          protein you get for every £1 spent. The
          overall grade uses the better of the calories
          and protein grades.
        </Text>
      </View>
    </View>
  );
};

export default ProductValueDashboard;

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
  },

  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  title: {
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
  },

  subtitle: {
    color: "#777",
    fontSize: 12,
    marginTop: 3,
  },

  poundIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  poundIconText: {
    color: "#222",
    fontSize: 20,
    fontWeight: "700",
  },

  valueGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  valueCard: {
    width: "48%",
    minHeight: 155,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },

  valueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  smallGrade: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  smallGradeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  valueLabel: {
    color: "#555",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
  },

  value: {
    fontSize: 25,
    fontWeight: "800",
    marginTop: 5,
  },

  unit: {
    color: "#777",
    fontSize: 11,
    marginTop: 2,
  },

  overallCard: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },

  overallGrade: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  overallGradeText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
  },

  overallInformation: {
    flex: 1,
    marginLeft: 15,
  },

  overallTitle: {
    fontSize: 17,
    fontWeight: "800",
  },

  overallDescription: {
    color: "#666",
    fontSize: 13,
    marginTop: 4,
  },

  explanation: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 4,
  },

  explanationText: {
    flex: 1,
    color: "#777",
    fontSize: 12,
    lineHeight: 18,
  },
});