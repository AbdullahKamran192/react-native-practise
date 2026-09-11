import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
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

  const [consumedAt, setConsumedAt] =
    useState(new Date());

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [removeFromPantry, setRemoveFromPantry] =
    useState(true);

  const [isEditingProduct, setIsEditingProduct] =
    useState(false);

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

  function handleDateChange(
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (
      event.type === "set" &&
      selectedDate
    ) {
      setConsumedAt(selectedDate);
    }
  }

  function handleLogConsumption() {
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

    /*
     * The screen is ready, but consumption must not
     * be presented as saved until the Supabase
     * consumption table and atomic pantry-reduction
     * transaction have been defined.
     */
    Alert.alert(
      "Consumption saving not connected",
      "The product and amount are valid. The next step is connecting this screen to the consumption database operation."
    );
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

          <View style={styles.scanIcon}>
            <Ionicons
              name={
                isGenericProduct
                  ? "nutrition-outline"
                  : "barcode-outline"
              }
              size={24}
              color="#222"
            />
          </View>
        </View>

        {lookupStatus === "not-found" && (
          <View style={styles.manualEntryNotice}>
            <Ionicons
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
            <Ionicons
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

        {isGenericProduct && (
          <View style={styles.genericProductNotice}>
            <Ionicons
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
              <Ionicons
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
            <Ionicons
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

          <Ionicons
            name="chevron-forward"
            size={19}
            color="#999"
          />
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={consumedAt}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={handleDateChange}
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
              <Ionicons
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

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
          onPress={handleLogConsumption}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={23}
            color="#fff"
          />

          <Text style={styles.primaryButtonText}>
            Log Food
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
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>
        {label}
      </Text>

      <Text style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

function formatNutrient(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export default ProductConsumeScreen;
