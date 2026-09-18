import { formatNumber } from "@/utils/formatNumber";
import MealPeriodSelector from "@/components/MealPeriodSelector";
import { defaultMealPeriod } from "@/utils/mealPeriod";
import NutritionTile from "@/components/brand/NutritionTile";
import { BrandArtwork } from "@/components/brand/Artwork";
import ProductPhotoSubmission from "@/components/products/ProductPhotoSubmission";
import ProductImage from "@/components/products/ProductImage";
import { AppIcon } from "@/components/brand/AppIcon";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import type { LookupProduct } from "@/api/products/productLookup";
import {
  createEmptyProduct,
  toNumber,
} from "@/api/products/productLookup/utils";

import ProductNutritionDashboard from "@/components/products/ProductNutritionDashboard";
import ProductReadOnlyDashboard from "@/components/products/ProductReadOnlyDashboard";

import useSelectedProduct from "@/hooks/products/useSelectedProduct";
import type { ProductSource } from "@/hooks/products/useSelectedProduct";

import { productScreenStyles as styles } from "@/styles/productScreen/styles";
import { localDate } from "@/api/consumption";
import { useConsumptionLog } from "@/hooks/useConsumptionLog";
import { createProductSubmission } from "@/utils/productSubmission";

type ConsumedNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  salt: number;
  fibre: number;
};

const EMPTY_NUTRITION: ConsumedNutrition = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sugars: 0,
  salt: 0,
  fibre: 0,
};

