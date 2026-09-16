import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";
import { artwork } from "../../../assets/brand/artwork";
import { brand } from "./theme";

export function BrandArtwork({ name, size = 80 }: { name: "mealsHero" | "pantryBasket" | "consumeBasket"; size?: number }) {
  const source = artwork[name];
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: 24, backgroundColor: brand.paleTeal, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
    {source ? <Image source={source} resizeMode="contain" style={{ width: size, height: size }} />
      : <Ionicons name={name === "mealsHero" ? "restaurant-outline" : "basket-outline"} color={brand.teal} size={size * 0.52} />}
  </View>;
}

export function MealsBackdrop() {
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    {artwork.mealsBackground ? <Image source={artwork.mealsBackground} resizeMode="cover" style={StyleSheet.absoluteFill} /> :
      <Svg width="100%" height="100%" viewBox="0 0 400 850" preserveAspectRatio="none">
        <Defs><LinearGradient id="mealWash" x1="0" y1="0" x2="1" y2="1"><Stop stopColor="#EFFBFA" /><Stop offset="1" stopColor="#E5F4FC" /></LinearGradient></Defs>
        <Rect width="400" height="850" fill="#F6FBFC" />
        <Path d="M200 0 H400 V290 Q130 280 200 0" fill="url(#mealWash)" />
        <Path d="M0 570 Q170 620 400 830 V850 H0Z" fill="#E2F4F8" />
        <Path d="M0 850 Q180 700 400 680 V850Z" fill="#E2F5EF" />
      </Svg>}
  </View>;
}
