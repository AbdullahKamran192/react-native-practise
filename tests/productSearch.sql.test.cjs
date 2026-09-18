const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.FOODWORTH_PGLITE_PATH||'@electric-sql/pglite';
const {PGlite}=require(base);const {pg_trgm}=require(process.env.FOODWORTH_PGLITE_PATH ? base+'/dist/contrib/pg_trgm.cjs' : base+'/contrib/pg_trgm');
test('indexed combined search paginates across catalogues with RLS and no duplicates',async()=>{
 const db=new PGlite({extensions:{pg_trgm}});
 try{
 await db.exec(`
 create role anon;create role authenticated;
 create table products(barcode_number text primary key,product_name text,image_path text,image_url text,product_amount numeric,measurement_unit text);
 create table generic_products(id bigint primary key,product_name text,image_path text,default_amount numeric,measurement_unit text);
 insert into products select lpad(i::text,4,'0'),'Same food',null,null,100,'g' from generate_series(1,60)i;
 insert into generic_products select i,'Same food',null,100,'g' from generate_series(1,65)i;
 alter table products enable row level security;alter table generic_products enable row level security;
 create policy read_products on products for select to authenticated using (true);
 create policy read_generic on generic_products for select to authenticated using (id<>65);
 grant select on products,generic_products to authenticated;
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20260917_product_search.sql','utf8'));
 assert.equal((await db.query("select indexname from pg_indexes where indexname like '%name_trgm_idx'")).rows.length,2);
 await db.exec('set role authenticated');
 const seen=[];
 for(let p=0;p<3;p++){
 const r=(await db.query('select * from search_food_products($1,$2)',[' FOOD ',p])).rows;
 assert.equal(r.length,p===2?24:51);
 seen.push(...r.slice(0,50).map(x=>x.source+':'+x.id));
 }
 assert.equal(new Set(seen).size,124);assert.equal(seen[59],'barcode:0060');assert.equal(seen[60],'generic:1');
 assert.equal((await db.query('select * from search_food_products($1,$2)',['food',3])).rows.length,0);
 assert.equal((await db.query("select * from search_food_products('')")).rows.length,0);
 await assert.rejects(db.query("select * from search_food_products('food',-1)"),/Invalid/);
 await db.exec('reset role;set role anon');
 await assert.rejects(db.query("select * from search_food_products('food')"),/permission denied/);
 }finally{await db.close();}
});
