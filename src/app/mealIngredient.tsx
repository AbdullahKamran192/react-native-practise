import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useMeal, useMealActions } from "@/api/meals";
import type { MealProduct } from "@/api/meals";
import { validateMealAmount, validateMealId } from "@/api/meals/validation";
import { saveBarcodeProduct } from "@/api/products";
import useSelectedProduct from "@/hooks/products/useSelectedProduct";
import type { ProductSource } from "@/hooks/products/useSelectedProduct";
import { toNumber } from "@/api/products/productLookup/utils";
import { createProductSubmission } from "@/utils/productSubmission";
import ProductReadOnlyDashboard from "@/components/products/ProductReadOnlyDashboard";
import ProductNutritionDashboard from "@/components/products/ProductNutritionDashboard";
import { MealButton, MealStatus, mealStyles as s } from "@/components/meals/ui";
import AmountToAdd from "@/components/pantry/AmountToAdd";
import { resolvePantryAddition } from "@/utils/pantryAmounts";
import type { PantryAmountSelection } from "@/utils/pantryAmounts";

export default function MealIngredientScreen() {
  const { mealId = "", data, source, productId } = useLocalSearchParams<{
    mealId: string; data?: string; source?: ProductSource; productId?: string;
  }>();
  const selected = useSelectedProduct({ data, source, productId });
  const meal = useMeal(mealId);
  const { addItem } = useMealActions();
  const client = useQueryClient();
  const [amountSelection, setAmountSelection] = useState<PantryAmountSelection | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveLock = useRef(false);
  const { product, isGenericProduct } = selected;
  const packageSize = toNumber(product?.product_amount);
  const selection: PantryAmountSelection = amountSelection ?? (packageSize !== null && packageSize > 0
    ? { mode: "quantity", value: "1" }
    : { mode: "amount", value: "" });
  const resolvedAmount = resolvePantryAddition(selection, packageSize);

  async function save() {
    if (!product || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      validateMealId(mealId);
      const ingredientAmount = validateMealAmount(resolvedAmount ?? 0);
      const existing = meal.data?.items.find((item) => isGenericProduct
        ? item.generic_product_id === Number(selected.genericProductId)
        : item.product_barcode === selected.barcode);
      if (existing) validateMealAmount(Number(existing.amount) + ingredientAmount);
      if (!existing && (meal.data?.items.length ?? 0) >= 50) {
        throw new Error("This meal already has 50 ingredients. Remove one before adding a new product.");
      }
      let reference: MealProduct;
      if (isGenericProduct) {
        if (selected.lookupStatus !== "found") throw new Error("This generic food is unavailable. Go back and choose another ingredient.");
        const id = Number(selected.genericProductId);
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Choose a valid generic food.");
        reference = { product_barcode: null, generic_product_id: id };
      } else {
        if (!selected.barcode) throw new Error("Scan or select a barcode product first.");
        const submission = createProductSubmission(selected.barcode, product);
        if (!submission.success) throw new Error(submission.error);
        if (!submission.data.product_name) throw new Error("Enter a product name before adding this ingredient.");
        // Save missing/scanned catalogue information through corrections only.
        // Recipe creation must never add anything to the pantry.
        await saveBarcodeProduct(submission.data);
        await Promise.all([
          client.invalidateQueries({ queryKey: ["products"] }),
          client.invalidateQueries({ queryKey: ["product-search"] }),
          client.invalidateQueries({ queryKey: ["pantry"] }),
        ]);
        reference = { product_barcode: selected.barcode, generic_product_id: null };
      }
      await addItem.mutateAsync({ mealId, amount: ingredientAmount, ...reference });
      router.dismissTo({ pathname: "/mealDetails", params: { mealId } });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not add this ingredient.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  if (selected.isLoading || meal.isLoading) return <MealStatus loading />;
  if (meal.error || !meal.data) return <MealStatus error={meal.error?.message ?? "Meal not found."} />;
  if (!product) return <MealStatus error="Product details are unavailable. Go back and choose a product again." />;
  const unit = product.measurement_unit;
  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.heading}>Add to {meal.data.meal_name}</Text>
    {selected.lookupStatus !== "found" && <Text style={s.muted}>Some product details could not be found. Review the information before adding it.</Text>}
    {!isGenericProduct && editing ? <View pointerEvents={saving ? "none" : "auto"}>
      <ProductNutritionDashboard product={product} myData={selected.productIdentifier} onProductChange={(updated) => {
        if (updated.measurement_unit !== product.measurement_unit) setAmountSelection(null);
        selected.setProduct(updated);
      }} />
      <MealButton title="Done editing product" secondary disabled={saving} onPress={() => setEditing(false)} />
    </View> : <ProductReadOnlyDashboard product={product} isGenericProduct={isGenericProduct} onEdit={isGenericProduct || saving ? undefined : () => setEditing(true)} />}
    <AmountToAdd purpose="recipe" selection={selection} onChange={setAmountSelection}
      packageSize={packageSize} unit={unit} disabled={saving} />
    <Text style={s.muted}>Adding a product already in this meal increases its existing amount.</Text>
    {error !== "" && <Text style={s.error}>{error}</Text>}
    <MealButton title={saving ? "Adding…" : "Add to meal"} disabled={saving} onPress={save} />
  </ScrollView>;
}
