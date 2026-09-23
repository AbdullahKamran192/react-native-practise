import { useThemeStyles } from "@/theme/AppThemeProvider";
import ProductPhotoSubmission from "@/components/products/ProductPhotoSubmission";
import { formatNumber } from "@/utils/formatNumber";
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
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";
import AmountToAdd from "@/components/pantry/AmountToAdd";
import { resolvePantryAddition } from "@/utils/pantryAmounts";
import type { PantryAmountSelection } from "@/utils/pantryAmounts";

export default function MealIngredientScreen() {
  const s = useThemeStyles(baseS);

  const { mealId = "", data, source, productId, replaceItemId } = useLocalSearchParams<{
    mealId: string; data?: string; source?: ProductSource; productId?: string; replaceItemId?: string;
  }>();
  const selected = useSelectedProduct({ data, source, productId });
  const meal = useMeal(mealId);
  const { addItem, replaceProduct } = useMealActions();
  const replacing = meal.data?.items.find(item => String(item.id) === replaceItemId);
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
      if (replaceItemId && !replacing) throw new Error("This ingredient is no longer available.");
      if (replacing && product.measurement_unit !== (replacing.product ?? replacing.generic_product)?.measurement_unit)
        throw new Error("Choose a replacement using the same measurement unit as the recipe ingredient.");
      const ingredientAmount = validateMealAmount(replacing ? Number(replacing.amount) : resolvedAmount ?? 0);
      const existing = meal.data?.items.find((item) => isGenericProduct
        ? item.generic_product_id === Number(selected.genericProductId)
        : item.product_barcode === selected.barcode);
      if (replacing && existing && existing.id !== replacing.id) throw new Error("That product is already in this meal. Choose a different replacement.");
      if (!replacing && existing) validateMealAmount(Number(existing.amount) + ingredientAmount);
      if (!replacing && !existing && (meal.data?.items.length ?? 0) >= 50) {
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
      if (replacing) await replaceProduct.mutateAsync({ mealId, itemId: replacing.id,
        originalBarcode: replacing.product_barcode, originalGenericId: replacing.generic_product_id,
        originalAmount: replacing.amount, ...reference });
      else await addItem.mutateAsync({ mealId, amount: ingredientAmount, ...reference });
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
    {!isGenericProduct && <ProductPhotoSubmission key={selected.productIdentifier} barcode={selected.productIdentifier} product={product} disabled={saving} />}
    <Text style={s.heading}>{replaceItemId ? "Replace ingredient in" : "Add to"} {meal.data.meal_name}</Text>
    {selected.lookupStatus !== "found" && <Text style={s.muted}>Some product details could not be found. Review the information before adding it.</Text>}
    {!isGenericProduct && editing ? <View pointerEvents={saving ? "none" : "auto"}>
      <ProductNutritionDashboard product={product} myData={selected.productIdentifier} onProductChange={(updated) => {
        if (updated.measurement_unit !== product.measurement_unit) setAmountSelection(null);
        selected.setProduct(updated);
      }} />
      <MealButton title="Done editing product" secondary disabled={saving} onPress={() => setEditing(false)} />
    </View> : <ProductReadOnlyDashboard product={product} isGenericProduct={isGenericProduct} onEdit={isGenericProduct || saving ? undefined : () => setEditing(true)} />}
    {replaceItemId ? <Text style={s.text}>Recipe amount: {formatNumber(replacing?.amount)}{unit}. Replacing this ingredient does not change pantry stock.</Text> : <AmountToAdd purpose="recipe" selection={selection} onChange={setAmountSelection}
      packageSize={packageSize} unit={unit} disabled={saving} />}
    {!replaceItemId && <Text style={s.muted}>Adding a product already in this meal increases its existing amount.</Text>}
    {error !== "" && <Text style={s.error}>{error}</Text>}
    <MealButton title={saving ? "Saving…" : replaceItemId ? "Use as replacement" : "Add to meal"} disabled={saving} onPress={save} />
  </ScrollView>;
}
