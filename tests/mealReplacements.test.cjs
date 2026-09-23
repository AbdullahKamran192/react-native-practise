const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function load(file,imports={}) {const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>{if(!(n in imports))throw Error(n);return imports[n];},m.exports,m);return m.exports;}
const foodMatch=load('src/utils/foodMatch.ts');
const matching=load('src/utils/mealReplacements.ts',{'./foodMatch':foodMatch});
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
function api(current=item, originalStock=[], candidate=stock(2,'Asda Oats')) {
 const writes=[],calls=[];
 const supabase={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){const filters=[];let update;return {select(){return this},eq(k,v){filters.push([k,v]);return this},is(k,v){filters.push([k,v]);return this},update(value){update=value;return this},maybeSingle(){return this},then(resolve){calls.push({table,filters});if(table==='meals')return resolve({data:{items:[current]}});if(table==='products'||table==='generic_products')return resolve({data:{measurement_unit:'g'}});if(table==='pantry')return resolve({data:filters.some(([k])=>k==='id')?[candidate]:originalStock});writes.push(update);resolve({data:{id:1}});}};}};
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
 const b=api(item,[{product_barcode:'123',amount_remaining:100}]);await assert.rejects(b.replaceMealItem(request),/100%/);assert.equal(b.writes.length,0);
});

test('partially stocked ingredients can be replaced up to but not including 100 percent',async()=>{
 for(const amount of [80,91,99.9]){
  const a=api(item,[{product_barcode:'123',amount_remaining:amount}]);
  await a.replaceMealItem(request);
  assert.equal(a.writes.length,1);
 }
});

const genericItem={...item,product_barcode:null,generic_product_id:31,product:null,generic_product:{product_name:'Porridge Oats',measurement_unit:'g'}};
test('generic ingredients offer equivalent and similar pantry replacements',()=>{
 const result=matching.replacementCandidates(genericItem,[genericItem],[stock(2,'Asda Oats'),stock(3,'Oats Granola',99)]);
 assert.deepEqual(result.equivalent.map(r=>r.id),[2]);assert.deepEqual(result.similar.map(r=>r.id),[3]);
 assert.deepEqual(matching.replacementCandidates(genericItem,[genericItem],[]),{equivalent:[],compatible:[],sameGroup:[],similar:[]});assert.equal(genericItem.generic_product_id,31);
});
test('generic pantry replacement guards original reference and leaves amount unchanged',async()=>{
 const a=api(genericItem);await a.replaceMealItem({...request,originalBarcode:null,originalGenericId:31});
 assert.deepEqual(a.writes,[{product_barcode:'2',generic_product_id:null}]);
 assert.ok(a.calls.find(c=>c.table==='meal_items').filters.some(([k,v])=>k==='generic_product_id'&&v===31));
});
const direct={mealId:'1',itemId:1,originalBarcode:null,originalGenericId:31,originalAmount:100,product_barcode:'new-scan',generic_product_id:null};
test('searched or scanned product replaces an ingredient without needing or changing pantry stock',async()=>{
 const a=api(genericItem);await a.replaceMealProduct(direct);
 assert.deepEqual(a.writes,[{product_barcode:'new-scan',generic_product_id:null}]);assert.ok(!a.calls.some(c=>c.table==='pantry'));
});
test('direct replacement rejects stale amounts and incompatible units',async()=>{
 const a=api({...genericItem,amount:101});await assert.rejects(a.replaceMealProduct(direct),/changed/);assert.equal(a.writes.length,0);
 const b=api({...genericItem,generic_product:{...genericItem.generic_product,measurement_unit:'ml'}});
 await assert.rejects(b.replaceMealProduct(direct),/measurement unit/);assert.equal(b.writes.length,0);
});

