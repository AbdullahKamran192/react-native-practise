const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function setup(){
 const storage=new Map();const calls=[];let response={data:'trip',error:null};
 const m={exports:{}};
 new Function('exports','module','require',ts.transpileModule(fs.readFileSync('src/api/shopping/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(m.exports,m,name=>{
  if(name==='@react-native-async-storage/async-storage')return {getItem:async key=>storage.get(key)??null,setItem:async(key,value)=>{storage.set(key,value)}};
  if(name==='@tanstack/react-query')return {};
  if(name==='@/utils/productImage')return {};
  if(name==='@/lib/supabase')return {supabase:{rpc:async(name,args)=>{calls.push({name,args});return response}}};
  throw Error(name);
 });
 return {...m.exports,storage,calls,setResponse:r=>{response=r}};
}
test('cart persists, isolates users and serialises overlapping edits',async()=>{
 const api=setup();
 await Promise.all([api.changeCart('a',c=>({...c,items:[...c.items,{id:'one',price:'1'}]})),
 api.changeCart('a',c=>({...c,items:[...c.items,{id:'two',price:'2'}]}))]);
 const saved=await api.readCart('a');assert.equal(saved.items.length,2);
 assert.equal((await api.readCart('b')).items.length,0);
 assert.equal(JSON.parse(api.storage.get('shopping-cart:a')).id,saved.id);
 await assert.rejects(api.changeCart('a',()=>{throw Error('stop')}),/stop/);
 await api.changeCart('a',c=>({...c,attempted:true}));
 assert.equal((await api.readCart('a')).attempted,true);
});
test('checkout keeps the same trip ID and only sends purchase inputs',async()=>{
 const api=setup();const cart={id:'same-trip',attempted:true,items:[{product_barcode:'123',generic_product_id:null,amount:400,price:'1.20',product:{measurement_unit:'g',brands:'Brand'}}]};
 api.setResponse({data:null,error:{message:'network failed'}});
 await assert.rejects(api.completeShopping(cart));
 api.setResponse({data:'same-trip',error:null});await api.completeShopping(cart);
 assert.deepEqual(api.calls[0],api.calls[1]);
 assert.equal(api.calls[0].args.p_trip_id,'same-trip');assert.equal(api.calls[0].args.p_items[0].price,1.2);
 for(const invalid of ['','-1','1.234','abc','Infinity','1000001'])assert.equal(api.priceNumber(invalid),null);
 assert.equal(api.priceNumber('0'),0);assert.equal(api.priceNumber('1.25'),1.25);
});
