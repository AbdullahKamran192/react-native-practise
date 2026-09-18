const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(rows=[],error=null){
 const calls=[],m={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/api/products/search/searchProducts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>n==='@/lib/supabase'?{supabase:{rpc:async(...args)=>{calls.push(args);return {data:rows,error};}}}:{genericProductImageUrl:p=>'generic/'+p,barcodeProductImageUrl:p=>'barcode/'+p.image_path},m,m.exports);
 return {...m.exports,calls};
}
const rows=n=>Array.from({length:n},(_,id)=>({id:String(id),source:id<30?'barcode':'generic',product_name:'Food',product_amount:100,measurement_unit:'g',image_path:'image.webp'}));
test('50 displayed results and one lookahead determine Next without counts',async()=>{
 for(const n of [0,1,49,50,51]){
 const a=load(rows(n)),r=await a.searchProducts(' food ',2);
 assert.equal(r.items.length,Math.min(50,n));assert.equal(r.hasNext,n>50);
 assert.deepEqual(a.calls,[['search_food_products',{p_search:'food',p_page:2}]]);
 if(n>30){assert.equal(r.items[0].image_url,'barcode/image.webp');assert.equal(r.items[30].image_url,'generic/image.webp');}
 }
});
test('blank search and invalid pages never query; failures are surfaced',async()=>{
 const a=load();assert.deepEqual(await a.searchProducts(' '),{items:[],hasNext:false});
 for(const page of [-1,0.5,Infinity,2147483648])await assert.rejects(a.searchProducts('food',page),/Invalid/);
 assert.equal(a.calls.length,0);
 await assert.rejects(load([], {code:'PGRST202',message:'Missing'}).searchProducts('food'),/20260917_product_search.sql/);
 await assert.rejects(load([], {message:'Unavailable'}).searchProducts('food'),/Unavailable/);
});
