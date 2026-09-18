const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function compile(path,requireMock){const m={exports:{}};new Function('exports','module','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(m.exports,m,requireMock);return m.exports;}
test('purchase images use current catalogue paths; inaccessible images retain history',async()=>{
 const images=compile('src/utils/productImage.ts');
 let unavailable=false;const calls=[];
 const rows=[{id:1,product_barcode:'123',generic_product_id:null,product_name_snapshot:'Original name'},
 {id:2,product_barcode:null,generic_product_id:7,product_name_snapshot:'Egg'},
 {id:3,product_barcode:'gone',generic_product_id:null,product_name_snapshot:'Deleted catalogue entry'}];
 const api=compile('src/api/shopping/index.ts',name=>{
  if(name==='@/utils/productImage')return images;
  if(name==='@/lib/supabase')return {supabase:{from:table=>({select:()=>({
   eq:()=>({order:async()=>({data:rows,error:null})}),
   in:async(field,ids)=>{calls.push({table,ids});if(unavailable)throw Error('offline');return {data:table==='products'?[{barcode_number:'123',image_path:'products/123/image.webp',image_url:'https://example.com/old.jpg'}]:[{id:7,image_path:'generic-products/7.webp'}]};}
  })})}};
  return {};
 });
 let result=await api.purchaseDetails('trip');
 assert.ok(result[0].image_url.endsWith('/products/123/image.webp'));
 assert.ok(result[1].image_url.endsWith('/generic-products/7.webp'));
 assert.equal(result[2].image_url,null);assert.equal(result[0].product_name_snapshot,'Original name');
 assert.equal(calls.length,2);
 unavailable=true;result=await api.purchaseDetails('trip');
 assert.equal(result.length,3);assert.ok(result.every(row=>row.image_url===null));
});
