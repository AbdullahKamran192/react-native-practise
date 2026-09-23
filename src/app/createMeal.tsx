import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { AppIcon } from "@/components/brand/AppIcon";
import { useQueryClient } from "@tanstack/react-query";
import { useMealActions } from "@/api/meals";
import type { Meal, MealInput } from "@/api/meals";
import { mealImageRequest } from "@/api/meals/images";
import { chooseMealPhoto, readMealPhoto } from "@/utils/mealPhoto";
import MealForm from "@/components/meals/MealForm";
import { MealButton, mealStyles as baseS } from "@/components/meals/ui";

export default function CreateMealScreen() {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  const { create } = useMealActions();
  const client = useQueryClient();
  const [photo, setPhoto] = useState<string | null>(null);
  const [savedMeal, setSavedMeal] = useState<Meal | null>(null);
  const savedMealRef = useRef<Meal | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const openMeal = (meal: Meal) => router.replace({ pathname: "/mealDetails", params: { mealId: String(meal.id) } });

  async function choose(camera: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const uri = await chooseMealPhoto(camera);
      if (uri) setPhoto(uri);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open photo."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function save(values?: MealInput) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      // Validate/read the optional photo before creating a database row.
      const bytes = photo ? await readMealPhoto(photo) : undefined;
      let meal = savedMealRef.current;
      if (!meal) {
        if (!values) return;
        meal = await create.mutateAsync(values);
        savedMealRef.current = meal;
        setSavedMeal(meal);
      }
      if (bytes) {
        const result = await mealImageRequest("upload", String(meal.id), bytes);
        client.setQueryData(["meal-photo", meal.user_id, String(meal.id), result.image_path], { url: result.url });
        await client.invalidateQueries({ queryKey: ["meals"] });
      }
      openMeal(meal);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save meal."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Create meal</Text>
    <Text style={s.muted}>Add an optional photo now. Choose ingredients after saving your meal.</Text>
    <View style={s.card}>
      <Text style={s.heading}>Meal photo (optional)</Text>
      {photo ? <Image source={{ uri: photo }} style={{ width: "100%", height: 220, borderRadius: 14 }} contentFit="cover" accessibilityLabel="Selected meal photo preview" />
        : <View style={{ height: 120, borderRadius: 14, backgroundColor: appTheme.color("#EDEDED", "surface"), alignItems: "center", justifyContent: "center", gap: 8 }}>
          <AppIcon name="image-outline" size={36} color={appTheme.color("#999", "text")} />
          <Text style={s.muted}>No photo selected</Text>
        </View>}
      <View style={s.row}>
        <MealButton secondary disabled={busy} title="Choose photo" onPress={() => void choose(false)} />
        <MealButton secondary disabled={busy} title="Take photo" onPress={() => void choose(true)} />
        {photo && <MealButton secondary disabled={busy} title="Remove selection" onPress={() => setPhoto(null)} />}
      </View>
    </View>
    {savedMeal ? <View style={s.card}>
      <Text style={s.heading}>{savedMeal.meal_name} is saved</Text>
      <Text style={s.muted}>{busy ? "Saving your photo..." : "You can retry the photo upload or continue to your meal."}</Text>
      {error && <Text style={s.error}>{error}</Text>}
      {photo && <MealButton disabled={busy} title="Retry photo upload" onPress={() => void save()} />}
      <MealButton secondary disabled={busy} title="Continue to meal" onPress={() => openMeal(savedMeal)} />
    </View> : <MealForm saving={busy} error={error ?? undefined} onSave={values => void save(values)} />}
  </ScrollView>;
}
