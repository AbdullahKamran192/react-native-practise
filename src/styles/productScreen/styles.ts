import { StyleSheet } from "react-native";

/*
 * Shared styles for the productPantry and
 * productConsume screens.
 *
 * Keeping the complete product-screen visual system
 * here prevents both routes from maintaining large,
 * nearly identical StyleSheet objects.
 */
export const productScreenStyles = StyleSheet.create({
  /* Screen layout */
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  centeredContainer: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    color: "#777",
    fontSize: 14,
    marginTop: 14,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  headerContent: {
    flex: 1,
    paddingRight: 16,
  },

  headerLabel: {
    color: "#777",
    fontSize: 14,
    marginBottom: 4,
  },

  title: {
    color: "#222",
    fontSize: 26,
    fontWeight: "700",
  },

  subtitle: {
    color: "#777",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EDEDED",
    justifyContent: "center",
    alignItems: "center",
  },

  /* Lookup notices */
  manualEntryNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFF3D6",
    borderWidth: 1,
    borderColor: "#ECD09C",
    borderRadius: 16,
    padding: 15,
    marginBottom: 18,
  },

  errorNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#F1B8B8",
    borderRadius: 16,
    padding: 15,
    marginBottom: 18,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    color: "#4F350B",
    fontSize: 15,
    fontWeight: "700",
  },

  noticeText: {
    color: "#7A5413",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  genericProductNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#EDF7EF",
    borderWidth: 1,
    borderColor: "#C9DFCD",
    borderRadius: 16,
    padding: 15,
    marginBottom: 18,
  },

  genericProductNoticeTitle: {
    color: "#294A32",
    fontSize: 15,
    fontWeight: "700",
  },

  genericProductNoticeText: {
    color: "#4E6F57",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  errorNoticeTitle: {
    color: "#7B1D1D",
    fontSize: 15,
    fontWeight: "700",
  },

  errorNoticeText: {
    color: "#9B3030",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  /* Shared sections and cards */
  section: {
    marginTop: 28,
  },

  sectionTitle: {
    color: "#222",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 14,
  },

  sectionDescription: {
    color: "#777",
    fontSize: 13,
    lineHeight: 19,
    marginTop: -7,
    marginBottom: 14,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
  },

  cardWithBorder: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 18,
    padding: 18,
  },

  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  divider: {
    height: 1,
    backgroundColor: "#ECECEC",
    marginVertical: 16,
  },

  /* Compact read-only product dashboard */
  compactProductCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 18,
    padding: 16,
  },

  compactProductHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  compactProductHeading: {
    flex: 1,
  },

  compactProductName: {
    color: "#222",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 23,
  },

  compactProductBrand: {
    color: "#777",
    fontSize: 13,
    marginTop: 4,
  },

  editProductButton: {
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EFEFEF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 11,
  },

  editProductButtonPressed: {
    opacity: 0.65,
  },

  editProductButtonText: {
    color: "#222",
    fontSize: 13,
    fontWeight: "700",
  },

  compactAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },

  compactAmountLabel: {
    color: "#777",
    fontSize: 13,
  },

  compactAmountValue: {
    color: "#222",
    fontSize: 13,
    fontWeight: "700",
  },

  compactDivider: {
    height: 1,
    backgroundColor: "#ECECEC",
    marginVertical: 14,
  },

  compactNutritionHeading: {
    color: "#555",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 11,
  },

  compactNutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
  },

  compactNutritionItem: {
    width: "50%",
    paddingRight: 8,
  },

  compactNutritionLabel: {
    color: "#888",
    fontSize: 11,
    marginBottom: 3,
  },

  compactNutritionValue: {
    color: "#222",
    fontSize: 14,
    fontWeight: "700",
  },

  compactMissingValue: {
    color: "#A0A0A0",
    fontSize: 13,
    fontStyle: "italic",
  },

  /* Labels and inputs */
  fieldGroup: {
    marginBottom: 16,
  },

  fieldGroupLast: {
    marginBottom: 0,
  },

  fieldLabel: {
    color: "#555",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 9,
  },

  priceCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
  },

  priceLabel: {
    color: "#666",
    fontSize: 14,
    marginBottom: 12,
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },

  inputContainerFocused: {
    borderColor: "#888",
  },

  inputContainerError: {
    borderColor: "#C83E3E",
  },

  currencySymbol: {
    color: "#222",
    fontSize: 20,
    fontWeight: "700",
    marginRight: 8,
  },

  input: {
    flex: 1,
    height: "100%",
    color: "#222",
    fontSize: 18,
  },

  inputSuffix: {
    color: "#777",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },

  inputHelpText: {
    color: "#777",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },

  inputErrorText: {
    color: "#B72D2D",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },

  /* Consume amount and measurement unit */
  amountPresetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },

  amountPresetButton: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    borderRadius: 12,
    backgroundColor: "#E7E7E7",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  amountPresetText: {
    color: "#222",
    fontSize: 14,
    fontWeight: "600",
  },

  quantityPresetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  quantityPicker: {
    marginBottom: 14,
  },

  quantityPickerLabel: {
    color: "#222",
    fontSize: 14,
    fontWeight: "600",
  },

  quantityOptions: {
    gap: 8,
    paddingTop: 10,
    paddingBottom: 8,
  },

  quantityOption: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D4D4D4",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  quantityOptionSelected: {
    backgroundColor: "#222",
    borderColor: "#222",
  },

  quantityOptionTextSelected: {
    color: "#fff",
  },

  amountPresetDisabled: {
    opacity: 0.45,
  },


  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  amountInputContainer: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },

  unitContainer: {
    minWidth: 82,
    height: 52,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "#F3F3F3",
  },

  unitText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "700",
  },

  /* Consumption date */
  dateButton: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },

  dateButtonPressed: {
    opacity: 0.7,
  },

  dateIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    marginRight: 12,
  },

  dateContent: {
    flex: 1,
  },

  dateLabel: {
    color: "#777",
    fontSize: 12,
    marginBottom: 2,
  },

  dateValue: {
    color: "#222",
    fontSize: 15,
    fontWeight: "700",
  },

  /* Remove-from-pantry option */
  checkboxRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },

  checkboxRowPressed: {
    opacity: 0.75,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#A0A0A0",
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "#fff",
  },

  checkboxChecked: {
    borderColor: "#222",
    backgroundColor: "#222",
  },

  checkboxContent: {
    flex: 1,
  },

  checkboxLabel: {
    color: "#222",
    fontSize: 15,
    fontWeight: "600",
  },

  checkboxDescription: {
    color: "#777",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  /* Nutrition summary used when consuming */
  summaryCard: {
    backgroundColor: "#222",
    borderRadius: 18,
    padding: 18,
  },

  summaryTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 15,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
  },

  summaryItem: {
    width: "50%",
  },

  summaryLabel: {
    color: "#BDBDBD",
    fontSize: 12,
    marginBottom: 4,
  },

  summaryValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  /* Buttons */
  calculateButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#E7E7E7",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },

  calculateButtonPressed: {
    opacity: 0.7,
  },

  calculateButtonText: {
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#E7E7E7",
    borderWidth: 1,
    borderColor: "#D4D4D4",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },

  secondaryButtonPressed: {
    opacity: 0.7,
  },

  secondaryButtonText: {
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
  },

  addButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
  },

  addButtonPressed: {
    opacity: 0.7,
  },

  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  primaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#222",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
  },

  primaryButtonPressed: {
    opacity: 0.7,
  },

  primaryButtonDisabled: {
    opacity: 0.55,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default productScreenStyles;
