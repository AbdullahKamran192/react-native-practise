import { supabase } from "@/lib/supabase";
import { genericProductImageUrl, barcodeProductImageUrl } from "@/utils/productImage";
import type { ProductSearchResult } from "./types";

export const SEARCH_PAGE_SIZE = 50;
export type ProductSearchPage = { items: ProductSearchResult[]; hasNext: boolean };
type SearchRow = {
 id: string; source: "barcode" | "generic"; product_name: string | null;
 image_path: string | null; image_url: string | null;
 product_amount: number | null; measurement_unit: "g" | "ml";
};

export async function searchProducts(searchText: string, page = 0): Promise<ProductSearchPage> {
 if (!Number.isSafeInteger(page) || page < 0 || page > 2147483647) throw new Error("Invalid search page.");
 const cleanedSearch = searchText.trim();
 if (!cleanedSearch) return { items: [], hasNext: false };
 const { data, error } = await supabase.rpc("search_food_products", { p_search: cleanedSearch, p_page: page });
 if (error) throw new Error(error.code === "PGRST202"
  ? "Search needs the new Supabase search migration. Please run 20260917_product_search.sql."
  : error.message);
 const rows = (data ?? []) as SearchRow[];
 return {
  hasNext: rows.length > SEARCH_PAGE_SIZE,
  items: rows.slice(0, SEARCH_PAGE_SIZE).map(product => ({
   id: String(product.id), source: product.source,
   product_name: product.product_name ?? "Unknown product",
   product_amount: product.product_amount, measurement_unit: product.measurement_unit,
   image_url: product.source === "generic" ? genericProductImageUrl(product.image_path) : barcodeProductImageUrl(product),
  })),
 };
}
