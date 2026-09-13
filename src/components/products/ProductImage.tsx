import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { normaliseImageUrl } from "@/utils/productImage";

export default function ProductImage({ uri, name, compact = false, thumbnail = false, privateImage = false }: { uri?: string | null; name: string; compact?: boolean; thumbnail?: boolean; privateImage?: boolean }) {
  const url = normaliseImageUrl(uri);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <View style={[styles.card, compact && styles.compactCard, thumbnail && styles.thumbnail]}>
    {url && failedUrl !== url ? <Image
      key={url} source={{ uri: url }} style={[styles.image, compact && styles.compactImage, thumbnail && styles.thumbnailImage]} contentFit="contain"
      cachePolicy={privateImage ? "none" : "disk"}
      transition={200} accessibilityLabel={`Photo of ${name || "product"}`}
      onError={() => setFailedUrl(url)}
    /> : <View style={[styles.placeholder, compact && styles.compactImage, thumbnail && styles.thumbnailImage]} accessibilityLabel="No product image available">
      <Ionicons name="image-outline" size={36} color="#9A9A9A" />
      {!thumbnail && <Text style={styles.caption}>No image available</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", marginTop: 16 },
  image: { height: 180, width: "100%" },
  placeholder: { height: 120, alignItems: "center", justifyContent: "center", backgroundColor: "#EFEFEF", gap: 8 },
  caption: { fontSize: 13, color: "#777" },
  thumbnail: { width: 56, height: 56, marginTop: 0, borderRadius: 12, flexShrink: 0 },
  thumbnailImage: { width: 56, height: 56 },
  compactCard: { marginTop: 0, borderRadius: 0 },
  compactImage: { height: undefined, width: "100%", aspectRatio: 1 },
});
