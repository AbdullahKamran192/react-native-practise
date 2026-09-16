import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { productImageRequest,rejectionReasons } from "@/api/products/images";
import type { PendingProductImage,RejectionReason } from "@/api/products/images";
import ProductImage from "@/components/products/ProductImage";
import { MealButton,MealStatus,mealStyles as s } from "@/components/meals/ui";

export default function ProductImageReviews(){
 const client=useQueryClient();
 const admin=useQuery({queryKey:["product-image-admin"],queryFn:()=>productImageRequest<{isAdmin:boolean}>("admin-status"),retry:false});
 const list=useQuery({queryKey:["product-image-pending"],queryFn:()=>productImageRequest<{items:PendingProductImage[];count:number}>("list-pending"),enabled:!!admin.data?.isAdmin,retry:false,refetchInterval:240000,gcTime:0});
 const [rejecting,setRejecting]=useState<PendingProductImage|null>(null);
 const [reason,setReason]=useState<RejectionReason|null>(null);
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const [error,setError]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 useFocusEffect(useCallback(()=>{void admin.refetch();if(admin.data?.isAdmin)void list.refetch();},[admin.refetch,admin.data?.isAdmin,list.refetch]));
 useEffect(()=>{if(admin.data?.isAdmin===false){const timer=setTimeout(()=>router.replace("/settings"),1500);return()=>clearTimeout(timer);}},[admin.data?.isAdmin]);
 async function review(item:PendingProductImage,action:"approve"|"reject"){
  if(lock.current || (action==="reject"&&!reason))return;
  lock.current=true;setBusy(true);setError(null);setNotice("");
  try{
   await productImageRequest(action,{barcode:item.product_barcode,userId:item.user_id,submittedAt:item.image_submitted_at,...(action==="reject"?{reason:reason!}:{})});
   await Promise.all(["product-photo","product-search","products","pantry","food-consumption"].map(key=>client.invalidateQueries({queryKey:[key]})));
   setRejecting(null);setReason(null);setNotice(action==="approve"?"Image approved":"Image rejected");
  }catch(e){setError(e instanceof Error?e.message:"Could not review image.");}
  finally{await list.refetch();lock.current=false;setBusy(false);}
 }
 if(admin.isPending)return <MealStatus loading/>;
 if(admin.error)return <MealStatus error={admin.error.message} retry={()=>void admin.refetch()}/>;
 if(!admin.data?.isAdmin)return <MealStatus error="Not authorised. Returning to Settings."/>;
 return <SafeAreaView style={s.screen} edges={["left","right","bottom"]}>
  <FlatList data={list.data?.items??[]} keyExtractor={item=>item.user_id+":"+item.product_barcode}
   contentContainerStyle={s.content} refreshing={list.isRefetching} onRefresh={()=>void list.refetch()}
   ListHeaderComponent={<View style={{gap:10}}>
    <Text style={s.title}>Product image reviews</Text>
    <Text style={s.muted}>{list.data?.count??0} awaiting review</Text>
    {!!notice&&<Text accessibilityLiveRegion="polite" style={s.text}>{notice}</Text>}
    {error&&<Text style={s.error}>{error}</Text>}
    {list.error&&<><Text style={s.error}>{list.error.message}</Text><MealButton secondary title="Retry" onPress={()=>void list.refetch()}/></>}
    {busy&&<ActivityIndicator/>}
   </View>}
   ListEmptyComponent={list.isPending?<ActivityIndicator/>:!list.error?<Text style={s.muted}>No photos awaiting review.</Text>:null}
   renderItem={({item})=><View style={s.card}>
    <ProductImage uri={item.url} name={item.product_name??"Product"} privateImage/>
    <Text style={s.heading}>{item.product_name??"Unnamed product"}</Text>
    <Text style={s.text}>Barcode: {item.product_barcode}</Text>
    <Text style={s.muted}>Submitted: {new Date(item.image_submitted_at).toLocaleDateString("en-GB")}</Text>
    <View style={s.row}>
     <MealButton secondary disabled={busy} title="Reject" onPress={()=>{setRejecting(item);setReason(null);setError(null);}}/>
     <MealButton disabled={busy} title="Approve" onPress={()=>void review(item,"approve")}/>
    </View>
   </View>}/>
  <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={()=>{if(!busy)setRejecting(null);}}>
   <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.45)",justifyContent:"center",padding:20}}>
    <View style={s.card} accessibilityViewIsModal>
     <Text style={s.heading}>Why are you rejecting this image?</Text>
     {(Object.keys(rejectionReasons) as RejectionReason[]).map(value=><Pressable key={value} disabled={busy} onPress={()=>setReason(value)}
       accessibilityRole="radio" accessibilityLabel={rejectionReasons[value]} accessibilityState={{checked:reason===value,disabled:busy}} style={{paddingVertical:10,flexDirection:"row",alignItems:"center",gap:10}}>
       <Ionicons name={reason===value?"radio-button-on":"radio-button-off"} size={22} color="#222" />
       <Text style={s.text}>{rejectionReasons[value]}</Text>
      </Pressable>)}
     {(reason==="offensive"||reason==="abusive")&&<Text style={s.error}>This adds one violation. Three violations block further product photo submissions.</Text>}
     {error&&<Text style={s.error}>{error}</Text>}
     <View style={s.row}><MealButton secondary disabled={busy} title="Cancel" onPress={()=>setRejecting(null)}/><MealButton disabled={busy||!reason} title={busy?"Rejecting...":"Reject image"} onPress={()=>rejecting&&void review(rejecting,"reject")}/></View>
    </View>
   </View>
  </Modal>
 </SafeAreaView>;
}
