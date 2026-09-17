import type { PantryItem } from "@/api/products";
import type { MealItem } from "@/api/meals";

const ignored = new Set("tesco asda aldi lidl sainsburys sainsbury morrisons waitrose ocado quaker organic premium original essential essentials finest extra value family pack fresh food foods with and the of in a an no added free whole product brand selected simply own ready made style".split(" "));
function words(name: string) {
  return new Set(name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter(word => word.length > 2 && !/\d/.test(word) && !ignored.has(word)));
}
export function replacementCandidates(item: MealItem, items: MealItem[], pantry: PantryItem[]) {
  const equivalent: PantryItem[] = [], similar: PantryItem[] = [];
  if (!item.product_barcode || !item.product) return { equivalent, similar };
  const used = new Set(items.map(row => row.product_barcode).filter(Boolean));
  const originalWords = words(item.product.product_name ?? "");
  const link = item.product.generic_product_id;
  for (const row of pantry) {
    if (!row.product_barcode || !row.product || used.has(row.product_barcode) ||
      !Number.isFinite(Number(row.amount_remaining)) || Number(row.amount_remaining) <= 0 ||
      row.product.measurement_unit !== item.product.measurement_unit) continue;
    if (link != null && row.product.generic_product_id != null && String(link) === String(row.product.generic_product_id)) equivalent.push(row);
    else if ([...words(row.product.product_name ?? "")].some(word => originalWords.has(word))) similar.push(row);
  }
  const sort = (a: PantryItem, b: PantryItem) => (a.product?.product_name ?? "").localeCompare(b.product?.product_name ?? "") || a.id - b.id;
  return { equivalent: equivalent.sort(sort), similar: similar.sort(sort) };
}
