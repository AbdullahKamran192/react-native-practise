import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { saveBarcodeProduct } from "@/api/products";
import type { ProductSubmission, MeasurementUnit } from "@/utils/productSubmission";

export type LogInput = {
  consumedOn: string;
  removeFromPantry: boolean;
} & (
  | { mealId: string }
  | { amount: number; unit: MeasurementUnit; barcode: string; brand?: string; submission: ProductSubmission }
  | { amount: number; unit: MeasurementUnit; genericProductId: string }
);
export type PendingLog = { userId: string; groupId: string; timeZone: string; input: LogInput };
export type ConsumptionRow = {
  id: number; consumption_group_id: string; consumed_on: string;
  product_name_snapshot: string; meal_name_snapshot: string | null;
  amount_consumed: number; measurement_unit: MeasurementUnit;
  calories_consumed: number | null;
};

export function localDate(date = new Date()): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
export function validateInput(input: LogInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.consumedOn)) throw new Error("Choose a consumption date.");
  if ("mealId" in input) {
    if (!/^[1-9]\d*$/.test(input.mealId)) throw new Error("Choose a valid meal.");
  } else {
    if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount >= 1e9 ||
      Math.round(input.amount * 1000) <= 0 || Math.round(input.amount * 1000) >= 1e12) {
      throw new Error("Enter a positive amount below 1000000000.");
    }
    if (input.unit !== "g" && input.unit !== "ml") throw new Error("Choose grams or millilitres.");
    if ("genericProductId" in input && !/^[1-9]\d*$/.test(input.genericProductId)) throw new Error("Choose a valid generic food.");
    if ("barcode" in input && (!input.barcode || input.submission.barcode_number !== input.barcode)) throw new Error("Choose a valid barcode product.");
  }
}
async function userId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("Sign in to log food.");
  return user.id;
}
const keyFor = (user: string, scope: string) => "foodworth:food-log:" + user + ":" + scope;
export async function getPendingLog(scope: string): Promise<PendingLog | null> {
  const user = await userId();
  const value = await AsyncStorage.getItem(keyFor(user, scope));
  if (!value) return null;
  const pending = JSON.parse(value) as PendingLog;
  if (pending.userId !== user || !pending.groupId || !pending.input) throw new Error("Could not read the previous food log.");
  return pending;
}
// This UUID identifies a retry, not a credential. Access is checked by auth.uid().
function newGroupId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
const active = new Map<string, Promise<ConsumptionRow[]>>();
export async function logConsumption(scope: string, input?: LogInput): Promise<ConsumptionRow[]> {
  const user = await userId();
  const key = keyFor(user, scope);
  const running = active.get(key);
  if (running) return running;
  const operation = execute(user, key, input);
  active.set(key, operation);
  try { return await operation; } finally { active.delete(key); }
}
async function execute(user: string, key: string, input?: LogInput): Promise<ConsumptionRow[]> {
  const value = await AsyncStorage.getItem(key);
  let pending: PendingLog;
  if (value) {
    pending = JSON.parse(value);
    if (pending.userId !== user) throw new Error("Sign in with the original account to finish this log.");
  } else {
    if (!input) throw new Error("Enter the food details first.");
    validateInput(input);
    // Catalogue corrections may create the scanned product. They never change
    // pantry stock. Do this before persisting the immutable consumption request.
    if ("barcode" in input) await saveBarcodeProduct(input.submission);
    pending = { userId: user, groupId: newGroupId(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", input };
    await AsyncStorage.setItem(key, JSON.stringify(pending));
  }
  if (await userId() !== user) throw new Error("Your account changed. Sign in again before logging.");
  const saved = pending.input;
  const { data, error } = await supabase.rpc("log_food_consumption", {
    p_group_id: pending.groupId, p_consumed_on: saved.consumedOn,
    p_time_zone: pending.timeZone, p_remove_from_pantry: saved.removeFromPantry,
    p_meal_id: "mealId" in saved ? saved.mealId : null,
    p_product_barcode: "barcode" in saved ? saved.barcode : null,
    p_generic_product_id: "genericProductId" in saved ? saved.genericProductId : null,
    p_amount: "amount" in saved ? saved.amount : null,
    p_measurement_unit: "unit" in saved ? saved.unit : null,
    p_brand: "brand" in saved ? saved.brand : null,
  });
  if (error) {
    // SQL validation/constraint/permission errors roll back the whole RPC.
    if (error.code?.startsWith("22") || error.code?.startsWith("23") ||
      ["42501", "42P01", "PGRST202"].includes(error.code)) await AsyncStorage.removeItem(key);
    if (["PGRST202", "42P01"].includes(error.code)) {
      throw new Error("Run the food_consumption table SQL and 20260912_log_food_consumption.sql in Supabase first.");
    }
    throw new Error(error.message);
  }
  if (!data?.length) throw new Error("No saved food was returned. Retry the previous log to check its result.");
  // If cleanup fails, keep the original request for a harmless replay.
  await AsyncStorage.removeItem(key).catch(() => {});
  return data as ConsumptionRow[];
}

