import { foodMatchTier } from "./foodMatch";
import type { PantryItem } from "@/api/products";
import type { MealItem } from "@/api/meals";

const ignored = new Set("tesco asda aldi lidl sainsburys sainsbury morrisons waitrose ocado quaker organic premium original essential essentials finest extra value family pack fresh food foods with and the of in a an no added free whole product brand selected simply own ready made style".split(" "));
function words(name: string) {
  return new Set(name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter(word => word.length > 2 && !/\d/.test(word) && !ignored.has(word)));
}
export function replacementCandidates(item: MealItem, items: MealItem[], pantry: PantryItem[]) {
  const equivalent: PantryItem[] = [], compatible: PantryItem[] = [], sameGroup: PantryItem[] = [], similar: PantryItem[] = [];
  const original = item.product ?? item.generic_product;
  if ((!item.product_barcode && item.generic_product_id == null) || !original) return { equivalent, compatible, sameGroup, similar };
  const key = (row: { product_barcode: string | null; generic_product_id: number | null }) => row.product_barcode ? `barcode:${row.product_barcode}` : `generic:${row.generic_product_id}`;
  const used = new Set(items.map(key));
  const seen = new Set<string>();
  const originalWords = words(original.product_name ?? "");
  const link = item.generic_product_id ?? item.product?.generic_product_id;
  const classification = item.generic_product ?? item.product?.generic_product;
  for (const row of pantry) {
    const product = row.product ?? row.generic_product;
    const candidateClassification = row.generic_product ?? row.product?.generic_product;
    const candidateLink = row.generic_product_id ?? row.product?.generic_product_id;
    if (!product || (!row.product_barcode && row.generic_product_id == null) || used.has(key(row)) || seen.has(key(row)) || candidateClassification?.is_active === false ||
      !Number.isFinite(Number(row.amount_remaining)) || Number(row.amount_remaining) <= 0 ||
      product.measurement_unit !== original.measurement_unit) continue;
    seen.add(key(row));
    const tier = foodMatchTier(link, classification, candidateLink, candidateClassification);
    if (tier === "exact_generic") equivalent.push(row);
    else if (tier === "same_family") compatible.push(row);
    else if ([...words(product.product_name ?? "")].some(word => originalWords.has(word))) similar.push(row);
    else if (tier === "same_group") sameGroup.push(row);
  }
  const sort = (a: PantryItem, b: PantryItem) => ((a.product ?? a.generic_product)?.product_name ?? "").localeCompare((b.product ?? b.generic_product)?.product_name ?? "") || a.id - b.id;
  return { equivalent: equivalent.sort(sort), compatible: compatible.sort(sort), sameGroup: sameGroup.sort(sort), similar: similar.sort(sort) };
}
