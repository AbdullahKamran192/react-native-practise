import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export const useProductList = () => {
  return useQuery({
    queryKey: ["products"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*");

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });
};

export const usePantryList = () => {
  return useQuery({
    queryKey: ["pantry"],

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
        .from("pantry")
        .select(`
          created_at,
          user_id,
          product_barcode,
          quantity,
          product:products (
            *
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw new Error(error.message);
      }

      console.log("Pantry rows returned:", data);

      return data;
    },
  });
};