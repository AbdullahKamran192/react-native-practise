import { useAppTheme } from "@/theme/AppThemeProvider";
import { ActivityIndicator, Text, View } from "react-native";
import ProgressRing from "@/components/ProgressRing";
import { brand } from "@/components/brand/theme";

export default function AvailabilityRing({ progress, label, loading = false, unavailable = false }: {
  progress: number; label: string; loading?: boolean; unavailable?: boolean;
}) {
  const appTheme = useAppTheme();

  if (loading || unavailable) return <View style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center" }}
    accessible accessibilityLabel={loading ? "Checking pantry availability" : "Pantry availability unavailable"}>
    {loading ? <ActivityIndicator color={appTheme.color(brand.teal, "text")} /> : <Text style={{ color: appTheme.color(brand.muted, "text") }}>—</Text>}
  </View>;
  // Do not round a shortage up to 100%.
  const percentage = progress >= 1 ? 100 : Math.floor(progress * 100);
  return <ProgressRing size={54} strokeWidth={4} progress={progress} label={label}
    colour={progress >= 1 ? "#287C3D" : progress > 0 ? "#AD510B" : brand.red} trackColour={brand.border}>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11, fontWeight: "700", color: appTheme.color(brand.ink, "text") }}>{percentage}%</Text>
  </ProgressRing>;
}
