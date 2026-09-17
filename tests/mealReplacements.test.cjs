const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function load(file,imports={}) {const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>{if(!(n in imports))throw Error(n);return imports[n];},m.exports,m);return m.exports;}
const matching=load('src/utils/mealReplacements.ts');
const availability=load('src/utils/mealAvailability.ts');
const item={id:1,product_barcode:'123',generic_product_id:null,amount:100,created_at:'2026',product:{product_name:'Tesco Porridge Oats',measurement_unit:'g',generic_product_id:31}};
const stock=(id,name,link=31,unit='g',amount=200)=>({id,product_barcode:String(id),generic_product_id:null,amount_remaining:amount,product:{product_name:name,measurement_unit:unit,generic_product_id:link}});
test('equivalents first; partial stock allowed; duplicates, empty stock, wrong units and brands alone excluded',()=>{
 const result=matching.replacementCandidates(item,[item,{product_barcode:'5'}],[stock(2,'Rolled cereal'),stock(3,'Honey Oats Granola',99),stock(4,'Tesco premium milk',null),stock(5,'Oats'),stock(6,'Oats',31,'ml'),stock(7,'Oats',31,'g',0),stock(8,'Oats',31,'g',20)]);
 assert.deepEqual(result.equivalent.map(r=>r.id).sort(),[2,8]);assert.deepEqual(result.similar.map(r=>r.id),[3]);
 const unclassified={...item,product:{...item.product,generic_product_id:null}};
 assert.equal(matching.replacementCandidates(unclassified,[unclassified],[stock(2,'Oats')]).equivalent.length,0);
 assert.equal(matching.replacementCandidates(unclassified,[unclassified],[stock(2,'Oats')]).similar.length,1);
 assert.equal(matching.replacementCandidates({...item,product_barcode:null},[],[stock(2,'Oats')]).similar.length,0);
});
function api(current=item, originalStock=[]) {
 const writes=[],calls=[];const candidate=stock(2,'Asda Oats');
 const supabase={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){const filters=[];let update;return {select(){return this},eq(k,v){filters.push([k,v]);return this},update(value){update=value;return this},maybeSingle(){return this},then(resolve){calls.push({table,filters});if(table==='meals')return resolve({data:{items:[current]}});if(table==='pantry')return resolve({data:filters.some(([k])=>k==='id')?[candidate]:originalStock});writes.push(update);resolve({data:{id:1}});}};}};
 const mod=load('src/api/meals/operations.ts',{'./images':{},'@/lib/supabase':{supabase},'./validation':{validateMealId(){}},'@/utils/mealReplacements':matching,'@/utils/mealAvailability':availability});
 return {...mod,writes,calls};
}
const request={mealId:'1',itemId:1,pantryId:2,originalBarcode:'123',originalAmount:100};
test('replacement updates only the existing reference and scopes stock to owner',async()=>{
 const a=api();await a.replaceMealItem(request);
 assert.deepEqual(a.writes,[{product_barcode:'2',generic_product_id:null}]);
 assert.ok(a.calls.filter(c=>c.table==='pantry').every(c=>c.filters.some(([k,v])=>k==='user_id'&&v==='owner')));
 const change=a.calls.find(c=>c.table==='meal_items');assert.ok(change.filters.some(([k,v])=>k==='id'&&v===1));assert.ok(change.filters.some(([k,v])=>k==='amount'&&v===100));
});
test('stale amount or restored stock prevents replacement',async()=>{
 const a=api({...item,amount:150});await assert.rejects(a.replaceMealItem(request),/changed/);assert.equal(a.writes.length,0);
 const b=api(item,[{product_barcode:'123',amount_remaining:80}]);await assert.rejects(b.replaceMealItem(request),/80%/);assert.equal(b.writes.length,0);
});
