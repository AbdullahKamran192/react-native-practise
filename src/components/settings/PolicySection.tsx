import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { brand } from "@/components/brand/theme";
import { AppIcon } from "@/components/brand/AppIcon";
import { router } from "expo-router";
import {
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
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

  return (
    <Pressable
      accessibilityRole="button"
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
          color={appTheme.color(brand.deepTeal, "text")}
        />
      </View>

      <Text style={styles.policyLabel}>
        {label}
      </Text>

      <AppIcon
        name="chevron-forward"
        size={20}
        color={appTheme.color(brand.muted, "text")}
      />
    </Pressable>
  );
};

export default function PolicySection() {
  const styles = useThemeStyles(baseStyles);

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
            router.push("/privacy-policy")
          }
        />

        <View style={styles.divider} />

        <PolicyItem
          label="Terms and Conditions"
          icon="document-text-outline"
          onPress={() =>
            router.push("/terms-and-conditions")
          }
        />

        <View style={styles.divider} />

        <PolicyItem
          label="Help and Support"
          icon="help-circle-outline"
          onPress={() =>
            router.push("/support")
          }
        />

        <View style={styles.divider} />

        <PolicyItem
          label="About FoodWorth"
          icon="information-circle-outline"
          onPress={() =>
            router.push("/about")
          }
        />
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  sectionTitle: {
    color: brand.ink,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 13,
  },

  policyCard: {
    backgroundColor: brand.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brand.border,
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
    backgroundColor: brand.paleTeal,
  },

  policyLabel: {
    flex: 1,
    color: brand.ink,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },

  divider: {
    height: 1,
    backgroundColor: brand.border,
  },
});
