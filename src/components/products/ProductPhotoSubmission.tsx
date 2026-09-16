import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import type { LookupProduct } from "@/api/products/productLookup";
import { saveBarcodeProduct } from "@/api/products";
import { createProductSubmission } from "@/utils/productSubmission";
import { barcodeProductImageUrl } from "@/utils/productImage";
import { chooseMealPhoto, readMealPhoto } from "@/utils/mealPhoto";
import { productImageRequest, rejectionReasons } from "@/api/products/images";
import type { OwnProductImage } from "@/api/products/images";
import ProductImage from "./ProductImage";
import { MealButton, mealStyles as s } from "@/components/meals/ui";

export default function ProductPhotoSubmission({barcode,product,disabled=false}:{barcode:string;product:LookupProduct;disabled?:boolean}) {
 const client=useQueryClient();
 const [draft,setDraft]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const lock=useRef(false);
 const query=useQuery({queryKey:["product-photo",barcode],queryFn:()=>productImageRequest<OwnProductImage>("own-status",{barcode}),retry:false,refetchInterval:60000,staleTime:0,gcTime:0});
 useFocusEffect(useCallback(()=>{void query.refetch();},[query.refetch]));
 const state=query.data;
 const shared=barcodeProductImageUrl(state?.shared) ?? product.image_url;
 const pending=state?.status==="pending";
 const allowed=!!state && !state.blocked && !pending && !shared;
 async function choose(camera:boolean) {
  if(lock.current)return; lock.current=true;setBusy(true);setError(null);
  try {const uri=await chooseMealPhoto(camera,"product");if(uri)setDraft(uri);}catch(e){setError(e instanceof Error?e.message:"Could not open photo.");}
  finally{lock.current=false;setBusy(false);}
 }
 async function submit() {
  if(!draft||lock.current||!allowed)return; lock.current=true;setBusy(true);setError(null);
  try {
   const bytes=await readMealPhoto(draft);
   const submission=createProductSubmission(barcode,product);
   if(!submission.success)throw new Error(submission.error);
   if(!submission.data.product_name)throw new Error("Enter a product name before submitting its photo.");
   await saveBarcodeProduct(submission.data);
   await productImageRequest("upload",{barcode},bytes);
   setDraft(null);
   await client.invalidateQueries({queryKey:["product-photo",barcode]});
  }catch(e){setError(e instanceof Error?e.message:"Could not submit photo.");void query.refetch();}
  finally{lock.current=false;setBusy(false);}
 }
 return <View>
  <ProductImage uri={pending?state?.url:shared} name={product.product_name} privateImage={pending}/>
  {pending&&<Text style={s.muted}>Awaiting review. This photo is visible only to you and administrators.</Text>}
  {state?.status==="rejected"&&<Text style={s.muted}>Your photo was not approved: {state.reason?rejectionReasons[state.reason]:"Please choose a different photo"}.</Text>}
  {state?.blocked&&<Text style={s.error}>Product photo uploads are blocked after repeated offensive or abusive submissions. Other FoodWorth features remain available.</Text>}
  {allowed&&<View style={s.card}>
   <Text style={s.heading}>Product photo (optional)</Text>
   <Text style={s.muted}>Upload a clear photo of the front of the product. Do not include people or personal information.</Text>
   {draft&&<Image source={{uri:draft}} style={{width:"100%",height:180}} contentFit="contain" accessibilityLabel="Product photo preview"/>}
   <View style={s.row}>
    <MealButton secondary disabled={busy||disabled} title="Choose photo" onPress={()=>void choose(false)}/>
    <MealButton secondary disabled={busy||disabled} title="Take photo" onPress={()=>void choose(true)}/>
   </View>
   {draft&&<View style={s.row}><MealButton disabled={busy||disabled} title={busy?"Submitting...":"Submit photo for review"} onPress={()=>void submit()}/><MealButton secondary disabled={busy||disabled} title="Cancel" onPress={()=>setDraft(null)}/></View>}
  </View>}
  {(error||query.error)&&<Text style={s.error}>{error??query.error?.message}</Text>}
  {query.error&&<MealButton secondary title="Retry photo status" onPress={()=>void query.refetch()}/>}
 </View>;
}
