import { brand } from "@/components/brand/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

export default function SettingsButton({ themed = false }: { themed?: boolean }) {
  const router=useRouter();
  return <Pressable onPress={()=>router.navigate("/settings")}
    accessibilityRole="button" accessibilityLabel="Open settings"
    style={({pressed})=>[styles.button,themed&&{backgroundColor:brand.paleTeal},pressed&&{opacity:0.6}]}>
    <Ionicons name="settings-outline" size={23} color={themed ? brand.deepTeal : "#222"}/>
  </Pressable>;
}
const styles=StyleSheet.create({
  button:{width:44,height:44,borderRadius:22,backgroundColor:"#EDEDED",alignItems:"center",justifyContent:"center"},
});

