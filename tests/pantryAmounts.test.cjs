const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Load the app's TypeScript using its existing compiler; no React Native
// runtime or live database is needed for these storage-operation tests.
function loadSource(file, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}

const amounts = loadSource("src/utils/pantryAmounts.ts", {
  "@/api/products/productLookup/utils": loadSource("src/api/products/productLookup/utils.ts"),
});

test("amount selection defaults to one package and supports multiple or custom amounts", () => {
  assert.equal(amounts.resolvePantryAddition({ mode: "quantity", value: "1" }, 400), 400);
  assert.equal(amounts.resolvePantryAddition({ mode: "quantity", value: "3" }, 400), 1200);
  assert.equal(amounts.resolvePantryAddition({ mode: "quantity", value: "3" }, 50), 150);
  assert.equal(amounts.resolvePantryAddition({ mode: "quantity", value: "2.8" }, 50), 140);
  assert.equal(amounts.resolvePantryAddition({ mode: "amount", value: "175,5" }, 400), 175.5);
  assert.equal(amounts.resolvePantryAddition({ mode: "amount", value: "175" }, null), 175);
  assert.equal(amounts.resolvePantryAddition({ mode: "quantity", value: "1" }, null), null);
  for (const value of ["", "0", "-1", "abc", "0.0001", "100000001"]) {
    assert.equal(amounts.resolvePantryAddition({ mode: "amount", value }, 400), null);
  }
});

test("quantity is derived from remaining amount for eggs, bottles and cans", () => {
  for (const [remaining, size, generic, expected] of [
    [140, 50, true, 2.8], [450, 500, false, 0.9], [435, 145, false, 3],
  ]) {
    const item = {
      amount_remaining: remaining,
      product: generic ? null : { product_amount: size },
      generic_product: generic ? { default_amount: size } : null,
    };
    assert.equal(amounts.getPantryAmounts(item).quantity, expected);
    assert.equal(amounts.formatPantryQuantity(expected), String(expected));
  }
});

test("missing package size does not hide remaining amount", () => {
  const result = amounts.getPantryAmounts({
    amount_remaining: "140.000", product: { product_amount: null },
    generic_product: null,
  });
  assert.equal(result.amountRemaining, 140);
  assert.equal(result.quantity, null);
});

test("amount validation and precision match the migrated numeric column", () => {
  for (const value of [0, -1, NaN, Infinity, 100000001, 0.0001]) {
    assert.throws(() => amounts.validatePantryAddition(value));
  }
  assert.equal(amounts.addPantryAmounts(0.1, 0.2), 0.3);
  assert.equal(amounts.addPantryAmounts(140, 50), 190);
  assert.equal(amounts.addPantryAmounts(99999999, 1), 100000000);
  assert.throws(() => amounts.addPantryAmounts(100000000, 0.001));
  assert.equal(amounts.formatPantryQuantity(1 / 3), "0.333");
  assert.equal(amounts.formatPantryQuantity(0.00001), "<0.001");
});

function storage(initial, options = {}) {
  let row = initial === null ? null : { id: 1, amount_remaining: initial };
  const writes = [];
  let raced = false;
  const client = {
    from(table) {
      assert.equal(table, "pantry");
      let operation = "read";
      let payload;
      const filters = {};
      const query = {
        select(columns) { assert.ok(!columns.includes("quantity")); return query; },
        eq(column, value) { filters[column] = value; return query; },
        update(value) { operation = "update"; payload = value; return query; },
        insert(value) { operation = "insert"; payload = value; return query; },
        maybeSingle: finish,
        single: finish,
      };
      async function finish() {
        if (operation === "read") {
          assert.equal(filters.user_id, "user-1");
          return { data: row ? { ...row } : null, error: null };
        }
        writes.push({ operation, payload, filters });
        assert.ok(!("quantity" in payload));
        if (options.error) return { data: null, error: options.error };
        if (!raced && options.race) {
          raced = true;
          row = { id: 1, amount_remaining: 200 };
        }
        if (operation === "insert") {
          if (row) return { data: null, error: { code: "23505" } };
          row = { id: 1, ...payload };
        } else {
          if (options.alwaysConflict || filters.amount_remaining !== row?.amount_remaining) {
            return { data: null, error: null };
          }
          assert.equal(filters.user_id, "user-1");
          assert.equal(filters.id, row.id);
          row = { ...row, ...payload };
        }
        return { data: { ...row }, error: null };
      }
      return query;
    },
  };
  const { addPantryAmount } = loadSource("src/api/products/addPantryAmount.ts", {
    "@/lib/supabase": { supabase: client },
    "@/utils/pantryAmounts": amounts,
  });
  return { addPantryAmount, writes, getRow: () => row };
}

