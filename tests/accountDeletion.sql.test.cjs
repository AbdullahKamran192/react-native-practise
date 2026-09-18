
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.FOODWORTH_PGLITE_PATH||'@electric-sql/pglite');
test('account deletion removes owned rows, clears reviewer references, and preserves shared and other-user data',async()=>{
 const db=new PGlite();
 const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
 try {
 await db.exec(`
 create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
 create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
 create table products(barcode_number text primary key,image_url text);
 create table product_corrections(user_id uuid references auth.users(id),product_barcode text references products,product_name text,image_url text, primary key(user_id,product_barcode));
 create table meals(id bigint primary key,user_id uuid references auth.users);
 create table meal_items(id bigint primary key,meal_id bigint references meals);
 create table food_consumption(id bigint primary key,user_id uuid references auth.users,meal_id bigint references meals);
 create table pantry(id bigint primary key,user_id uuid references auth.users);
 create table user_settings(user_id uuid primary key references auth.users);
 insert into auth.users values('${a}'),('${b}');
 insert into products values('123',null);
 insert into meals values(1,'${a}'),(2,'${b}');
 insert into meal_items values(1,1),(2,2);
 insert into food_consumption values(1,'${a}',1),(2,'${b}',2);
 insert into pantry values(1,'${a}'),(2,'${b}');
 insert into user_settings values('${a}'),('${b}');
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20260913_product_image_reviews.sql','utf8'));
 await db.exec(`
 set request.jwt.claim.role='service_role';
 insert into product_corrections(user_id,product_barcode,image_status,image_path,image_reviewed_by) values
 ('${a}','123','pending','product-corrections/owner/123/image.webp',null),
 ('${b}','123','approved',null,'${a}');
 insert into admin_users(user_id) values('${a}'),('${b}');
 insert into user_image_moderation(user_id) values('${a}'),('${b}');
 set request.jwt.claim.role='';
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20260917_account_deletion.sql','utf8'));
 assert.equal((await db.query('select * from auth.users')).rows.length,2);
 await db.exec('set role authenticated');
 await assert.rejects(db.exec(`delete from auth.users where id='${a}'`),/permission denied/);
 await assert.rejects(db.exec('select remove_account_data()'),/permission denied/);
 await db.exec('reset role');
 // An unexpected dependency must roll the entire database deletion back.
 await db.exec(`create table blocker(user_id uuid references auth.users); insert into blocker values('${a}');`);
 await assert.rejects(db.exec(`delete from auth.users where id='${a}'`),/foreign key/);
 assert.equal((await db.query('select * from pantry')).rows.length,2);
 await db.exec('drop table blocker');
 await db.exec(`delete from auth.users where id='${a}'`);
 for(const table of ['pantry','food_consumption','meals','user_settings','product_corrections','admin_users','user_image_moderation']){
  const rows=(await db.query('select * from '+table)).rows;
  assert.equal(rows.length,1,table); assert.equal(rows[0].user_id,b,table);
 }
 assert.equal((await db.query('select * from meal_items')).rows[0].meal_id,2);
 assert.equal((await db.query('select * from products')).rows.length,1);
 assert.equal((await db.query('select image_reviewed_by from product_corrections')).rows[0].image_reviewed_by,null);
 }finally{await db.close();}
});
