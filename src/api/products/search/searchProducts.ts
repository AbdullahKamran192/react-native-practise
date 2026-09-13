import { supabase } from "@/lib/supabase";
import { genericProductImageUrl } from "@/utils/productImage";

import type {
  ProductSearchResult,
} from "./types";

type BarcodeProductSearchRow = {
  image_url: string | null;
  barcode_number: string;
  product_name: string | null;
  product_amount: number | null;
  measurement_unit: "g" | "ml";
};

type GenericProductSearchRow = {
  image_path: string | null;
  id: number;
  product_name: string;
  default_amount: number;
  measurement_unit: "g" | "ml";
};

/*
 * Searches both the barcode catalogue and the
 * generic-products catalogue.
 *
 * Only fields required by the search screen are
 * selected. Full product information will be loaded
 * after the user chooses a result.
 */
export async function searchProducts(
  searchText: string
): Promise<ProductSearchResult[]> {
  const cleanedSearch = searchText.trim();

  if (!cleanedSearch) {
    return [];
  }

  /*
   * Both independent searches run at the same time.
   */
  const [
    barcodeResponse,
    genericResponse,
  ] = await Promise.all([
    supabase
      .from("products")
      .select(`
        barcode_number,
        image_url,
        product_name,
        product_amount,
        measurement_unit
      `)
      .ilike(
        "product_name",
        `%${cleanedSearch}%`
      )
      .order("product_name", {
        ascending: true,
      })
      .limit(20),

    supabase
      .from("generic_products")
      .select(`
        id,
        image_path,
        product_name,
        default_amount,
        measurement_unit
      `)
      .ilike(
        "product_name",
        `%${cleanedSearch}%`
      )
      .order("product_name", {
        ascending: true,
      })
      .limit(20),
  ]);

  if (barcodeResponse.error) {
    throw new Error(
      barcodeResponse.error.message
    );
  }

  if (genericResponse.error) {
    throw new Error(
      genericResponse.error.message
    );
  }

  const barcodeProducts =
    (barcodeResponse.data ??
      []) as BarcodeProductSearchRow[];

  const genericProducts =
    (genericResponse.data ??
      []) as GenericProductSearchRow[];

  /*
   * Convert barcode products into the shared
   * ProductSearchResult structure.
   */
  const barcodeResults:
    ProductSearchResult[] =
    barcodeProducts.map((product) => ({
      id: product.barcode_number,
      source: "barcode",
      image_url: product.image_url ?? null,
      product_name:
        product.product_name ??
        "Unknown product",
      product_amount:
        product.product_amount,
      measurement_unit:
        product.measurement_unit,
    }));

  /*
   * Convert generic products into the same structure.
   *
   * default_amount represents the average amount of
   * one generic item, such as one 150g apple.
   */
  const genericResults:
    ProductSearchResult[] =
    genericProducts.map((product) => ({
      id: String(product.id),
      source: "generic",
      image_url: genericProductImageUrl(product.image_path),
      product_name: product.product_name,
      product_amount:
        product.default_amount,
      measurement_unit:
        product.measurement_unit,
    }));

  /*
   * Put packaged products first because they will
   * probably make up most searches, followed by
   * generic food results.
   */
  return [
    ...barcodeResults,
    ...genericResults,
  ];
}
