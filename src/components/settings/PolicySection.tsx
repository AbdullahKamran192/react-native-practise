import { AppIcon } from "@/components/brand/AppIcon";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type PolicyItemProps = {
  label: string;
  icon: keyof typeof AppIcon.glyphMap;
  onPress: () => void;
};

const PolicyItem = ({
  label,
  icon,
  onPress,
}: PolicyItemProps) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.policyRow,
        pressed && styles.policyRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.policyIcon}>
        <AppIcon
          name={icon}
          size={21}
          color="#333"
        />
      </View>

      <Text style={styles.policyLabel}>
        {label}
      </Text>

      <AppIcon
        name="chevron-forward"
        size={20}
        color="#999"
      />
    </Pressable>
  );
};

export default function PolicySection() {
  function openDummyPage(title: string) {
    Alert.alert(
      title,
      "This section will be available later."
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>
        Policies and support
      </Text>

      <View style={styles.policyCard}>
        <PolicyItem
          label="Privacy Policy"
          icon="shield-checkmark-outline"
          onPress={() =>
            openDummyPage("Privacy Policy")
          }
        />

        <View style={styles.divider} />

        <PolicyItem
          label="Terms and Conditions"
          icon="document-text-outline"
          onPress={() =>
            openDummyPage("Terms and Conditions")
          }
        />

        <View style={styles.divider} />

        <PolicyItem
          label="Help and Support"
          icon="help-circle-outline"
          onPress={() =>
            openDummyPage("Help and Support")
          }
        />

        <View style={styles.divider} />

        <PolicyItem
          label="About FoodWorth"
          icon="information-circle-outline"
          onPress={() =>
            openDummyPage("About FoodWorth")
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 13,
  },

  policyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    overflow: "hidden",
  },

  policyRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
  },

  policyRowPressed: {
    opacity: 0.55,
  },

  policyIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EDEDED",
  },

  policyLabel: {
    flex: 1,
    color: "#222",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEEEEE",
  },
});