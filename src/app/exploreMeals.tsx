import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { supabase } from "@/lib/supabase";
import type { PublicMeal } from "@/api/publicMeals";
import { mealTypes } from "@/utils/mealTypes";
import { genericProductImageUrl } from "@/utils/productImage";
import { brand, nutrients } from "@/components/brand/theme";
import { formatNumber } from "@/utils/formatNumber";
import { AppIcon } from "@/components/brand/AppIcon";
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";

function MealCard({ meal, width }: { meal: PublicMeal; width: number }) {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);
  const styles = useThemeStyles(baseStyles);

  const uri = genericProductImageUrl(meal.image_path);
  const [failed, setFailed] = useState<string | null>(null);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${meal.meal_name}`}
    style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.8 }]}
    onPress={() => router.push({ pathname: "/publicMealDetails", params: { publicMealId: String(meal.id) } })}>
    <View style={styles.cardContent}>
    {uri && failed !== uri ? <Image source={{ uri }} style={styles.image} contentFit="cover"
      accessibilityLabel={meal.meal_name} onError={() => setFailed(uri)} />
      : <View style={[styles.image, styles.placeholder]}><AppIcon name="image-outline" size={40} color={appTheme.color(brand.muted, "text")} /><Text style={s.muted}>No image available</Text></View>}
    <View style={styles.caption}><Text style={[s.heading, styles.mealName]} numberOfLines={2}>{meal.meal_name}</Text>
      {!!meal.description && <Text style={[s.muted, styles.description]} numberOfLines={3}>{meal.description}</Text>}
      <View style={styles.nutritionRow}>
        {(["calories", "protein", "fat"] as const).map(key => {
          const theme = nutrients[key];
          const ingredients = meal.ingredients ?? [];
          const complete = ingredients.length > 0 && ingredients.every(item => item.generic_product?.[`${key}_per_100`] != null);
          const total = ingredients.reduce((sum, item) => sum + Number(item.generic_product?.[`${key}_per_100`] ?? 0) * Number(item.amount) / 100, 0);
          const value = complete ? `${formatNumber(total)}${key === "calories" ? " kcal" : "g"}` : "—";
          return <View key={key} accessible accessibilityLabel={`${key}: ${complete ? value : "Nutrition unavailable"}`}
            style={[styles.nutritionBadge, { flex: key === "calories" ? 1.6 : 1, backgroundColor: appTheme.color(theme.background, "surface") }]}>
            <AppIcon name={theme.icon} size={12} color={appTheme.color(theme.color, "text")} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.nutritionValue, { color: appTheme.color(theme.color, "text") }]}>{value}</Text>
          </View>;
        })}
      </View>
    </View>
    </View>
  </Pressable>;
}

function MealCategory({ mealType }: { mealType: string }) {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);
  const styles = useThemeStyles(baseStyles);

  const { width } = useWindowDimensions();
  const query = useInfiniteQuery({
    queryKey: ["public-meals", "category", "nutrition", mealType], initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.from("public_meals")
        .select("*, ingredients:public_meal_ingredients(amount, generic_product:generic_products(calories_per_100,protein_per_100,fat_per_100))")
        .eq("meal_type", mealType).gt("id", pageParam).order("id").limit(21);
      if (error) throw new Error(error.message);
      const rows = data as unknown as PublicMeal[];
      return { items: rows.slice(0, 20), next: rows.length > 20 ? rows[19].id : undefined };
    },
    getNextPageParam: page => page.next,
  });
  const next = () => { if (query.hasNextPage && !query.isFetching) void query.fetchNextPage(); };
  return <View style={styles.category}>
    <Text style={[s.heading, styles.inset]}>{mealType}</Text>
    {query.isPending ? <ActivityIndicator color={appTheme.color(brand.teal, "text")} /> : query.isError && !query.data ?
      <MealStatus error={query.error.message} retry={() => void query.refetch()} /> :
      <FlatList horizontal data={query.data?.pages.flatMap(page => page.items) ?? []}
        keyExtractor={meal => String(meal.id)} contentContainerStyle={styles.mealRow}
        showsHorizontalScrollIndicator={false} onEndReached={next} onEndReachedThreshold={0.3}
        renderItem={({ item }) => <MealCard meal={item} width={Math.min(240, width * 0.58)} />}
        ListFooterComponent={query.hasNextPage ? <View style={styles.more}>
          {query.isFetchingNextPage ? <ActivityIndicator color={appTheme.color(brand.teal, "text")} /> :
            <MealButton secondary title={query.isFetchNextPageError ? "Try again" : "More meals"} onPress={next} />}
        </View> : null} />}
  </View>;
}

export default function ExploreMeals() {
  const s = useThemeStyles(baseS);
  const styles = useThemeStyles(baseStyles);

  const query = useQuery({ queryKey: ["public-meals", "categories"], queryFn: async () => {
    const { data, error } = await supabase.rpc("public_meal_types");
    if (error) throw new Error(error.code === "PGRST202" ? "Run 20260919_public_meal_types.sql in Supabase first." : error.message);
    const present = new Set((data as { meal_type: string }[]).map(row => row.meal_type));
    return mealTypes.filter(type => present.has(type));
  } });
  if (query.isPending) return <MealStatus loading />;
  if (query.error) return <MealStatus error={query.error.message} retry={() => void query.refetch()} />;
  return <FlatList style={s.screen} contentContainerStyle={styles.content}
    data={query.data} keyExtractor={type => type} renderItem={({ item }) => <MealCategory mealType={item} />}
    ListHeaderComponent={<View style={[styles.inset, styles.intro]}><Text style={s.title}>Explore Meals</Text>
      <Text style={s.muted}>Find a recipe, check your pantry, then cook it or save your version.</Text></View>}
    ListEmptyComponent={<Text style={[s.muted, styles.inset]}>Recipes will appear here once they are added to the public catalogue.</Text>} />;
}
const baseStyles = StyleSheet.create({
  content: { paddingVertical: 20, paddingBottom: 48 },
  inset: { paddingHorizontal: 20 },
  intro: { gap: 10, marginBottom: 28 },
  category: { gap: 16, marginBottom: 28 },
  mealRow: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 14, alignItems: "stretch" },
  card: {
    borderRadius: 16, backgroundColor: brand.surface,
    shadowColor: brand.ink, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 5, elevation: 3,
  },
  cardContent: { flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: brand.surface },
  image: { width: "100%", height: 150, backgroundColor: brand.paleTeal },
  placeholder: { alignItems: "center", justifyContent: "center", gap: 10 },
  caption: { padding: 14, gap: 8 },
  mealName: { fontSize: 17, lineHeight: 23 },
  description: { fontSize: 14, lineHeight: 20 },
  nutritionRow: { flexDirection: "row", gap: 5, marginTop: 4 },
  nutritionBadge: { minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 4, paddingVertical: 7, borderRadius: 9 },
  nutritionValue: { flexShrink: 1, fontSize: 11, fontWeight: "600" },
  more: { justifyContent: "center", paddingHorizontal: 8 },
});
