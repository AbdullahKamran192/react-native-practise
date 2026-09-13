import type {
  MeasurementUnit,
} from "@/api/products";

/*
 * Both database tables are converted into this
 * common structure before reaching the search page.
 *
 * For barcode products, id is the barcode number.
 * For generic products, id is the generated database ID.
 */
export type ProductSearchResult = {
  image_url: string | null;
  id: string;
  source: "barcode" | "generic";
  product_name: string;
  product_amount: number | null;
  measurement_unit: MeasurementUnit;
};
