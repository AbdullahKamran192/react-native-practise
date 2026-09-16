import { supabase } from "@/lib/supabase";
import { genericProductImageUrl, barcodeProductImageUrl } from "@/utils/productImage";

import type {
  ProductSearchResult,
} from "./types";

type BarcodeProductSearchRow = {
  image_path: string | null;
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
export const SEARCH_PAGE_SIZE = 50;
export type ProductSearchPage = { items: ProductSearchResult[]; total: number };

export async function searchProducts(searchText: string, page = 0): Promise<ProductSearchPage> {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error("Invalid search page.");
  const cleanedSearch = searchText.trim();
  if (!cleanedSearch) return { items: [], total: 0 };
  const offset = page * SEARCH_PAGE_SIZE;

  // Preserve packaged-first ordering. Fetch only this page, never the catalogue.
  // The count locates the boundary between the two catalogues without loading rows.
  const barcodeResponse = await supabase.from("products")
    .select("barcode_number,image_path,image_url,product_name,product_amount,measurement_unit", { count: "exact" })
    .ilike("product_name", `%${cleanedSearch}%`)
    .order("product_name", { ascending: true })
    .order("barcode_number", { ascending: true })
    .range(offset, offset + SEARCH_PAGE_SIZE - 1);
  if (barcodeResponse.error) throw new Error(barcodeResponse.error.message);

  const barcodeCount = barcodeResponse.count ?? 0;
  const remaining = SEARCH_PAGE_SIZE - (barcodeResponse.data?.length ?? 0);
  const genericOffset = Math.max(0, offset - barcodeCount);
  let genericQuery = supabase.from("generic_products")
    .select("id,image_path,product_name,default_amount,measurement_unit", { count: "exact", head: remaining === 0 })
    .ilike("product_name", `%${cleanedSearch}%`)
    .order("product_name", { ascending: true })
    .order("id", { ascending: true });
  if (remaining > 0) genericQuery = genericQuery.range(genericOffset, genericOffset + remaining - 1);
  const genericResponse = await genericQuery;
  if (genericResponse.error) throw new Error(genericResponse.error.message);

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
      image_url: barcodeProductImageUrl(product),
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
  return { items: [...barcodeResults, ...genericResults], total: barcodeCount + (genericResponse.count ?? 0) };
}
