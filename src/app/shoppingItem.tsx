import { useThemeStyles } from "@/theme/AppThemeProvider";
import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import useSelectedProduct, { type ProductSource } from "@/hooks/products/useSelectedProduct";
import { toNumber } from "@/api/products/productLookup/utils";
import { saveBarcodeProduct } from "@/api/products";
import { createProductSubmission } from "@/utils/productSubmission";
import { shoppingId, useCart, priceNumber } from "@/api/shopping";
import ProductReadOnlyDashboard from "@/components/products/ProductReadOnlyDashboard";
import ProductNutritionDashboard from "@/components/products/ProductNutritionDashboard";
import ProductValueDashboard from "@/components/products/ProductValueDashboard";
import AmountToAdd from "@/components/pantry/AmountToAdd";
import { resolvePantryAddition, type PantryAmountSelection } from "@/utils/pantryAmounts";
import { nutritionPerPound } from "@/utils/productValue";
import { MealButton, MealStatus, mealStyles as baseS } from "@/components/meals/ui";

export default function ShoppingItem() {
  const s = useThemeStyles(baseS);

  const params = useLocalSearchParams<{ data?: string; source?: ProductSource; productId?: string }>();
  const selected = useSelectedProduct(params);
  const cart = useCart();
  const [selection, setSelection] = useState<PantryAmountSelection>({ mode: "quantity", value: "1" });
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  const product = selected.product;
  const size = toNumber(product?.product_amount);
  const amount = resolvePantryAddition(selection, size);
  async function add() {
    if (!product || guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      if (!amount || priceNumber(price) === null) throw new Error("Enter the amount purchased and total price paid.");
      if (selected.isGenericProduct) {
        if (selected.lookupStatus !== "found") throw new Error("Choose an available generic food.");
      } else {
        const submission = createProductSubmission(selected.barcode ?? "", product);
        if (!submission.success) throw new Error(submission.error);
        if (!submission.data.product_name) throw new Error("Enter the product name.");
        await saveBarcodeProduct(submission.data);
      }
      await cart.change(current => {
        if (current.attempted) throw new Error("Finish the pending checkout before adding items.");
        if (current.items.length >= 100) throw new Error("Complete this shopping trip before adding more than 100 items.");
        return { ...current, items: [...current.items, { id: shoppingId(), product,
          product_barcode: selected.isGenericProduct ? null : selected.barcode!,
          generic_product_id: selected.isGenericProduct ? Number(selected.genericProductId) : null, amount, price }] };
      });
      router.dismissTo("/shopping");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not add product to cart."); }
    finally { guard.current = false; setBusy(false); }
  }
  if (selected.isLoading || cart.isLoading) return <MealStatus loading />;
  if (!product || cart.error) return <MealStatus error={cart.error?.message ?? "Could not load product."} />;
  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.heading}>Add purchase to cart</Text>
    {editing && !selected.isGenericProduct ? <View pointerEvents={busy ? "none" : "auto"}>
      <ProductNutritionDashboard product={product} myData={selected.productIdentifier} onProductChange={selected.setProduct} />
      <MealButton title="Done editing" secondary onPress={() => setEditing(false)} />
    </View> : <ProductReadOnlyDashboard product={product} isGenericProduct={selected.isGenericProduct}
      onEdit={selected.isGenericProduct || busy ? undefined : () => setEditing(true)} />}
    <AmountToAdd selection={selection} onChange={setSelection} packageSize={size} unit={product.measurement_unit} disabled={busy} />
    <View style={s.card}>
      <Text style={s.heading}>Total price paid (£)</Text>
      <Text style={s.muted}>For the entire amount above, not the price of one package.</Text>
      <TextInput style={s.input} accessibilityLabel="Total price paid in pounds" value={price} onChangeText={setPrice} editable={!busy} keyboardType="decimal-pad" placeholder="0.00" />
    </View>
    <ProductValueDashboard caloriesPerPound={nutritionPerPound(toNumber(product.nutriments.energy_kcal_100g), amount ?? 0, priceNumber(price) ?? 0)}
      proteinPerPound={nutritionPerPound(toNumber(product.nutriments.proteins_100g), amount ?? 0, priceNumber(price) ?? 0)} />
    {!!error && <Text style={s.error}>{error}</Text>}
    <MealButton title={busy ? "Adding…" : "Add to cart"} disabled={busy} onPress={add} />
  </ScrollView>;
}
