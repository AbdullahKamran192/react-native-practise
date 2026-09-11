import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export type UserSettings = {
  user_id: string;
  calories_target_per_day: number;
  protein_target_per_day: number;
  carbs_target_per_day: number;
  fat_target_per_day: number;
  sugars_target_per_day: number;
  salt_target_per_day: number;
  fibre_target_per_day: number;
  cost_target_per_day: number;
};

export type SaveUserSettings = Omit<
  UserSettings,
  "user_id"
>;

export const useUserSettings = () => {
  return useQuery<UserSettings | null>({
    queryKey: ["user-settings"],

    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("User is not signed in.");
      }

      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data as UserSettings | null;
    },
  });
};

export const useSaveUserSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      settings: SaveUserSettings
    ) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("User is not signed in.");
      }

      const { data, error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            ...settings,
          },
          {
            onConflict: "user_id",
          }
        )
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as UserSettings;
    },

    onSuccess: (savedSettings) => {
      queryClient.setQueryData(
        ["user-settings"],
        savedSettings
      );
    },
  });
};