import { AppIcon } from "@/components/brand/AppIcon";
import { StyleSheet, Text, View } from "react-native";
import type { User } from "@supabase/supabase-js";

type ProfileCardProps = {
  user: User | null;
};

export default function ProfileCard({
  user,
}: ProfileCardProps) {
  function getDisplayName() {
    const metadataName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name;

    if (metadataName) {
      return metadataName;
    }

    if (user?.email) {
      const emailName = user.email.split("@")[0];

      return emailName
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );
    }

    return "FoodWorth User";
  }

  function getInitials() {
    return getDisplayName()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  return (
    <View style={styles.profileCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {getInitials()}
        </Text>
      </View>

      <View style={styles.profileInformation}>
        <Text
          style={styles.profileName}
          numberOfLines={1}
        >
          {getDisplayName()}
        </Text>

        <Text
          style={styles.profileEmail}
          numberOfLines={1}
        >
          {user?.email || "No email available"}
        </Text>
      </View>

      {user?.email_confirmed_at && (
        <View style={styles.verifiedIcon}>
          <AppIcon
            name="checkmark"
            size={18}
            color="#246B3A"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 20,
    padding: 18,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#414141",
  },

  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },

  profileInformation: {
    flex: 1,
    marginHorizontal: 14,
  },

  profileName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  profileEmail: {
    color: "#BDBDBD",
    fontSize: 13,
    marginTop: 5,
  },

  verifiedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#DDF3E4",
  },
});