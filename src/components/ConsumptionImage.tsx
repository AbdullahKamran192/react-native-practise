import { useQuery } from "@tanstack/react-query";
import { mealImageRequest } from "@/api/meals/images";
import type { HistoryRow } from "@/utils/consumptionHistory";
import { genericProductImageUrl, barcodeProductImageUrl } from "@/utils/productImage";
import ProductImage from "@/components/products/ProductImage";

export default function ConsumptionImage({ row, thumbnail = false, ingredient = false }: {
  row: HistoryRow; thumbnail?: boolean; ingredient?: boolean;
}) {

  const isMeal = !ingredient && row.meal_name_snapshot !== null;
  const meal = isMeal ? row.meal : null;
  const query = useQuery({
    queryKey: ["meal-photo", meal?.user_id, String(meal?.id), meal?.image_path],
    queryFn: () => mealImageRequest("view", String(meal!.id)),
    enabled: !!meal?.image_path,
    staleTime: 600000, refetchInterval: 600000, gcTime: 0,
    retry: false,
  });
  const uri = isMeal ? (meal?.image_path ? query.data?.url : genericProductImageUrl(meal?.public_image_path))
    : row.generic_product ? genericProductImageUrl(row.generic_product.image_path) : barcodeProductImageUrl(row.product);
  return <ProductImage uri={uri} name={isMeal ? row.meal_name_snapshot! : row.product_name_snapshot} thumbnail={thumbnail} privateImage={isMeal} />;
}
