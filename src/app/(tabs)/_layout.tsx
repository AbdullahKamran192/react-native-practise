import { tabIcons } from "../../../assets/brand/uiAssets";
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAppTheme } from "@/theme/AppThemeProvider";
import { darkPalette } from "@/theme/palette";

export default function TabLayout() {
  const { isDark } = useAppTheme();
  return (
    <NativeTabs {...(isDark ? { backgroundColor: darkPalette.surface, tintColor: darkPalette.teal, iconColor: darkPalette.muted, labelStyle: { color: darkPalette.muted } } : {})}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...tabIcons.home} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pantry">
        <NativeTabs.Trigger.Icon {...tabIcons.pantry} />
        <NativeTabs.Trigger.Label>Pantry</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Icon {...tabIcons.search} />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="meals">
        <NativeTabs.Trigger.Icon {...tabIcons.meals} />
        <NativeTabs.Trigger.Label>Meals</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>   
  );
}
