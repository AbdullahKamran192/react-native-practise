const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {PGlite}=require(process.env.FOODWORTH_PGLITE_PATH||'@electric-sql/pglite');
test('optional trip deduction is owner-scoped, aggregated, atomic and safe to retry',async()=>{
 const db=new PGlite();const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const trip='00000000-0000-4000-8000-000000000001';
 const remove=flag=>db.query('select * from delete_shopping_trip($1,$2)',[trip,flag]);
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table shopping_trips(id uuid primary key,user_id uuid,total_spent numeric);
 create table shopping_trip_items(id bigint primary key,shopping_trip_id uuid references shopping_trips(id) on delete cascade,product_barcode text,generic_product_id bigint,measurement_unit text,amount_purchased numeric);
 create table products(barcode_number text primary key,measurement_unit text);
 create table generic_products(id bigint primary key,measurement_unit text);
 create table pantry(id bigint primary key,user_id uuid,product_barcode text,generic_product_id bigint,amount_remaining numeric check(amount_remaining>0));
 insert into products values('a','g'),('b','ml'),('missing','g'),('changed','ml');
 insert into generic_products values(1,'g');
 insert into shopping_trips values('${trip}','${owner}',10);
 insert into shopping_trip_items values(1,'${trip}','a',null,'g',300),(2,'${trip}','a',null,'g',200),
 (3,'${trip}','b',null,'ml',1000),(4,'${trip}','missing',null,'g',10),
 (5,'${trip}',null,1,'g',50),(6,'${trip}','changed',null,'g',100);
 insert into pantry values(1,'${owner}','a',null,400),(2,'${owner}','b',null,1500),
 (3,'${owner}',null,1,50),(4,'${other}','a',null,900),(5,'${owner}','changed',null,100);
 select set_config('request.jwt.claim.sub','${other}',false);`);
 await db.exec(fs.readFileSync('supabase/migrations/20260918_delete_shopping_trip_pantry.sql','utf8'));
 await db.exec('set role authenticated');
 assert.equal((await remove(true)).rows[0].trip_deleted,false);
 await db.exec(`reset role;select set_config('request.jwt.claim.sub','${owner}',false)`);
 // A later failure must restore earlier deductions and retain the history.
 await db.exec(`create function block_stock_delete() returns trigger language plpgsql as $$begin
 if old.id=3 then raise exception 'test failure';end if;return old;end$$;
 create trigger block_delete before delete on pantry for each row execute function block_stock_delete();`);
 await assert.rejects(remove(true),/test failure/);
 assert.equal(Number((await db.query('select amount_remaining from pantry where id=1')).rows[0].amount_remaining),400);
 assert.equal(Number((await db.query('select amount_remaining from pantry where id=2')).rows[0].amount_remaining),1500);
 assert.equal((await db.query('select * from shopping_trip_items')).rows.length,6);
 await db.exec('drop trigger block_delete on pantry;set role authenticated');
 assert.deepEqual((await remove(true)).rows[0],{trip_deleted:true,pantry_items_updated:3,pantry_items_unavailable:2,pantry_items_short:1});
 assert.deepEqual((await remove(true)).rows[0],{trip_deleted:false,pantry_items_updated:0,pantry_items_unavailable:0,pantry_items_short:0});
 await db.exec('reset role');
 assert.deepEqual((await db.query('select id,amount_remaining from pantry order by id')).rows.map(r=>[r.id,Number(r.amount_remaining)]),[[2,500],[4,900],[5,100]]);
 assert.equal((await db.query('select * from shopping_trip_items')).rows.length,0);
 // Unchecked deletes only the history, even when stock is available.
 await db.exec(`insert into shopping_trips values('${trip}','${owner}',5);
 insert into shopping_trip_items values(1,'${trip}','b',null,'ml',200);set role authenticated;`);
 assert.equal((await remove(false)).rows[0].pantry_items_updated,0);
 await db.exec('reset role');
 assert.equal(Number((await db.query('select amount_remaining from pantry where id=2')).rows[0].amount_remaining),500);
 await db.exec("select set_config('request.jwt.claim.sub','',false);set role authenticated");
 await assert.rejects(remove(true),/Sign in/);
 await db.exec('reset role;set role anon');await assert.rejects(remove(true),/permission denied/);
 }finally{await db.close();}
});
