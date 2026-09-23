import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { brand } from "@/components/brand/theme";
import { AppIcon } from "@/components/brand/AppIcon";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

export default function SettingsButton({ themed = false }: { themed?: boolean }) {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

  const router=useRouter();
  return <Pressable onPress={()=>router.navigate("/settings")}
    accessibilityRole="button" accessibilityLabel="Open settings"
    style={({pressed})=>[styles.button,themed&&{backgroundColor:appTheme.color(brand.paleTeal, "surface")},pressed&&{opacity:0.6}]}>
    <AppIcon name="settings-outline" size={23} color={appTheme.color(themed ? brand.deepTeal : "#222", "text")}/>
  </Pressable>;
}
const baseStyles=StyleSheet.create({
  button:{width:44,height:44,borderRadius:22,backgroundColor:"#EDEDED",alignItems:"center",justifyContent:"center"},
});

