const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(process.env.FOODWORTH_PGLITE_PATH || "@electric-sql/pglite");

test("logging RPC: food, meals, optional pantry, snapshots, retries and rollback", async (t) => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  let group = 0;
  const newGroup = () => "00000000-0000-4000-8000-" + String(++group).padStart(12, "0");
  const nutrition = "calories_per_100 numeric, protein_per_100 numeric, carbs_per_100 numeric, fat_per_100 numeric, sugars_per_100 numeric, salt_per_100 numeric, fibre_per_100 numeric";
  async function log(overrides = {}) {
    const args = { group: newGroup(), date: "2026-09-12", remove: true, meal: null, barcode: null, generic: null, amount: null, unit: null, zone: "UTC", ...overrides };
    return db.query("select * from public.log_food_consumption($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [args.group, args.date, args.zone, args.remove, args.meal, args.barcode, args.generic, args.amount, args.unit, "Test brand"]);
  }
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      create table public.meals(id bigint primary key, user_id uuid references auth.users(id), meal_name text);
      create table public.products(barcode_number text primary key, product_name text, measurement_unit text, ${nutrition});
      create table public.generic_products(id bigint primary key, product_name text, measurement_unit text, ${nutrition});
      create table public.product_corrections(product_barcode text, user_id uuid, product_name text, measurement_unit text, ${nutrition}, primary key(product_barcode,user_id));
      create table public.meal_items(id bigint primary key, meal_id bigint references public.meals(id) on delete cascade, product_barcode text, generic_product_id bigint, amount numeric(12,3));
      create table public.pantry(id bigint primary key, user_id uuid, product_barcode text, generic_product_id bigint, amount_remaining numeric(12,3) check(amount_remaining>0));
      insert into auth.users values ('${owner}'),('${other}');
      insert into public.meals values (1,'${owner}','Smoothie'),(2,'${other}','Private'),(3,'${owner}','Empty');
      insert into public.products values ('123','Milk','ml',60,3,5,3,5,0.1,0);
      insert into public.generic_products values (1,'Oats','g',400,10,60,10,5,0.1,8),(2,'Egg','g',143,12.6,null,null,null,null,null);
      insert into public.product_corrections values ('123','${owner}','My milk','ml',70,null,null,null,null,null,null);
      insert into public.meal_items values (1,1,'123',null,100),(2,1,null,1,50),(3,1,null,2,50);
      insert into public.pantry values (1,'${owner}','123',null,150),(2,'${owner}',null,1,20),(3,'${other}','123',null,500);
      select set_config('request.jwt.claim.sub','${owner}',false);
    `);
    for (const file of ["20260912_food_consumption.sql", "20260912_log_food_consumption.sql"])
      await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations", file), "utf8"));

    await t.test("unchecked meal logs all ingredients with no pantry change", async () => {
      await db.exec("set role authenticated");
      const rows = (await log({ meal: 1, remove: false })).rows;
      assert.equal(rows.length, 3);
      assert.equal(new Set(rows.map(r => r.consumption_group_id)).size, 1);
      assert.ok(rows.every(r => r.meal_name_snapshot === "Smoothie"));
      assert.equal(rows.reduce((n,r) => n + Number(r.calories_consumed), 0), 331.5);
      assert.equal(rows[2].carbs_consumed, null);
      await db.exec("reset role");
      assert.equal(Number((await db.query("select amount_remaining from public.pantry where id=1")).rows[0].amount_remaining), 150);
      assert.equal((await db.query("select * from public.pantry")).rows.length, 3);
    });
    const savedGroup = newGroup();
    await t.test("checked meal logs full amounts, handles missing/short stock and isolates users", async () => {
      const rows = (await log({ meal: 1, group: savedGroup })).rows;
      assert.equal(rows.length, 3);
      assert.deepEqual(rows.map(r => Number(r.amount_consumed)), [100,50,50]);
      const stock = (await db.query("select id,amount_remaining from public.pantry order by id")).rows;
      assert.deepEqual(stock.map(r => [r.id,Number(r.amount_remaining)]), [[1,50],[3,500]]);
    });
    await t.test("single barcode uses personal correction and actual decimal amount", async () => {
      const row = (await log({ barcode: "123", amount: 20, unit: "ml", remove: false, date: "2026-09-11" })).rows[0];
      assert.equal(Number(row.calories_consumed), 14);
      assert.equal(Number(row.protein_consumed), 0.6);
      assert.equal(row.brand_snapshot, "Test brand");
      assert.equal(row.product_name_snapshot, "My milk");
      assert.equal(row.meal_id, null);
      assert.equal(row.consumed_on.toISOString().slice(0, 10), "2026-09-11");
    });
    await t.test("single generic logs while absent from pantry", async () => {
      const row = (await log({ generic: 2, amount: 25, unit: "g" })).rows[0];
      assert.equal(Number(row.calories_consumed), 35.75);
      assert.equal(row.brand_snapshot, null);
    });
    await t.test("same group never logs or deducts twice, even after recipe deletion", async () => {
      await db.exec("delete from public.meals where id=1; update public.products set calories_per_100=999");
      const rows = (await log({ meal: 1, group: savedGroup })).rows;
      assert.equal(rows.length, 3);
      assert.equal(Number(rows[0].calories_consumed), 60);
      assert.equal(rows[0].meal_id, null);
      assert.equal(rows[0].meal_name_snapshot, "Smoothie");
      assert.equal(Number((await db.query("select amount_remaining from public.pantry where id=1")).rows[0].amount_remaining), 50);
    });
    await t.test("exact depletion deletes stock", async () => {
      await log({ barcode: "123", amount: 50, unit: "ml" });
      assert.equal((await db.query("select * from public.pantry where id=1")).rows.length, 0);
    });
    await t.test("invalid requests and foreign/empty meals are rejected", async () => {
      for (const args of [
        { meal: 2 }, { meal: 3 }, { generic: 999, amount: 1, unit: "g" },
        { generic: 1, amount: 0, unit: "g" }, { generic: 1, amount: "NaN", unit: "g" },
        { generic: 1, amount: 1, unit: "ml" }, { generic: 1, amount: 1, unit: "g", date: "9999-01-01" },
        { generic: 1, amount: 1, unit: "g", zone: "invalid" },
        { generic: 1, barcode: "123", amount: 1, unit: "g" },
        { generic: 1, amount: 1, unit: "g", remove: null }
      ]) await assert.rejects(log(args));
    });
    await t.test("failure on later ingredient rolls back earlier log and deduction", async () => {
      await db.exec(`
        insert into public.meals values (4,'${owner}','Rollback test');
        insert into public.meal_items values (4,4,'123',null,20),(5,4,null,1,10);
        insert into public.pantry values (4,'${owner}','123',null,100);
        create function public.reject_log() returns trigger language plpgsql as $$
          begin if new.generic_product_id=1 then raise exception 'test failure'; end if; return new; end $$;
        create trigger reject_log before insert on public.food_consumption for each row execute function public.reject_log();
      `);
      const id = newGroup();
      await assert.rejects(log({ meal: 4, group: id }), /test failure/);
      assert.equal((await db.query("select * from public.food_consumption where consumption_group_id=$1", [id])).rows.length, 0);
      assert.equal(Number((await db.query("select amount_remaining from public.pantry where id=4")).rows[0].amount_remaining), 100);
    });
    await t.test("anonymous and signed-out callers are rejected", async () => {
      await db.exec("set role anon");
      await assert.rejects(log({ generic: 2, amount: 1, unit: "g" }), /permission denied/);
      await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
      await assert.rejects(log({ generic: 2, amount: 1, unit: "g" }), /Sign in/);
    });
  } finally { await db.close(); }
});
