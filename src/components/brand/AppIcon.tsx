import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Image, StyleSheet } from "react-native";
import { iconKeys, uiIcons } from "../../../assets/brand/uiAssets";

type Props = ComponentProps<typeof Ionicons>;

/** Render the configured vector or local image at the screen's existing size. */
export function AppIcon({ name, size = 24, color, style, ...props }: Props) {
  const key = name ? iconKeys[name] : undefined;
  const asset = key ? uiIcons[key] : undefined;
  if (asset?.kind === "image") {
    const flatStyle = StyleSheet.flatten(style);
    return <Image
      accessible={props.accessible}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityRole={props.accessibilityRole}
      accessibilityElementsHidden={props.accessibilityElementsHidden}
      importantForAccessibility={props.importantForAccessibility}
      testID={props.testID}
      onLayout={props.onLayout}
      source={asset.source}
      resizeMode="contain"
      style={{ width: size, height: size, opacity: flatStyle?.opacity,
        tintColor: asset.tint ? color ?? flatStyle?.color : undefined }}
    />;
  }
  return <Ionicons {...props} name={asset?.kind === "icon" ? asset.name : name}
    size={size} color={color} style={style} />;
}

// Existing icon-name prop types remain compatible with the underlying library.
AppIcon.glyphMap = Ionicons.glyphMap;
