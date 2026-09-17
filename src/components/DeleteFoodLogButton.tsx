import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/brand/AppIcon";
import { useQueryClient } from "@tanstack/react-query";
import { removeConsumption } from "@/api/consumption/remove";
import type { HistoryRow } from "@/utils/consumptionHistory";

export default function DeleteFoodLogButton({groupId,name}:{groupId:string;name:string}) {
  const client=useQueryClient();
  const [open,setOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const lock=useRef(false);
  async function remove(){
    if(lock.current)return;
    lock.current=true;setSaving(true);setError("");
    try{
      await removeConsumption(groupId);
      await client.cancelQueries({queryKey:["food-consumption","history"]});
      client.setQueriesData<HistoryRow[]>({queryKey:["food-consumption","history"]},
        rows=>rows?.filter(row=>row.consumption_group_id!==groupId));
      void client.invalidateQueries({queryKey:["food-consumption"]});
      setOpen(false);
    }catch(e){
      setError(e instanceof Error?e.message:"Could not delete this entry.");
    }finally{lock.current=false;setSaving(false);}
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={"Delete "+name}
      onPress={()=>{setError("");setOpen(true);}} style={s.bin}>
      <AppIcon name="trash-outline" size={23} color="#B63D3D"/>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>{if(!saving)setOpen(false);}}>
      <View style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal>
        <Text style={s.title}>Delete {name}?</Text>
        <Text style={s.description}>Permanently remove this entry and its nutrition from your consumption history? Pantry stock will stay unchanged.</Text>
        {!!error&&<Text style={s.error}>{error}</Text>}
        <View style={s.buttons}>
          <Pressable disabled={saving} onPress={()=>setOpen(false)} style={s.cancel} accessibilityRole="button"><Text>Cancel</Text></Pressable>
          <Pressable disabled={saving} onPress={remove} style={s.confirm} accessibilityRole="button" accessibilityLabel="Confirm deletion">
            {saving?<ActivityIndicator color="#fff"/>:<Text style={s.white}>Delete</Text>}
          </Pressable>
        </View>
      </View></View>
    </Modal>
  </>;
}
const s=StyleSheet.create({
  bin:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:12,backgroundColor:"#FBE9E9"},
  backdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.4)",alignItems:"center",justifyContent:"center",padding:24},
  dialog:{backgroundColor:"#fff",borderRadius:20,padding:24,width:"100%",maxWidth:420,gap:16},
  title:{fontSize:20,fontWeight:"700",color:"#222"},description:{fontSize:15,lineHeight:22,color:"#555"},
  error:{color:"#A32D2D"},buttons:{flexDirection:"row",gap:12,justifyContent:"flex-end"},
  cancel:{padding:14,minWidth:80,alignItems:"center"},confirm:{backgroundColor:"#B63D3D",padding:14,borderRadius:12,minWidth:90,alignItems:"center"},
  white:{color:"#fff",fontWeight:"600"},
});

