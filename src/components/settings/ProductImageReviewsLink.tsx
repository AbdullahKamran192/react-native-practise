import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { productImageRequest } from "@/api/products/images";
import { MealButton } from "@/components/meals/ui";
export default function ProductImageReviewsLink(){
 const query=useQuery({queryKey:["product-image-admin"],queryFn:()=>productImageRequest<{isAdmin:boolean}>("admin-status"),retry:false});
 useFocusEffect(useCallback(()=>{void query.refetch();},[query.refetch]));
 return query.data?.isAdmin ? <MealButton secondary title="Product image reviews" onPress={()=>router.push("/admin/productImages")}/> : null;
}
