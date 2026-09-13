const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(process.env.FOODWORTH_PGLITE_PATH || "@electric-sql/pglite");
test("meal photos: guarded paths, concurrent publication, cleanup and deletion", async () => {
 const db = new PGlite();
 const user = "11111111-1111-4111-8111-111111111111";
 const photo = (n) => `meals/${user}/1/00000000-0000-4000-8000-${String(n).padStart(12,"0")}.webp`;
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
 create table meals(id bigint primary key,user_id uuid,image_path text);
 insert into meals values (1,'${user}',null);`);
 await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20260913_meal_images.sql"),"utf8"));
 await db.exec("set request.jwt.claim.role='authenticated'");
 await assert.rejects(db.query("update meals set image_path=$1 where id=1",[photo(1)]), /photo service/);
 await db.exec("set request.jwt.claim.role='service_role'");
 const queue = async p => db.query("insert into meal_image_cleanup(image_path) values($1)",[p]);
 const finish = async (expected,p,uid=user) => db.query("select finish_meal_image(1,$1,$2,$3)",[uid,expected,p]);
 await queue(photo(1)); await finish(null,photo(1));
 assert.equal((await db.query("select count(*)::int n from meal_image_cleanup")).rows[0].n,0);
 await queue(photo(2));
 await assert.rejects(finish(null,photo(2)),/Meal changed/);
 await assert.rejects(finish(photo(1),photo(2),"22222222-2222-4222-8222-222222222222"),/Meal changed/);
 await finish(photo(1),photo(2));
 assert.equal((await db.query("select claim_meal_image_cleanup($1) ok",[photo(1)])).rows[0].ok,true);
 await assert.rejects(finish(photo(2),photo(1)),/Upload expired/);
 await queue(photo(3));
 await db.query("select claim_meal_image_cleanup($1)",[photo(3)]);
 await assert.rejects(finish(photo(2),photo(3)),/Upload expired/);
 await db.exec("set request.jwt.claim.role='authenticated'; delete from meals where id=1");
 assert.equal((await db.query("select count(*)::int n from meal_image_cleanup where image_path=$1",[photo(2)])).rows[0].n,1);
 } finally { await db.close(); }
});


test("simplification removes cleanup objects and preserves current meal photos", async () => {
 const db = new PGlite();
 const owner = "11111111-1111-4111-8111-111111111111";
 const legacy = `meals/${owner}/1/00000000-0000-4000-8000-000000000001.webp`;
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
   create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
   create table meals(id bigint primary key,user_id uuid); insert into meals values(1,'${owner}');`);
  await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20260913_meal_images.sql"),"utf8"));
  await db.exec("set request.jwt.claim.role='service_role'");
  await db.query("update meals set image_path=$1 where id=1",[legacy]);
  const migration = fs.readFileSync(path.join(__dirname,"../supabase/migrations/20260913_simplify_meal_images.sql"),"utf8");
  await db.exec(migration);
  await db.exec(migration);
  assert.equal((await db.query("select image_path from meals where id=1")).rows[0].image_path,legacy);
  assert.equal((await db.query("select to_regclass('public.meal_image_cleanup') name")).rows[0].name,null);
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname in ('guard_meal_image','queue_old_meal_image','finish_meal_image','claim_meal_image_cleanup')")).rows[0].n,0);
  await db.query("update meals set image_path=$1 where id=1",[`meals/${owner}/1/image.webp`]);
  await db.exec("update meals set image_path=null where id=1; delete from meals where id=1;");
 } finally { await db.close(); }
});
