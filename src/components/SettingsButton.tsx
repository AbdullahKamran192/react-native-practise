import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

export default function SettingsButton() {
  const router=useRouter();
  return <Pressable onPress={()=>router.navigate("/settings")}
    accessibilityRole="button" accessibilityLabel="Open settings"
    style={({pressed})=>[styles.button,pressed&&{opacity:0.6}]}>
    <Ionicons name="settings-outline" size={23} color="#222"/>
  </Pressable>;
}
const styles=StyleSheet.create({
  button:{width:44,height:44,borderRadius:22,backgroundColor:"#EDEDED",alignItems:"center",justifyContent:"center"},
});

