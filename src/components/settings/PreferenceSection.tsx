import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export type SettingsFormValues = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  sugars: string;
  salt: string;
  fibre: string;
  cost: string;
};

export type SettingsFormField =
  keyof SettingsFormValues;

type PreferenceSectionProps = {
  values: SettingsFormValues;

  onChange: (
    field: SettingsFormField,
    value: string
  ) => void;

  onSave: () => void;
  isSaving: boolean;
};

type PreferenceInputProps = {
  label: string;
  description: string;
  value: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  onChangeText: (value: string) => void;
};

const PreferenceInput = ({
  label,
  description,
  value,
  unit,
  icon,
  onChangeText,
}: PreferenceInputProps) => {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceIcon}>
        <Ionicons
          name={icon}
          size={21}
          color="#333"
        />
      </View>

      <View style={styles.preferenceInformation}>
        <Text style={styles.preferenceLabel}>
          {label}
        </Text>

        <Text style={styles.preferenceDescription}>
          {description}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />

        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
};

export default function PreferenceSection({
  values,
  onChange,
  onSave,
  isSaving,
}: PreferenceSectionProps) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Daily preferences
        </Text>

        <Text style={styles.sectionDescription}>
          Set the daily goals used by your pantry
          dashboard.
        </Text>
      </View>

      <View style={styles.preferencesCard}>
        <PreferenceInput
          label="Calories"
          description="Daily energy target"
          unit="kcal"
          icon="flame-outline"
          value={values.calories}
          onChangeText={(value) =>
            onChange("calories", value)
          }
        />

        <View style={styles.divider} />

        <PreferenceInput
          label="Protein"
          description="Daily protein target"
          unit="g"
          icon="barbell-outline"
          value={values.protein}
          onChangeText={(value) =>
            onChange("protein", value)
          }
        />

        <View style={styles.divider} />

        <PreferenceInput
          label="Carbohydrates"
          description="Daily carbohydrate target"
          unit="g"
          icon="restaurant-outline"
          value={values.carbs}
          onChangeText={(value) =>
            onChange("carbs", value)
          }
        />

        <View style={styles.divider} />

        <PreferenceInput
          label="Fat"
          description="Daily fat target"
          unit="g"
          icon="water-outline"
          value={values.fat}
          onChangeText={(value) =>
            onChange("fat", value)
          }
        />

        <View style={styles.divider} />

        <PreferenceInput
          label="Sugars"
          description="Daily total sugars limit"
          unit="g"
          icon="cube-outline"
          value={values.sugars}
          onChangeText={(value) =>
            onChange("sugars", value)
          }
        />

        <View style={styles.divider} />

        <PreferenceInput
          label="Salt"
          description="Daily salt limit"
          unit="g"
          icon="ellipse-outline"
          value={values.salt}
          onChangeText={(value) =>
            onChange("salt", value)
          }
        />

        <View style={styles.divider} />

        <PreferenceInput
          label="Fibre"
          description="Daily fibre target"
          unit="g"
          icon="leaf-outline"
          value={values.fibre}
          onChangeText={(value) =>
            onChange("fibre", value)
          }
        />

        <View style={styles.divider} />

        <PreferenceInput
          label="Food budget"
          description="Preferred daily food cost"
          unit="£"
          icon="wallet-outline"
          value={values.cost}
          onChangeText={(value) =>
            onChange("cost", value)
          }
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.pressedButton,
          isSaving && styles.disabledButton,
        ]}
        onPress={onSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator
            size="small"
            color="#fff"
          />
        ) : (
          <Ionicons
            name="checkmark-outline"
            size={21}
            color="#fff"
          />
        )}

        <Text style={styles.saveButtonText}>
          {isSaving
            ? "Saving..."
            : "Save preferences"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginTop: 28,
    marginBottom: 13,
  },

  sectionTitle: {
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
  },

  sectionDescription: {
    color: "#777",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  preferencesCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
  },

  preferenceRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
  },

  preferenceIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDEDED",
  },

  preferenceInformation: {
    flex: 1,
    marginHorizontal: 12,
  },

  preferenceLabel: {
    color: "#222",
    fontSize: 14,
    fontWeight: "700",
  },

  preferenceDescription: {
    color: "#888",
    fontSize: 11,
    marginTop: 3,
  },

  inputContainer: {
    minWidth: 86,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: "#DADADA",
    backgroundColor: "#F8F8F8",
    borderRadius: 11,
    paddingHorizontal: 9,
  },

  input: {
    minWidth: 42,
    maxWidth: 65,
    color: "#222",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    paddingVertical: 0,
  },

  unit: {
    color: "#777",
    fontSize: 11,
    marginLeft: 4,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEEEEE",
  },

  saveButton: {
    height: 54,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#222",
    borderRadius: 16,
    marginTop: 16,
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  pressedButton: {
    opacity: 0.7,
  },

  disabledButton: {
    opacity: 0.55,
  },
});