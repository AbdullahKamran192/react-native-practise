import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { Image } from "expo-image";
import { AppIcon } from "@/components/brand/AppIcon";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { normaliseImageUrl, genericProductImageUrl } from "@/utils/productImage";

export default function ProductImage({ uri, name, compact = false, thumbnail = false, privateImage = false, thumbnailSize = 56, aspectRatio }: { uri?: string | null; name: string; compact?: boolean; thumbnail?: boolean; privateImage?: boolean; thumbnailSize?: number; aspectRatio?: number }) {
  const appTheme = useAppTheme();
  const styles = useThemeStyles(baseStyles);

  const url = normaliseImageUrl(uri);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const thumbnailDimensions = thumbnail ? { width: thumbnailSize, height: thumbnailSize } : undefined;
  const proportionalDimensions = aspectRatio && !thumbnail ? { width: "100%" as const, height: undefined, aspectRatio } : undefined;
  return <View style={[styles.card, compact && styles.compactCard, thumbnail && styles.thumbnail, thumbnailDimensions, proportionalDimensions && { width: "100%", marginTop: 0 }]}>
    {url && failedUrl !== url ? <Image
      key={url} source={{ uri: url }} style={[styles.image, compact && styles.compactImage, thumbnail && styles.thumbnailImage, thumbnailDimensions, proportionalDimensions]} contentFit="contain"
      cachePolicy={privateImage || url?.startsWith(genericProductImageUrl("products/")!) ? "none" : "disk"}
      transition={200} accessibilityLabel={`Photo of ${name || "product"}`}
      onError={() => setFailedUrl(url)}
    /> : <View style={[styles.placeholder, compact && styles.compactImage, thumbnail && styles.thumbnailImage, thumbnailDimensions, proportionalDimensions]} accessibilityLabel="No product image available">
      <AppIcon name="image-outline" size={36} color={appTheme.color("#9A9A9A", "text")} />
      {!thumbnail && <Text style={styles.caption}>No image available</Text>}
    </View>}
  </View>;
}

const baseStyles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", marginTop: 16 },
  image: { height: 180, width: "100%" },
  placeholder: { height: 120, alignItems: "center", justifyContent: "center", backgroundColor: "#EFEFEF", gap: 8 },
  caption: { fontSize: 13, color: "#777" },
  thumbnail: { width: 56, height: 56, marginTop: 0, borderRadius: 12, flexShrink: 0 },
  thumbnailImage: { width: 56, height: 56 },
  compactCard: { marginTop: 0, borderRadius: 0 },
  compactImage: { height: undefined, width: "100%", aspectRatio: 1 },
});
