const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {PGlite}=require(process.env.FOODWORTH_PGLITE_PATH||"@electric-sql/pglite");
test("product reviews: permissions, reservations, approval and three offensive strikes",async()=>{
 const db=new PGlite();
 const owner="11111111-1111-4111-8111-111111111111",admin="22222222-2222-4222-8222-222222222222",other="33333333-3333-4333-8333-333333333333";
 const barcode="1234567890123";
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
   grant usage on schema auth to authenticated;
   create table products(barcode_number text primary key,image_url text,calories_per_100 numeric);
   create table product_corrections(user_id uuid references auth.users(id),product_barcode text references products(barcode_number),product_name text,image_url text,calories_per_100 numeric,primary key(user_id,product_barcode));
   insert into auth.users values('${owner}'),('${admin}'),('${other}');
   insert into products values('${barcode}',null,100);
   insert into product_corrections values('${owner}','${barcode}','Test',null,100);
   grant select,update,insert,delete on product_corrections to authenticated;
   grant select on products to authenticated;`);
  await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20260913_product_image_reviews.sql"),"utf8"));
  await db.exec(`insert into admin_users(user_id) values('${admin}');set role authenticated;set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${owner}';`);
  assert.equal((await db.query("select * from admin_users")).rows.length,0);
  await assert.rejects(db.query("insert into admin_users(user_id) values($1)",[owner]),/permission denied/);
  await assert.rejects(db.exec("update product_corrections set image_status='approved'"),/backend controlled/);
  await assert.rejects(db.exec("update product_corrections set image_url='https://example.com/private.webp'"),/Open Food Facts/);
  await assert.rejects(db.exec("update user_image_moderation set violation_count=0"),/permission denied/);
  await assert.rejects(db.query("select begin_product_image_action($1,$1,$2,'upload',null)",[owner,barcode]),/permission denied/);
  await db.exec("update product_corrections set calories_per_100=125");
  await db.exec(`reset role;set request.jwt.claim.role='service_role';`);
  async function begin(action,actor=owner,submitted=null){return (await db.query("select begin_product_image_action($1,$2,$3,$4,$5) result",[actor,owner,barcode,action,submitted])).rows[0].result;}
  async function finish(action,claim,actor=owner,reason=null){return db.query("select finish_product_image_action($1,$2,$3,$4,$5,$6)",[actor,owner,barcode,action,claim.ticket,reason]);}
  async function pending(){const c=await begin('upload');await finish('upload',c);return (await db.query("select * from product_corrections")).rows[0];}
  let row=await pending();
  await assert.rejects(begin('upload'),/awaiting review/);
  await assert.rejects(begin('approve',other,row.image_submitted_at),/Not authorised/);
  let claim=await begin('reject',admin,row.image_submitted_at);
  await assert.rejects(begin('approve',admin,row.image_submitted_at),/already in progress/);
  await finish('reject',claim,admin,'poor_quality');
  assert.equal((await db.query("select * from user_image_moderation")).rows.length,0);
  for(let n=1;n<=3;n++){
   row=await pending();claim=await begin('reject',admin,row.image_submitted_at);
   await finish('reject',claim,admin,n===2?'abusive':'offensive');
   await assert.rejects(finish('reject',claim,admin,'offensive'),/no longer available/);
   const m=(await db.query("select * from user_image_moderation")).rows[0];
   assert.equal(m.violation_count,n);assert.equal(m.image_upload_blocked,n===3);
  }
  await assert.rejects(begin('upload'),/blocked/);
  await db.exec("update user_image_moderation set violation_count=0,image_upload_blocked=false");
  row=await pending();claim=await begin('approve',admin,row.image_submitted_at);await finish('approve',claim,admin);
  const c=(await db.query("select * from product_corrections")).rows[0];
  assert.equal(c.image_status,'approved');assert.equal(c.image_path,null);assert.equal(c.calories_per_100,'125');
  assert.equal((await db.query("select image_path from products")).rows[0].image_path,`products/${barcode}/image.webp`);
  await assert.rejects(begin('upload'),/already has an image/);
  await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20260916_allow_product_image_replacements.sql"),"utf8"));
  const publicPath=`products/${barcode}/image.webp`;
  row=await pending();
  assert.equal((await db.query("select image_path from products")).rows[0].image_path,publicPath);
  await assert.rejects(begin('upload'),/awaiting review/);
  await assert.rejects(begin('approve',other,row.image_submitted_at),/Not authorised/);
  claim=await begin('reject',admin,row.image_submitted_at);
  await finish('reject',claim,admin,'poor_quality');
  assert.equal((await db.query("select image_path from products")).rows[0].image_path,publicPath);
  row=await pending();claim=await begin('approve',admin,row.image_submitted_at);await finish('approve',claim,admin);
  assert.equal((await db.query("select image_status,calories_per_100 from product_corrections")).rows[0].image_status,'approved');
  assert.equal((await db.query("select calories_per_100 from product_corrections")).rows[0].calories_per_100,'125');
  // An OFF-only product also accepts a replacement, retaining its fallback URL.
  await db.exec("update products set image_path=null,image_url='https://images.openfoodfacts.org/example.webp'");
  row=await pending();claim=await begin('approve',admin,row.image_submitted_at);await finish('approve',claim,admin);
  const approved=(await db.query("select image_path,image_url from products")).rows[0];
  assert.equal(approved.image_path,publicPath);
  assert.equal(approved.image_url,'https://images.openfoodfacts.org/example.webp');
  await db.exec("update user_image_moderation set image_upload_blocked=true");
  await assert.rejects(begin('upload'),/blocked/);
 }finally{await db.close();}
});