const classification=(group,active=true)=>({food_group_id:group,is_active:true,food_group:{id:group,is_active:active}});
const fish={...item,product:{...item.product,product_name:'ASDA Tuna',generic_product_id:10,generic_product:classification(47)}};
function fishStock(id,name,link,group=47) {
 const row=stock(id,name,link);
 row.product.generic_product=classification(group);
 return row;
}
test('exact ingredient, broader group and name matches are separate and deduplicated',()=>{
 const tuna=fishStock(2,'Tesco Tuna',10), sardines=fishStock(3,'Sardines',11), similar=fishStock(4,'Tuna alternative',12,99);
 const result=matching.replacementCandidates(fish,[fish],[tuna,sardines,similar,sardines,fishStock(5,'Chicken',13,49)]);
 assert.deepEqual(result.equivalent.map(r=>r.id),[2]);
 assert.deepEqual(result.sameGroup.map(r=>r.id),[3]);
 assert.deepEqual(result.similar.map(r=>r.id),[4]);
});
test('inactive groups, inactive generics, missing classifications and incompatible stock do not create group suggestions',()=>{
 const inactive=fishStock(2,'Sardines',11);inactive.product.generic_product=classification(47,false);
 const hidden=fishStock(3,'Salmon',12);hidden.product.generic_product.is_active=false;
 const wrongUnit=fishStock(4,'Cod',13);wrongUnit.product.measurement_unit='ml';
 const empty=fishStock(5,'Haddock',14);empty.amount_remaining=0;
 const unclassified=stock(6,'Trout',15);
 assert.equal(matching.replacementCandidates(fish,[],[inactive,hidden,wrongUnit,empty,unclassified]).sameGroup.length,0);
});
test('generic pantry foods use the same group matching and existing recipe foods are excluded',()=>{
 const generic={id:7,product_barcode:null,generic_product_id:11,amount_remaining:75,product:null,generic_product:{product_name:'Sardines',measurement_unit:'g',...classification(47)}};
 const original={...item,product_barcode:null,generic_product_id:10,product:null,generic_product:{product_name:'Tuna',measurement_unit:'g',...classification(47)}};
 assert.deepEqual(matching.replacementCandidates(original,[],[generic]).sameGroup.map(r=>r.id),[7]);
 assert.equal(matching.replacementCandidates(original,[generic],[generic]).sameGroup.length,0);
});
test('personal meal accepts a same-group alternative and preserves amount',async()=>{
 const a=api(fish,[],fishStock(2,'Sardines',11));
 await a.replaceMealItem(request);
 assert.deepEqual(a.writes,[{product_barcode:'2',generic_product_id:null}]);
});
test('personal meal can select a generic pantry alternative',async()=>{
 const candidate={id:2,product_barcode:null,generic_product_id:11,amount_remaining:75,product:null,generic_product:{product_name:'Sardines',measurement_unit:'g',...classification(47)}};
 const a=api(fish,[],candidate);await a.replaceMealItem(request);
 assert.deepEqual(a.writes,[{product_barcode:null,generic_product_id:11}]);
});

test('family alternatives are separate from exact/name/group matches and accepted on personal meals',async()=>{
 const family={food_family_id:10,food_group_id:44,food_group:{id:44,is_active:true},food_family:{id:10,family_name:'Milk',food_group_id:44,is_active:true}};
 const original={...item,product:{...item.product,product_name:'Milk',generic_product_id:2044,generic_product:family}};
 const candidate=stock(2,'Whole milk',192);candidate.product.generic_product=family;
 const exact=stock(3,'Milk',2044);exact.product.generic_product=family;
 const broad=stock(4,'Yoghurt',99);broad.product.generic_product={...family,food_family_id:20,food_family:{...family.food_family,id:20}};
 const result=matching.replacementCandidates(original,[original],[candidate,candidate,exact,broad]);
 assert.deepEqual(result.equivalent.map(r=>r.id),[3]);assert.deepEqual(result.compatible.map(r=>r.id),[2]);assert.deepEqual(result.sameGroup.map(r=>r.id),[4]);assert.equal(result.similar.length,0);
 const a=api(original,[],candidate);await a.replaceMealItem(request);assert.deepEqual(a.writes,[{product_barcode:'2',generic_product_id:null}]);
});
