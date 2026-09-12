const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function setup(result) {
  const calls = [];
  const module = { exports: {} };
  const imports = {
    "@/lib/supabase": { supabase: { rpc: (name, args) => {
      calls.push({ name, args });
      return { single: async () => result };
    } } },
    "./validation": { validateMealId: (id) => { if (!/^[1-9]\d*$/.test(id)) throw new Error("Invalid meal"); } },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/api/meals/consumption.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("require", "module", "exports", code)((name) => {
    assert.ok(name in imports, "Unexpected dependency: " + name);
    return imports[name];
  }, module, module.exports);
  return { api: module.exports, calls };
}

test("consuming only sends a meal ID to the pantry function", async () => {
  const result = { pantry_items_deducted: 2, pantry_items_exhausted: 1, pantry_items_short: 1 };
  const db = setup({ data: result, error: null });
  assert.deepEqual(await db.api.consumeMeal("1"), result);
  assert.deepEqual(db.calls, [{ name: "consume_meal_from_pantry", args: { p_meal_id: "1" } }]);
});

test("invalid IDs do not send a request", async () => {
  const db = setup({});
  await assert.rejects(db.api.consumeMeal("abc"), /Invalid meal/);
  assert.equal(db.calls.length, 0);
});

test("errors do not automatically repeat a pantry deduction", async () => {
  const db = setup({ error: { code: "network", message: "Connection interrupted" } });
  await assert.rejects(db.api.consumeMeal("1"), /Connection interrupted/);
  assert.equal(db.calls.length, 1);
});

test("missing function reports the pantry-only setup file", async () => {
  const db = setup({ error: { code: "PGRST202" } });
  await assert.rejects(db.api.consumeMeal("1"), /20260912_consume_meal_from_pantry.sql/);
});
