const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const family={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync('src/utils/foodMatch.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(family.exports);
const m={exports:{}};
new Function('require','exports',ts.transpileModule(fs.readFileSync('src/utils/publicMealMatching.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>{assert.equal(name,'./foodMatch');return family.exports;},m.exports);
const {initialPublicMeal,matchPublicMeal,selectionCoverage}=m.exports;
const generic={id:42,product_name:'Oats',measurement_unit:'g'};
const meal={ingredients:[{id:1,generic_product_id:42,amount:50,measurement_unit:'g',generic_product:generic},{id:2,generic_product_id:3,amount:100,measurement_unit:'g',generic_product:{...generic,id:3,product_name:'Banana'}}]};
const pantry=(id,amount,link=42,unit='g')=>({id,created_at:'2026-09-'+String(id).padStart(2,'0'),product_barcode:String(id),generic_product_id:null,amount_remaining:amount,product:{product_name:'Branded oats',generic_product_id:link,measurement_unit:unit}});
test('uses stored amounts unchanged; oldest matching stock first; splits amounts; keeps missing generic ingredients',()=>{
 const result=matchPublicMeal(meal,[pantry(2,120),pantry(1,30),pantry(3,999,42,'ml')]);
 assert.deepEqual(result.selections.map(s=>[s.ingredient_id,s.product_barcode,s.generic_product_id,s.amount]),[[1,'1',null,30],[1,'2',null,20],[2,null,3,100]]);
 const coverage=selectionCoverage(result.selections,[pantry(1,30),pantry(2,120)]);
 assert.deepEqual(coverage.get(1),{needed:50,available:50});assert.deepEqual(coverage.get(2),{needed:100,available:0});
});
test('shortage retains generic amount; wrong mapping and wrong units are not auto selected',()=>{
 const result=matchPublicMeal(meal,[pantry(1,20),pantry(2,200,99),pantry(3,300,42,'ml')]);
 assert.deepEqual(result.selections.map(s=>[s.product_barcode,s.generic_product_id,s.amount]),[['1',null,20],[null,42,30],[null,3,100]]);
});
test('does not count the same stock twice across ingredient rows',()=>{
 const duplicate={...meal,ingredients:[meal.ingredients[0],{...meal.ingredients[0],id:3}]};
 const draft=matchPublicMeal(duplicate,[pantry(1,70)]);
 assert.equal(draft.selections.filter(s=>s.product_barcode==='1').reduce((n,s)=>n+s.amount,0),70);
 assert.equal(draft.selections.find(s=>s.generic_product_id===42).amount,30);
 const manual=initialPublicMeal(duplicate).selections.map(s=>({...s,product_barcode:'1',generic_product_id:null}));
 assert.equal([...selectionCoverage(manual,[pantry(1,70)]).values()].reduce((n,s)=>n+s.available,0),70);
});

const classification=(familyId, group=44)=>({food_family_id:familyId,food_group_id:group,food_group:{id:group,is_active:true},food_family:familyId==null?null:{id:familyId,family_name:'Milk',food_group_id:group,is_active:true}});
const milkMeal={ingredients:[{id:1,generic_product_id:2044,amount:100,measurement_unit:'ml',generic_product:{...generic,id:2044,measurement_unit:'ml',...classification(10)}}]};
const milkStock=(id,amount,genericId,familyId)=>{const row=pantry(id,amount,genericId,'ml');row.product.generic_product=classification(familyId);return row;};
test('exact milk outranks older family milk; splits shortage and deduplicates stock',()=>{
 const compatible=milkStock(1,50,192,10),exact=milkStock(2,30,2044,10);
 const result=matchPublicMeal(milkMeal,[compatible,exact,compatible,milkStock(3,100,999,20)]);
 assert.deepEqual(result.selections.map(s=>[s.product_barcode,s.amount]),[['2',30],['1',50],[null,20]]);
 assert.deepEqual(selectionCoverage(result.selections,[compatible,exact]).get(1),{needed:100,available:80});
});
test('family-only milk is automatic but yoghurt and missing families are not',()=>{
 assert.equal(matchPublicMeal(milkMeal,[milkStock(1,100,192,10)]).selections[0].product_barcode,'1');
 for(const familyId of [20,null]) assert.equal(matchPublicMeal(milkMeal,[milkStock(1,100,192,familyId)]).selections[0].product_barcode,null);
 const unclassified={ingredients:[{...milkMeal.ingredients[0],generic_product:{...milkMeal.ingredients[0].generic_product,...classification(null)}}]};
 assert.equal(matchPublicMeal(unclassified,[milkStock(1,100,192,null)]).selections[0].product_barcode,null);
 assert.equal(matchPublicMeal(unclassified,[milkStock(1,100,2044,null)]).selections[0].product_barcode,'1');
});
test('inactive, mismatched or missing family relationships cannot establish compatibility',()=>{
 for(const change of [{food_family:null},{food_family:{id:10,food_group_id:44,is_active:false}},{food_group_id:47}]) {
  const row=milkStock(1,100,192,10);Object.assign(row.product.generic_product,change);
  assert.equal(matchPublicMeal(milkMeal,[row]).selections[0].product_barcode,null);
 }
});
