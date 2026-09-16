import type { ImageSourcePropType } from "react-native";

// Add your artwork here with static require('./filename.png') after copying it
// into this folder. null intentionally uses the built-in vector fallback.
export const artwork: Record<"mealsHero" | "mealsBackground" | "pantryBasket" | "consumeBasket", ImageSourcePropType | null> = {
  mealsHero: null, // require('./meals-hero.png')
  mealsBackground: null, // require('./meals-background.png')
  pantryBasket: null, // require('./pantry-basket.png')
  consumeBasket: null, // require('./consume-basket.png')
};
