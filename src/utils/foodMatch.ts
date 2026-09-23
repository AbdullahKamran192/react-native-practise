import type { FoodClassification } from "@/api/products";

export type FoodMatchTier = "exact_generic" | "same_family" | "same_group" | "none";
const sameId = (a: number | null | undefined, b: number | null | undefined) =>
  a != null && b != null && String(a) === String(b);

export function foodMatchTier(
  requiredId: number | null | undefined,
  required: FoodClassification | null | undefined,
  candidateId: number | null | undefined,
  candidate: FoodClassification | null | undefined,
): FoodMatchTier {
  if (required?.is_active === false || candidate?.is_active === false) return "none";
  if (sameId(requiredId, candidateId)) return "exact_generic";
  // Missing/inactive relationships never establish compatibility.
  const validFamily = (food: FoodClassification | null | undefined) =>
    food?.food_family?.is_active === true &&
    sameId(food.food_family_id, food.food_family.id) &&
    (food.food_group_id == null || sameId(food.food_group_id, food.food_family.food_group_id));
  if (requiredId != null && candidateId != null && validFamily(required) && validFamily(candidate) &&
      sameId(required?.food_family_id, candidate?.food_family_id)) return "same_family";
  if (required?.food_group?.is_active && candidate?.food_group?.is_active &&
      sameId(required.food_group_id, candidate.food_group_id)) return "same_group";
  return "none";
}
