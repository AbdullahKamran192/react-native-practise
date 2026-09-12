import type { PantryItem } from "@/api/products";
import { toNumber } from "@/api/products/productLookup/utils";

export type PantryAmountSelection = { mode: "quantity" | "amount"; value: string };

export function resolvePantryAddition(selection: PantryAmountSelection, packageSize: number | null): number | null {
  const value = toNumber(selection.value);
  if (value === null || value <= 0) return null;
  if (selection.mode === "quantity" && (packageSize === null || packageSize <= 0)) return null;
  const amount = selection.mode === "quantity" ? value * packageSize! : value;
  try {
    return validatePantryAddition(amount);
  } catch {
    return null;
  }
}

export function getPantryAmounts(item: PantryItem) {
  const amountRemaining = Number(item.amount_remaining);
  const productAmount = Number(
    item.product?.product_amount ?? item.generic_product?.default_amount
  );

  return {
    amountRemaining,
    productAmount,
    quantity: Number.isFinite(productAmount) && productAmount > 0
      ? amountRemaining / productAmount
      : null,
  };
}

export function formatPantryQuantity(quantity: number): string {
  if (quantity > 0 && quantity < 0.001) return "<0.001";
  return String(Number(quantity.toFixed(3)));
}

export function validatePantryAddition(amount: number): number {
  const rounded = Math.round(amount * 1000) / 1000;
  if (!Number.isFinite(amount) || rounded <= 0 || amount > 100000000) {
    throw new Error("Enter an amount to add between 0.001 and 100000000 g or ml.");
  }
  return rounded;
}

export function addPantryAmounts(current: number, addition: number): number {
  const total = Math.round((current + addition) * 1000) / 1000;
  if (!Number.isFinite(current) || current < 0 || !Number.isFinite(total) ||
      total <= 0 || total > 100000000) {
    throw new Error("The remaining pantry amount must be greater than zero and no more than 100000000.");
  }
  return total;
}
