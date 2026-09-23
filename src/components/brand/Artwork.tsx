import { useAppTheme } from "@/theme/AppThemeProvider";
import { Image, StyleSheet, View } from "react-native";
import { AppIcon } from "@/components/brand/AppIcon";
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";
import { artwork } from "../../../assets/brand/uiAssets";
import { brand } from "./theme";

export function BrandArtwork({ name, size = 80 }: { name: "mealsHero" | "pantryBasket" | "consumeBasket"; size?: number }) {
  const appTheme = useAppTheme();

  const source = artwork[name];
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: 24, backgroundColor: appTheme.color(brand.paleTeal, "surface"), alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
    {source ? <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />
      : <AppIcon name={name === "mealsHero" ? "restaurant-outline" : "basket-outline"} color={appTheme.color(brand.teal, "text")} size={size * 0.52} />}
  </View>;
}

export function MealsBackdrop() {
  const appTheme = useAppTheme();

  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    {artwork.mealsBackground ? <Image source={artwork.mealsBackground} resizeMode="cover" style={StyleSheet.absoluteFill} /> :
      <Svg width="100%" height="100%" viewBox="0 0 400 850" preserveAspectRatio="none">
        <Defs><LinearGradient id="mealWash" x1="0" y1="0" x2="1" y2="1"><Stop stopColor={appTheme.color("#EFFBFA", "surface")} /><Stop offset="1" stopColor={appTheme.color("#E5F4FC", "surface")} /></LinearGradient></Defs>
        <Rect width="400" height="850" fill={appTheme.color("#F6FBFC", "surface")} />
        <Path d="M200 0 H400 V290 Q130 280 200 0" fill="url(#mealWash)" />
        <Path d="M0 570 Q170 620 400 830 V850 H0Z" fill={appTheme.color("#E2F4F8", "surface")} />
        <Path d="M0 850 Q180 700 400 680 V850Z" fill={appTheme.color("#E2F5EF", "surface")} />
      </Svg>}
  </View>;
}
