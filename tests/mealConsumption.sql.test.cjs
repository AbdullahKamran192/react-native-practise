const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// Optional, isolated SQL test dependency; see docs/meal-consumption.md.
const { PGlite } = require(process.env.FOODWORTH_PGLITE_PATH || "@electric-sql/pglite");

test("meal consumption transaction on PostgreSQL", async (t) => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated;
      create table public.meals(id bigint primary key, user_id uuid references auth.users(id), meal_name text);
      create table public.products(barcode_number text primary key,
        calories_per_100 numeric, protein_per_100 numeric, carbs_per_100 numeric,
        fat_per_100 numeric, sugars_per_100 numeric, salt_per_100 numeric, fibre_per_100 numeric);
      create table public.generic_products(id bigint primary key,
        calories_per_100 numeric, protein_per_100 numeric, carbs_per_100 numeric,
        fat_per_100 numeric, sugars_per_100 numeric, salt_per_100 numeric, fibre_per_100 numeric);
      create table public.meal_items(id bigint primary key, meal_id bigint references public.meals(id) on delete cascade,
        product_barcode text references public.products(barcode_number), generic_product_id bigint references public.generic_products(id), amount numeric(12,3));
      create table public.pantry(id bigint primary key, user_id uuid references auth.users(id),
        product_barcode text references public.products(barcode_number), generic_product_id bigint references public.generic_products(id),
        amount_remaining numeric(12,3) not null check(amount_remaining > 0));
    `);
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260912_consume_meal_from_pantry.sql"), "utf8"));
    await db.exec(`
      insert into auth.users values ('${owner}'), ('${other}');
      insert into public.meals values (1, '${owner}', 'Smoothie'), (2, '${other}', 'Private meal'), (3, '${owner}', 'Empty');
      insert into public.products values ('12345678',400,10,60,10,5,0.1,8);
      insert into public.generic_products values (1,60,3,5,3,5,0.1,0), (2,100,null,null,null,null,null,null);
      insert into public.meal_items values (1,1,'12345678',null,100),(2,1,null,1,100),(3,1,null,2,50),(4,2,'12345678',null,1);
      insert into public.pantry values (1,'${owner}','12345678',null,150),(2,'${owner}',null,1,60), (3,'${other}','12345678',null,500);
      select set_config('request.jwt.claim.sub','${owner}',false);
    `);

    const consume = (id) => db.query("select * from public.consume_meal_from_pantry($1)", [id]);

    await t.test("partial and missing stock only deduct available amounts from the owner", async () => {
      await db.exec("set role authenticated");
      const row = (await consume(1)).rows[0];
      assert.deepEqual(row, { pantry_items_deducted: 2, pantry_items_exhausted: 1, pantry_items_short: 2 });
      await db.exec("reset role");
      const rows = (await db.query("select id, amount_remaining from public.pantry order by id")).rows;
      assert.deepEqual(rows.map(r => [r.id, Number(r.amount_remaining)]), [[1, 50], [3, 500]]);
      assert.equal((await db.query("select to_regclass('public.meal_consumptions') as relation")).rows[0].relation, null);
    });

    await t.test("exact depletion deletes the pantry row; empty pantry succeeds without writes", async () => {
      await db.exec("update public.meal_items set amount=50 where id=1");
      assert.equal((await consume(1)).rows[0].pantry_items_exhausted, 1);
      assert.deepEqual((await consume(1)).rows[0], { pantry_items_deducted: 0, pantry_items_exhausted: 0, pantry_items_short: 3 });
    });

    await t.test("empty, missing and foreign meals are rejected", async () => {
      await assert.rejects(consume(3), /at least one ingredient/);
      await assert.rejects(consume(999), /no longer available/);
      await assert.rejects(consume(2), /no longer available/);
    });

    await t.test("a later deduction failure rolls back earlier deductions", async () => {
      await db.exec("insert into public.pantry values (4,'" + owner + "','12345678',null,100),(5,'" + owner + "',null,1,200)");
      await db.exec("create function public.reject_test_update() returns trigger language plpgsql as $$ begin if old.id=5 then raise exception 'test update failure'; end if; return new; end $$; create trigger reject_test_update before update on public.pantry for each row execute function public.reject_test_update()");
      await assert.rejects(consume(1), /test update failure/);
      const rows = (await db.query("select id, amount_remaining from public.pantry where id in (4,5) order by id")).rows;
      assert.deepEqual(rows.map(r => [r.id, Number(r.amount_remaining)]), [[4, 100], [5, 200]]);
    });

    await t.test("anonymous and signed-out callers cannot deduct stock", async () => {
      await db.exec("set role anon");
      await assert.rejects(consume(1), /permission denied/);
      await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
      await assert.rejects(consume(1), /Sign in/);
    });
  } finally { await db.close(); }
});