const generic = { product_barcode: null, generic_product_id: 2 };
const barcode = { product_barcode: "12345678", generic_product_id: null };

test("both add-product mutations pass custom totals without changing catalogue package sizes", async () => {
  const additions = [];
  const corrections = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from(table) {
      const result = {
        data: table === "products"
          ? { barcode_number: "12345678", measurement_unit: "g" }
          : table === "generic_products"
            ? { id: 2, default_amount: 50, measurement_unit: "g" }
            : null,
        error: null,
      };
      const query = {
        select() { return query; },
        eq() { return query; },
        maybeSingle: async () => result,
        single: async () => result,
        upsert: async (value) => { corrections.push(value); return { error: null }; },
      };
      return query;
    },
  };
  const api = loadSource("src/api/products/index.ts", {
    "@tanstack/react-query": { useMutation: (options) => options, useQueryClient: () => ({}) },
    "@/lib/supabase": { supabase: client },
    "@/utils/pantryAmounts": amounts,
    "./addPantryAmount": {
      addPantryAmount: async (user, product, amount) => {
        additions.push({ user, product, amount });
        return amount;
      },
    },
  });
  const packaged = api.useAddProductToPantry();
  const submission = {
    barcode_number: "12345678", product_name: "Beans", product_amount: 400,
    measurement_unit: "g", calories_per_100: 90, protein_per_100: 5,
    carbs_per_100: null, fat_per_100: null, sugars_per_100: null,
    salt_per_100: null, fibre_per_100: null,
  };
  assert.equal((await packaged.mutationFn({ ...submission, amountToAdd: 1200 })).amount_remaining, 1200);
  assert.equal((await packaged.mutationFn(submission)).amount_remaining, 400);
  assert.ok(corrections.every((value) => value.product_amount === 400 && !("amountToAdd" in value)));
  const genericMutation = api.useAddGenericProductToPantry();
  assert.equal((await genericMutation.mutationFn({ genericProductId: 2, amountToAdd: 140 })).amount_remaining, 140);
  assert.equal((await genericMutation.mutationFn({ genericProductId: 2 })).amount_remaining, 50);
  assert.deepEqual(additions.map((entry) => entry.amount), [1200, 400, 140, 50]);
});

test("new barcode and generic rows contain amount_remaining and no quantity", async () => {
  for (const product of [generic, barcode]) {
    const db = storage(null);
    assert.equal(await db.addPantryAmount("user-1", product, 50), 50);
    assert.deepEqual(db.writes[0].payload, {
      user_id: "user-1", ...product, amount_remaining: 50,
    });
  }
});

test("adding an egg to a partially consumed stock adds 50g", async () => {
  const db = storage(140);
  assert.equal(await db.addPantryAmount("user-1", generic, 50), 190);
});

test("concurrent updates and inserts preserve the other addition", async () => {
  for (const initial of [null, 140]) {
    const db = storage(initial, { race: true });
    assert.equal(await db.addPantryAmount("user-1", generic, 50), 250);
    assert.equal(db.getRow().amount_remaining, 250);
    assert.equal(db.writes.length, 2);
  }
});

test("database errors and repeated conflicts do not report success", async () => {
  const denied = storage(140, { error: { code: "42501", message: "Permission denied" } });
  await assert.rejects(denied.addPantryAmount("user-1", generic, 50), /Permission denied/);
  const busy = storage(140, { alwaysConflict: true });
  await assert.rejects(busy.addPantryAmount("user-1", generic, 50), /Please try again/);
  assert.equal(busy.writes.length, 5);
});