const ProductConsumeScreen = () => {
  const {
    data,
    source,
    productId,
  } = useLocalSearchParams<{
    data?: string;
    source?: ProductSource;
    productId?: string;
  }>();

  const {
    product,
    setProduct,
    isLoading,
    lookupStatus,
    isGenericProduct,
    productIdentifier,
  } = useSelectedProduct({
    data,
    source,
    productId,
  });

  const [consumedAmount, setConsumedAmount] =
    useState("");

  const [showQuantityPicker, setShowQuantityPicker] =
    useState(false);

  const [consumedAt, setConsumedAt] =
    useState(new Date());

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [mealPeriod, setMealPeriod] = useState(defaultMealPeriod);
  const [removeFromPantry, setRemoveFromPantry] =
    useState(true);

  const [isEditingProduct, setIsEditingProduct] =
    useState(false);

  const log = useConsumptionLog("product:" + (isGenericProduct ? "generic:" : "barcode:") + productIdentifier);

  const consumedNutrition = useMemo(() => {
    if (!product) {
      return EMPTY_NUTRITION;
    }

    const amount = toNumber(consumedAmount);

    if (amount === null || amount <= 0) {
      return EMPTY_NUTRITION;
    }

    const multiplier = amount / 100;

    return {
      calories:
        (toNumber(
          product.nutriments.energy_kcal_100g
        ) ?? 0) * multiplier,

      protein:
        (toNumber(
          product.nutriments.proteins_100g
        ) ?? 0) * multiplier,

      carbs:
        (toNumber(
          product.nutriments.carbohydrates_100g
        ) ?? 0) * multiplier,

      fat:
        (toNumber(
          product.nutriments.fat_100g
        ) ?? 0) * multiplier,

      sugars:
        (toNumber(
          product.nutriments.sugars_100g
        ) ?? 0) * multiplier,

      salt:
        (toNumber(
          product.nutriments.salt_100g
        ) ?? 0) * multiplier,

      fibre:
        (toNumber(
          product.nutriments.fiber_100g
        ) ?? 0) * multiplier,
    };
  }, [consumedAmount, product]);

  const measurementUnit =
    product?.measurement_unit ?? "g";

  const servingAmount = toNumber(product?.product_amount);
  const hasServingAmount =
    servingAmount !== null && servingAmount > 0;

  const formattedDate = consumedAt.toLocaleDateString(
    "en-GB",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  function handleProductChange(
    updatedProduct: LookupProduct
  ) {
    setProduct(updatedProduct);
  }

  function handleDateChange(_event: DateTimePickerChangeEvent, selectedDate: Date) {
    setConsumedAt(selectedDate);
    if (Platform.OS === "android") setShowDatePicker(false);
  }

  async function handleLogConsumption() {
    if (log.saving || log.checking || log.storageError) return;
    if (log.pending) {
      const rows = await log.submit();
      if (rows) Alert.alert("Food logged", rows[0].product_name_snapshot + " saved for " + rows[0].consumed_on + ".");
      return;
    }
    if (!product) {
      return;
    }

    const amount = toNumber(consumedAmount);

    if (amount === null || amount <= 0) {
      Alert.alert(
        "Invalid amount",
        `Enter the amount consumed in ${measurementUnit}.`
      );

      return;
    }

    const hasNutrition =
      toNumber(
        product.nutriments.energy_kcal_100g
      ) !== null ||
      toNumber(
        product.nutriments.proteins_100g
      ) !== null ||
      toNumber(
        product.nutriments.carbohydrates_100g
      ) !== null ||
      toNumber(
        product.nutriments.fat_100g
      ) !== null;

    if (!hasNutrition) {
      Alert.alert(
        "Missing nutrition",
        `Enter at least one nutrition value per 100${measurementUnit}.`
      );

      return;
    }

    const common = { amount, unit: measurementUnit, consumedOn: localDate(consumedAt), mealPeriod, removeFromPantry };
    let rows;
    if (isGenericProduct) {
      if (lookupStatus !== "found") {
        Alert.alert("Food unavailable", "Choose an available generic food.");
        return;
      }
      rows = await log.submit({ ...common, genericProductId: productIdentifier });
    } else {
      const submission = createProductSubmission(productIdentifier, product);
      if (!submission.success) {
        Alert.alert("Check product details", submission.error);
        return;
      }
      if (!submission.data.product_name) {
        Alert.alert("Missing product name", "Enter the product name before logging.");
        return;
      }
      rows = await log.submit({ ...common, barcode: productIdentifier, submission: submission.data, brand: product.brands });
    }
    if (rows) {
      setConsumedAmount("");
      Alert.alert("Food logged", rows[0].product_name_snapshot + " saved for " + rows[0].consumed_on + ".");
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator
          size="large"
          color="#222"
        />

        <Text style={styles.loadingText}>
          Finding your product...
        </Text>
      </SafeAreaView>
    );
  }

  const editableProduct =
    product ?? createEmptyProduct();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View pointerEvents={log.saving || log.pending ? "none" : "auto"}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerLabel}>
              {isGenericProduct
                ? "Generic food"
                : "Packaged product"}
            </Text>

            <Text style={styles.title}>
              Consume Food
            </Text>

            <Text style={styles.subtitle}>
              Enter how much you consumed and when.
            </Text>
          </View>

          <BrandArtwork name="consumeBasket" size={72} />
        </View>

        {lookupStatus === "not-found" && (
          <View style={styles.manualEntryNotice}>
            <AppIcon
              name="information-circle-outline"
              size={23}
              color="#7A5413"
            />

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Product not found
              </Text>

              <Text style={styles.noticeText}>
                Product details are missing. Tap Edit
                to enter the information you know.
              </Text>
            </View>
          </View>
        )}

        {lookupStatus === "error" && (
          <View style={styles.manualEntryNotice}>
            <AppIcon
              name="cloud-offline-outline"
              size={23}
              color="#7A5413"
            />

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Product information unavailable
              </Text>

              <Text style={styles.noticeText}>
                We couldn't retrieve this product.
                Tap Edit to enter its information
                manually, or try again.
              </Text>
            </View>
          </View>
        )}

        {isGenericProduct ? <ProductImage uri={editableProduct.image_url} name={editableProduct.product_name} />
          : <ProductPhotoSubmission key={productIdentifier} barcode={productIdentifier} product={editableProduct} />}

        {isGenericProduct && (
          <View style={styles.genericProductNotice}>
            <AppIcon
              name="lock-closed-outline"
              size={21}
              color="#365A40"
            />

            <View style={styles.noticeContent}>
              <Text style={styles.genericProductNoticeTitle}>
                Curated generic food
              </Text>

              <Text style={styles.genericProductNoticeText}>
                Product details and nutrition are fixed.
                Enter only the amount you consumed below.
              </Text>
            </View>
          </View>
        )}

        {!isGenericProduct && isEditingProduct ? (
          <>
            <ProductNutritionDashboard
              product={editableProduct}
              myData={productIdentifier}
              onProductChange={handleProductChange}
            />

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed &&
                  styles.secondaryButtonPressed,
              ]}
              onPress={() => setIsEditingProduct(false)}
            >
              <AppIcon
                name="checkmark-outline"
                size={21}
                color="#222"
              />

              <Text style={styles.secondaryButtonText}>
                Done Editing
              </Text>
            </Pressable>
          </>
        ) : (
          <ProductReadOnlyDashboard
            product={editableProduct}
            isGenericProduct={isGenericProduct}
            onEdit={
              isGenericProduct
                ? undefined
                : () => setIsEditingProduct(true)
            }
          />
        )}

        <Text style={styles.sectionTitle}>
          Amount consumed
        </Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>
            How much did you consume?
          </Text>

          <View style={styles.amountPresetRow}>
            <Pressable
              style={({ pressed }) => [
                styles.amountPresetButton,
                !hasServingAmount && styles.amountPresetDisabled,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() => {
                if (hasServingAmount) {
                  setConsumedAmount(String(servingAmount));
                }
              }}
              disabled={!hasServingAmount}
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasServingAmount }}
              accessibilityLabel={
                hasServingAmount
                  ? `Use one whole product, ${formatNumber(servingAmount)}${measurementUnit}`
                  : "One serving unavailable: product amount missing"
              }
            >
              <Text style={styles.amountPresetText}>
                {hasServingAmount
                  ? `1× serving (${formatNumber(servingAmount)}${measurementUnit})`
                  : "1× serving (unavailable)"}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.amountPresetButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() => setConsumedAmount("100")}
              accessibilityRole="button"
              accessibilityLabel={`Use 100${measurementUnit}`}
            >
              <Text style={styles.amountPresetText}>
                100{measurementUnit}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.amountPresetButton,
                styles.quantityPresetButton,
                !hasServingAmount && styles.amountPresetDisabled,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() => setShowQuantityPicker((current) => !current)}
              disabled={!hasServingAmount}
              accessibilityRole="button"
              accessibilityLabel="Choose quantity from 1 to 50 servings"
              accessibilityState={{
                disabled: !hasServingAmount,
                expanded: showQuantityPicker,
              }}
            >
              <AppIcon name="options-outline" size={20} color="#222" />
              <Text style={styles.amountPresetText}></Text>
            </Pressable>
          </View>

          {showQuantityPicker && hasServingAmount && (
            <View style={styles.quantityPicker}>
              <Text style={styles.quantityPickerLabel}>
                Swipe to choose servings (1–50)
              </Text>
              <Text style={styles.inputHelpText}>
                1 serving = {formatNumber(servingAmount)}{measurementUnit}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.quantityOptions}
              >
                {Array.from({ length: 50 }, (_, index) => {
                  const quantity = index + 1;
                  // Avoid floating-point tails such as 0.1 × 3 = 0.30000000000000004.
                  const totalAmount = Number(
                    (servingAmount * quantity).toPrecision(15)
                  );
                  const isSelected = toNumber(consumedAmount) === totalAmount;

                  return (
                    <Pressable
                      key={quantity}
                      style={({ pressed }) => [
                        styles.quantityOption,
                        isSelected && styles.quantityOptionSelected,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                      onPress={() => setConsumedAmount(String(totalAmount))}
                      accessibilityRole="button"
                      accessibilityLabel={
                        `${quantity} ${quantity === 1 ? "serving" : "servings"}, ` +
                        `${formatNumber(totalAmount)}${measurementUnit}`
                      }
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.amountPresetText,
                          isSelected && styles.quantityOptionTextSelected,
                        ]}
                      >
                        {quantity}×
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.amountRow}>
            <View style={styles.amountInputContainer}>
              <TextInput
                style={styles.input}
                value={consumedAmount}
                onChangeText={setConsumedAmount}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.unitContainer}>
              <Text style={styles.unitText}>
                {measurementUnit}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginVertical: 16 }}>
          <MealPeriodSelector value={log.pending?.input.mealPeriod ?? mealPeriod} onChange={setMealPeriod} disabled={log.saving || log.checking || !!log.pending} />
        </View>
        <Text style={styles.sectionTitle}>
          Consumption date
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.dateButton,
            pressed && styles.dateButtonPressed,
          ]}
          onPress={() => setShowDatePicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose consumption date"
        >
          <View style={styles.dateIconContainer}>
            <AppIcon
              name="calendar-outline"
              size={20}
              color="#222"
            />
          </View>

          <View style={styles.dateContent}>
            <Text style={styles.dateLabel}>
              Date consumed
            </Text>

            <Text style={styles.dateValue}>
              {formattedDate}
            </Text>
          </View>

          <AppIcon
            name="chevron-forward"
            size={19}
            color="#999"
          />
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={consumedAt}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            maximumDate={new Date()}
            onValueChange={handleDateChange}
            onDismiss={() => setShowDatePicker(false)}
          />
        )}

        <Text style={styles.sectionTitle}>
          Pantry
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.checkboxRow,
            pressed && styles.checkboxRowPressed,
          ]}
          onPress={() =>
            setRemoveFromPantry((current) => !current)
          }
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: removeFromPantry,
          }}
        >
          <View
            style={[
              styles.checkbox,
              removeFromPantry && styles.checkboxChecked,
            ]}
          >
            {removeFromPantry && (
              <AppIcon
                name="checkmark"
                size={17}
                color="#fff"
              />
            )}
          </View>

          <View style={styles.checkboxContent}>
            <Text style={styles.checkboxLabel}>
              Remove this amount from my pantry
            </Text>

            <Text style={styles.checkboxDescription}>
              FoodWorth will reduce the matching
              product's remaining pantry amount.
            </Text>
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>
          Nutrition consumed
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            Consumption summary
          </Text>

          <View style={styles.summaryGrid}>
            <SummaryItem
              label="Calories"
              value={`${Math.round(
                consumedNutrition.calories
              )} kcal`}
            />

            <SummaryItem
              label="Protein"
              value={`${formatNutrient(
                consumedNutrition.protein
              )} g`}
            />

            <SummaryItem
              label="Carbs"
              value={`${formatNutrient(
                consumedNutrition.carbs
              )} g`}
            />

            <SummaryItem
              label="Fat"
              value={`${formatNutrient(
                consumedNutrition.fat
              )} g`}
            />

            <SummaryItem
              label="Sugars"
              value={`${formatNutrient(
                consumedNutrition.sugars
              )} g`}
            />

            <SummaryItem
              label="Fibre"
              value={`${formatNutrient(
                consumedNutrition.fibre
              )} g`}
            />

            <SummaryItem
              label="Salt"
              value={`${formatNutrient(
                consumedNutrition.salt
              )} g`}
            />
          </View>
        </View>

        </View>
        {log.pending && <Text style={styles.inputHelpText}>
          A previous log for {log.pending.input.consumedOn} needs confirmation. Retry uses its original amount and pantry choice.
        </Text>}
        {!!log.error && <Text>{log.error}</Text>}
        {!!log.storageError && <Pressable onPress={log.refresh}><Text>{log.storageError} Tap to check again.</Text></Pressable>}
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
          onPress={handleLogConsumption}
          disabled={log.saving || log.checking || !!log.storageError || (isEditingProduct && !log.pending)}
        >
          <AppIcon
            name="checkmark-circle-outline"
            size={23}
            color="#fff"
          />

          <Text style={styles.primaryButtonText}>
            {log.saving ? "Logging…" : log.checking ? "Checking…" : log.pending ? "Retry previous log" : "Log Food"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

type SummaryItemProps = {
  label: string;
  value: string;
};

function SummaryItem({
  label,
  value,
}: SummaryItemProps) {
  return <NutritionTile label={label} value={value} />;
}

function formatNutrient(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export default ProductConsumeScreen;
