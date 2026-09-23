const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const periodModule = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/mealPeriod.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(periodModule.exports);

function setup(results = [], store = new Map(), options = {}) {
  const calls = [], submissions = [];
  const storage = {
    getItem: async key => store.get(key) ?? null,
    setItem: async (key, value) => { if (options.storageFails) throw new Error("Storage unavailable"); store.set(key,value); },
    removeItem: async key => { store.delete(key); },
  };
  const imports = {
    "@/utils/mealPeriod": periodModule.exports,
    "@react-native-async-storage/async-storage": { __esModule: true, default: storage },
    "@/lib/supabase": { supabase: {
      auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { id: options.user ?? "owner" } }, error: null }) },
      rpc: async (name, args) => {
        assert.equal(name, options.publicMeal ? "log_public_meal" : "log_food_consumption");
        assert.ok(store.size > 0, "Persist retry request before sending");
        calls.push(args);
        return results.shift();
      },
    } },
    "@/api/products": { saveBarcodeProduct: async submission => { submissions.push(submission); } },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/api/consumption/index.ts"),"utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("require","module","exports",code)(name => {
    assert.ok(name in imports, "Unexpected import " + name);
    return imports[name];
  }, module, module.exports);
  return { api: module.exports, calls, submissions, store };
}
const food = { mealPeriod: "Breakfast", genericProductId: "1", amount: 20, unit: "g", consumedOn: "2026-09-12", removeFromPantry: true };
const success = () => ({ data: [{ id: 1, product_name_snapshot: "Oats", consumed_on: food.consumedOn }], error: null });

test("generic food sends references/date/amount/checkbox, not client nutrition totals", async () => {
  const db = setup([success()]);
  await db.api.logConsumption("generic:1", { ...food, removeFromPantry: false });
  assert.equal(db.calls[0].p_remove_from_pantry, false);
  assert.equal(db.calls[0].p_amount, 20);
  assert.equal(db.calls[0].p_meal_period, "Breakfast");
  assert.equal(db.calls[0].p_generic_product_id, "1");
  assert.equal(db.calls[0].p_consumed_on, food.consumedOn);
  assert.equal(db.calls[0].p_meal_id, null);
  assert.equal(db.submissions.length, 0);
  assert.equal(db.store.size, 0);
});

test("meal request sends meal/date/checkbox only", async () => {
  const db = setup([success()]);
  await db.api.logConsumption("meal:1", { mealId: "1", consumedOn: food.consumedOn, removeFromPantry: true });
  assert.equal(db.calls[0].p_meal_id, "1");
  assert.equal(db.calls[0].p_amount, null);
  assert.equal(db.calls[0].p_product_barcode, null);
  assert.equal(db.calls[0].p_remove_from_pantry, true);
});

test("timeout and app restart reuse original group and all original choices", async () => {
  const first = setup([{ error: { message: "Timeout", code: "network" } }]);
  await assert.rejects(first.api.logConsumption("generic:1", food), /Timeout/);
  const second = setup([success()], first.store);
  assert.equal((await second.api.getPendingLog("generic:1")).input.amount, 20);
  await second.api.logConsumption("generic:1", { ...food, amount: 999, mealPeriod: "Dinner", removeFromPantry: false });
  assert.deepEqual(second.calls[0], first.calls[0]);
  assert.equal(second.store.size, 0);
});

test("a second intentional log gets a new group; simultaneous calls reuse one request", async () => {
  const db = setup([success(),success()]);
  await Promise.all([db.api.logConsumption("generic:1", food), db.api.logConsumption("generic:1", food)]);
  assert.equal(db.calls.length, 1);
  await db.api.logConsumption("generic:1", food);
  assert.notEqual(db.calls[0].p_group_id, db.calls[1].p_group_id);
});

test("barcode catalogue save precedes log and is not repeated on uncertain retry", async () => {
  const db = setup([{ error: { message: "Timeout", code: "network" } }, success()]);
  const submission = { barcode_number: "123", product_name: "Milk" };
  const barcode = { amount: 50, unit: "ml", consumedOn: food.consumedOn, removeFromPantry: true, barcode: "123", submission, brand: "Brand" };
  await assert.rejects(db.api.logConsumption("barcode:123", barcode));
  await db.api.logConsumption("barcode:123");
  assert.equal(db.submissions.length, 1);
  assert.equal(db.calls[0].p_brand, "Brand");
});

test("invalid amount, signed-out and failed persistence never send a deduction", async () => {
  const db = setup([]);
  for (const amount of [0,-1,NaN,Infinity,0.0001,1e9]) {
    await assert.rejects(db.api.logConsumption("generic:1", {...food, amount}));
  }
  assert.equal(db.calls.length, 0);
  const signedOut = setup([], new Map(), { signedOut: true });
  await assert.rejects(signedOut.api.logConsumption("generic:1",food), /Sign in/);
  const broken = setup([], new Map(), { storageFails: true });
  await assert.rejects(broken.api.logConsumption("generic:1",food), /Storage unavailable/);
  assert.equal(broken.calls.length, 0);
});

test("definitive SQL rejection clears pending; unknown errors keep it", async () => {
  for (const code of ["22023","23514","42501","PGRST202"]) {
    const db = setup([{ error: { code, message: "Rejected" } }]);
    await assert.rejects(db.api.logConsumption("generic:1",food));
    assert.equal(db.store.size, 0);
  }
});

test("local date uses the device calendar, not UTC conversion", () => {
  assert.equal(setup().api.localDate(new Date(2026,0,2,0,1)), "2026-01-02");
});


test("local time defaults at every meal period boundary", () => {
  const defaults = periodModule.exports;
  for (const [hour,minute,period] of [[4,59,'Snack'],[5,0,'Breakfast'],[10,59,'Breakfast'],[11,0,'Lunch'],[14,59,'Lunch'],[15,0,'Snack'],[16,59,'Snack'],[17,0,'Dinner'],[21,59,'Dinner'],[22,0,'Snack'],[0,0,'Snack']]) {
    assert.equal(defaults.defaultMealPeriod(new Date(2026,8,16,hour,minute)),period);
  }
});
test("invalid meal period is rejected before logging", async () => {
  const db = setup([]);
  await assert.rejects(db.api.logConsumption('generic:1', {...food, mealPeriod: 'Brunch'}), /meal period/);
  assert.equal(db.calls.length, 0);
});

test("public recipe retry preserves selections, date and pantry choice", async () => {
  const input={publicMealId:'8',items:[{ingredient_id:1,product_barcode:'123',generic_product_id:null,amount:30},{ingredient_id:2,product_barcode:null,generic_product_id:4,amount:100}],consumedOn:food.consumedOn,mealPeriod:'Lunch',removeFromPantry:true};
  const first=setup([{error:{message:'Timeout',code:'network'}}],new Map(),{publicMeal:true});
  await assert.rejects(first.api.logConsumption('public-meal:8',input),/Timeout/);
  const second=setup([success()],first.store,{publicMeal:true});
  await second.api.logConsumption('public-meal:8',{...input,items:[],removeFromPantry:false});
  assert.deepEqual(second.calls[0],first.calls[0]);
  assert.equal("p_servings" in second.calls[0],false);
  assert.deepEqual(second.calls[0].p_items,input.items);
  assert.equal(second.submissions.length,0);
});
