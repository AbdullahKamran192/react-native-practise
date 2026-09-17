import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./operations";
import type { MealInput, AddMealItemInput } from "./types";
export * from "./types";

export const useMeals = () => useQuery({ queryKey: ["meals", "list"], queryFn: api.getMeals });
export const useMeal = (id: string) => useQuery({ queryKey: ["meals", "detail", id], queryFn: () => api.getMeal(id), enabled: !!id });

export function useMealActions() {
  const client = useQueryClient();
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["meals"] }); };
  const create = useMutation({ mutationFn: api.createMeal, onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: MealInput }) => api.updateMeal(id, values), onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.deleteMeal, onSuccess: async (_, id) => {
    client.removeQueries({ queryKey: ["meals", "detail", id] });
    await client.invalidateQueries({ queryKey: ["meals", "list"] });
  } });
  const addItem = useMutation({ mutationFn: (input: AddMealItemInput) => api.addMealItem(input), onSuccess: refresh });
  const updateItem = useMutation({ mutationFn: ({ mealId, itemId, amount }: { mealId: string; itemId: number; amount: number }) => api.updateMealItemAmount(mealId, itemId, amount), onSuccess: refresh });
  const removeItem = useMutation({ mutationFn: ({ mealId, itemId }: { mealId: string; itemId: number }) => api.removeMealItem(mealId, itemId), onSuccess: refresh });
  const replaceItem = useMutation({ mutationFn: api.replaceMealItem, onSuccess: refresh });
  return { create, update, remove, addItem, updateItem, removeItem, replaceItem };
}
