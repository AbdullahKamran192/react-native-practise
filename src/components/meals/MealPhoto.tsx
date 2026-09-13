import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { chooseMealPhoto, readMealPhoto } from "@/utils/mealPhoto";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { mealImageRequest } from "@/api/meals/images";
import type { Meal } from "@/api/meals";
import { MealButton, mealStyles as s } from "./ui";

export default function MealPhoto({ meal, editable = false }: { meal: Meal; editable?: boolean }) {
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
  const uri = draft ?? (meal.image_path ? query.data?.url : null);
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
      const result = await mealImageRequest(remove ? "remove" : "upload", String(meal.id), bytes);
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
      : <View style={[photoStyle, { backgroundColor: "#EDEDED", alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="image-outline" size={editable ? 40 : 26} color="#999" />
        {editable && <Text style={s.muted}>{query.isFetching ? "Loading photo..." : "No photo available"}</Text>}
      </View>}
    {editable && <>
      <View style={s.row}>
        <MealButton secondary disabled={busy} title="Choose photo" onPress={() => void choose(false)} />
        <MealButton secondary disabled={busy} title="Take photo" onPress={() => void choose(true)} />
      </View>
      {draft ? <View style={s.row}>
        <MealButton disabled={busy} title={busy ? "Saving..." : "Save photo"} onPress={() => void save()} />
        <MealButton secondary disabled={busy} title="Cancel" onPress={() => setDraft(null)} />
      </View> : meal.image_path ? <MealButton secondary disabled={busy} title={busy ? "Please wait..." : "Remove photo"} onPress={() => void save(true)} /> : null}
      {(error || query.error) && <Text style={s.error}>{error ?? query.error?.message}</Text>}
      {(query.error || (uri && failed === uri)) && <MealButton secondary title="Reload photo" onPress={() => { setFailed(null); void query.refetch(); }} />}
    </>}
  </View>;
}
