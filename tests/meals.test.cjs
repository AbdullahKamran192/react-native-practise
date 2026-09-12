const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", code)((name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}

const validation = load("src/api/meals/validation.ts");

test("recipe validation follows schema lengths, amounts and route IDs", () => {
  assert.deepEqual(validation.validateMeal({ meal_name: " Smoothie ", description: " ", instructions: " Blend " }), {
    meal_name: "Smoothie", description: null, instructions: "Blend",
  });
  for (const values of [
    { meal_name: " " }, { meal_name: "a".repeat(101) },
    { meal_name: "Meal", description: "a".repeat(501) },
    { meal_name: "Meal", instructions: "a".repeat(5001) },
  ]) assert.throws(() => validation.validateMeal(values));
  for (const amount of [0, -1, NaN, Infinity, 100000.001, 0.0001]) assert.throws(() => validation.validateMealAmount(amount));
  assert.equal(validation.validateMealAmount(12.3456), 12.346);
  for (const id of ["", "-1", "1.5", "abc"]) assert.throws(() => validation.validateMealId(id));
});

test("whole-meal nutrition combines gram and millilitre ingredients and flags missing data", () => {
  const nutrition = validation.getMealNutrition([
    { amount: 50, product: { calories_per_100: 400, protein_per_100: 10 }, generic_product: null },
    { amount: 200, product: null, generic_product: { calories_per_100: 60, protein_per_100: 3 } },
  ]);
  assert.equal(nutrition.totals.calories, 320);
  assert.equal(nutrition.totals.protein, 11);
  assert.equal(nutrition.incomplete, true);
  assert.equal(validation.getMealNutrition([]).totals.calories, 0);
});

function mockOperations(steps, signedIn = true) {
  let index = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "owner" } : null }, error: null }) },
    from(table) {
      const calls = [];
      const query = {};
      for (const method of ["select", "insert", "update", "delete", "eq", "order"]) {
        query[method] = (...args) => { calls.push([method, ...args]); return query; };
      }
      async function finish() {
        const step = steps[index++];
        assert.ok(step, `Unexpected database request to ${table}`);
        assert.equal(table, step.table);
        step.check?.(calls);
        return { data: null, error: null, ...step.result };
      }
      query.single = finish;
      query.maybeSingle = finish;
      query.then = (resolve, reject) => finish().then(resolve, reject);
      return query;
    },
  };
  return {
    api: load("src/api/meals/operations.ts", { "@/lib/supabase": { supabase: client }, "./validation": validation }),
    done: () => assert.equal(index, steps.length),
  };
}

const meal = (items = []) => ({ id: 1, meal_name: "Meal", user_id: "owner", items });
const ingredient = (amount = 50) => ({ id: 2, meal_id: 1, amount, product_barcode: null, generic_product_id: 5, created_at: "2026-09-12" });
const input = { mealId: "1", amount: 20, product_barcode: null, generic_product_id: 5 };
const owns = (calls) => assert.ok(calls.some(([method, column, value]) => method === "eq" && column === "user_id" && value === "owner"));

test("meal reads and creation are scoped to the current user", async () => {
  const db = mockOperations([
    { table: "meals", check: owns, result: { data: [] } },
    { table: "meals", check: owns, result: { count: 0 } },
    { table: "meals", check: (calls) => {
      assert.deepEqual(calls.find(([name]) => name === "insert")[1], { meal_name: "Soup", description: null, instructions: null, user_id: "owner" });
    }, result: { data: meal() } },
  ]);
  await db.api.getMeals();
  await db.api.createMeal({ meal_name: " Soup ", description: null, instructions: null });
  db.done();
});

test("meal limit and duplicate name errors are friendly", async () => {
  const full = mockOperations([{ table: "meals", result: { count: 10 } }]);
  await assert.rejects(full.api.createMeal({ meal_name: "Meal" }), /maximum of 10/);
  full.done();
  const duplicate = mockOperations([
    { table: "meals", result: { count: 1 } },
    { table: "meals", result: { error: { code: "23505", message: "constraint error" } } },
  ]);
  await assert.rejects(duplicate.api.createMeal({ meal_name: "Meal" }), /already have a meal/);
  duplicate.done();
});

test("new ingredient uses a relational reference and never writes pantry stock", async () => {
  for (const reference of [input, { ...input, product_barcode: "12345678", generic_product_id: null }]) {
    const db = mockOperations([
      { table: "meals", check: owns, result: { data: meal() } },
      { table: "meal_items", check: (calls) => {
        assert.deepEqual(calls.find(([name]) => name === "insert")[1], {
          meal_id: "1", amount: 20, product_barcode: reference.product_barcode, generic_product_id: reference.generic_product_id,
        });
      } },
    ]);
    await db.api.addMealItem(reference);
    db.done();
  }
});

test("duplicate ingredients increase amount even at the 50-item limit", async () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ ...ingredient(), id: i + 1, generic_product_id: i + 5 }));
  const db = mockOperations([
    { table: "meals", result: { data: meal(items) } },
    { table: "meal_items", check: (calls) => assert.deepEqual(calls.find(([method]) => method === "update")[1], { amount: 70 }), result: { data: { id: 1 } } },
  ]);
  await db.api.addMealItem(input);
  db.done();
  const full = mockOperations([{ table: "meals", result: { data: meal(items) } }]);
  await assert.rejects(full.api.addMealItem({ ...input, generic_product_id: 999 }), /maximum of 50/);
  full.done();
});

test("concurrent ingredient insert retries and merges the new row", async () => {
  const db = mockOperations([
    { table: "meals", result: { data: meal() } },
    { table: "meal_items", result: { error: { code: "23505" } } },
    { table: "meals", result: { data: meal([ingredient()]) } },
    { table: "meal_items", check: (calls) => assert.deepEqual(calls.find(([method]) => method === "update")[1], { amount: 70 }), result: { data: { id: 2 } } },
  ]);
  await db.api.addMealItem(input);
  db.done();
});

test("edits replace ingredient amount and deletes target the parent meal", async () => {
  const db = mockOperations([
    { table: "meal_items", check: (calls) => {
      assert.deepEqual(calls.find(([method]) => method === "update")[1], { amount: 15 });
      assert.ok(calls.some(([method, key, value]) => method === "eq" && key === "meal_id" && value === "1"));
    }, result: { data: { id: 2 } } },
    { table: "meal_items", check: (calls) => assert.ok(calls.some(([method, key]) => method === "eq" && key === "meal_id")) },
    { table: "meals", check: owns },
  ]);
  await db.api.updateMealItemAmount("1", 2, 15);
  await db.api.removeMealItem("1", 2);
  await db.api.deleteMeal("1");
  db.done();
});

test("signed-out requests and invalid product references fail before any database write", async () => {
  const db = mockOperations([], false);
  await assert.rejects(db.api.getMeals(), /Sign in/);
  await assert.rejects(db.api.addMealItem({ ...input, product_barcode: "12345678" }), /exactly one/);
  db.done();
});
