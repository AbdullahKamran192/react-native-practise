const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(process.env.FOODWORTH_PGLITE_PATH || "@electric-sql/pglite");

test("food consumption schema preserves snapshots and restricts access", async () => {
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
      create table public.meals(id bigint primary key);
      create table public.products(barcode_number text primary key);
      create table public.generic_products(id bigint primary key);
      insert into auth.users values ('${owner}'), ('${other}');
      insert into public.meals values (1);
      insert into public.products values ('123');
      insert into public.generic_products values (1);
    `);
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260912_food_consumption.sql"), "utf8"));
    await db.query(`insert into public.food_consumption
      (user_id, consumed_on, consumption_group_id, meal_id, meal_name_snapshot,
       product_barcode, product_name_snapshot, amount_consumed, measurement_unit, calories_consumed)
      values ($1, '2026-09-12', $2, 1, 'Smoothie', '123', 'Oats', 20, 'g', 52.8)`, [owner, other]);
    for (const change of [
      "amount_consumed=0", "amount_consumed='NaN'", "calories_consumed=-1",
      "calories_consumed='NaN'", "measurement_unit='kg'",
      "generic_product_id=1", "product_barcode=null", "meal_name_snapshot=null"
    ]) await assert.rejects(db.exec("update public.food_consumption set " + change), /check constraint/);
    await assert.rejects(db.exec("delete from public.products where barcode_number='123'"), /foreign key constraint/);
    await db.exec("delete from public.meals where id=1");
    const row = (await db.query("select * from public.food_consumption")).rows[0];
    assert.equal(row.meal_id, null);
    assert.equal(row.meal_name_snapshot, "Smoothie");
    assert.equal(row.product_name_snapshot, "Oats");
    assert.equal(Number(row.calories_consumed), 52.8);
    assert.equal(row.protein_consumed, null);
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false); set role authenticated`);
    assert.equal((await db.query("select * from public.food_consumption")).rows.length, 0);
    await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false)`);
    assert.equal((await db.query("select * from public.food_consumption")).rows.length, 1);
    for (const query of [
      "delete from public.food_consumption",
      "update public.food_consumption set calories_consumed=0",
      "insert into public.food_consumption default values"
    ]) await assert.rejects(db.exec(query), /permission denied/);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.exec("select * from public.food_consumption"), /permission denied/);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [owner]);
    assert.equal((await db.query("select * from public.food_consumption")).rows.length, 0);
  } finally { await db.close(); }
});

