import { useAppTheme, useThemeStyles } from "@/theme/AppThemeProvider";
import { genericProductImageUrl } from "@/utils/productImage";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { chooseMealPhoto, readMealPhoto } from "@/utils/mealPhoto";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { AppIcon } from "@/components/brand/AppIcon";
import { mealImageRequest } from "@/api/meals/images";
import type { Meal } from "@/api/meals";
import { MealButton, mealStyles as baseS } from "./ui";

export default function MealPhoto({ meal, editable = false }: { meal: Meal; editable?: boolean }) {
  const appTheme = useAppTheme();
  const s = useThemeStyles(baseS);

  const client = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["meal-photo", meal.user_id, String(meal.id), meal.image_path],
    queryFn: () => mealImageRequest("view", String(meal.id)),
    enabled: !!meal.image_path,
    staleTime: 600000, refetchInterval: 600000, gcTime: 0,
  });
  const uri = draft ?? (meal.image_path ? query.data?.url : genericProductImageUrl(meal.public_image_path));
  async function choose(camera: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const uri = await chooseMealPhoto(camera);
      if (uri) setDraft(uri);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open photo."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(remove = false) {
    if (lock.current || (!remove && !draft)) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const bytes = remove ? undefined : await readMealPhoto(draft!);
      const result = remove && !meal.image_path ? { image_path: null, url: null } : await mealImageRequest(remove ? "remove" : "upload", String(meal.id), bytes);
      if (meal.public_image_path) {
        const { error } = await supabase.from("meals").update({ public_image_path: null }).eq("id", meal.id).eq("user_id", meal.user_id);
        if (error) throw error;
      }
      client.setQueryData(["meal-photo", meal.user_id, String(meal.id), result.image_path], { url: result.url });
      setFailed(null);
      setDraft(null);
      await Promise.all([client.invalidateQueries({ queryKey: ["meals"] }), client.invalidateQueries({ queryKey: ["meal-photo", meal.user_id, String(meal.id)] })]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save photo."); }
    finally { lock.current = false; setBusy(false); }
  }
  const photoStyle = editable ? { width: "100%" as const, height: 220, borderRadius: 14 } : { width: 64, height: 64, borderRadius: 12 };
  return <View style={editable ? s.card : undefined}>
    {uri && failed !== uri ? <Image key={uri} source={{ uri }} style={photoStyle} contentFit="cover" cachePolicy="none" accessibilityLabel={`Photo of ${meal.meal_name}`} onError={() => setFailed(uri)} />
      : <View style={[photoStyle, { backgroundColor: appTheme.color("#EDEDED", "surface"), alignItems: "center", justifyContent: "center" }]}>
        <AppIcon name="image-outline" size={editable ? 40 : 26} color={appTheme.color("#999", "text")} />
        {editable && <Text style={s.muted}>{query.isFetching ? "Loading photo..." : "No photo available"}</Text>}
      </View>}
    {editable && <>
      <View style={s.actionRow}>
        <MealButton equalWidth secondary disabled={busy} icon="image-outline" title="Choose photo" onPress={() => void choose(false)} />
        <MealButton equalWidth secondary disabled={busy} icon="camera-outline" title="Take photo" onPress={() => void choose(true)} />
      </View>
      {draft ? <View style={s.actionRow}>
        <MealButton equalWidth disabled={busy} title={busy ? "Saving..." : "Save photo"} onPress={() => void save()} />
        <MealButton equalWidth secondary disabled={busy} title="Cancel" onPress={() => setDraft(null)} />
      </View> : (meal.image_path || meal.public_image_path) ? <MealButton destructive icon="trash-outline" disabled={busy} title={busy ? "Please wait..." : "Remove photo"} onPress={() => void save(true)} /> : null}
      {(error || query.error) && <Text style={s.error}>{error ?? query.error?.message}</Text>}
      {(query.error || (uri && failed === uri)) && <MealButton secondary title="Reload photo" onPress={() => { setFailed(null); void query.refetch(); }} />}
    </>}
  </View>;
}
