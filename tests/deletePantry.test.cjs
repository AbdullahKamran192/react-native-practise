const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function setup({ user = { id: 'owner' }, data = { id: 42 }, error = null } = {}) {
  const calls = [];
  const query = {
    delete() { calls.push(['delete']); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    select(...args) { calls.push(['select', ...args]); return this; },
    async maybeSingle() { return { data, error }; },
  };
  const supabase = {
    auth: { async getUser() { return { data: { user }, error: null }; } },
    from(table) { calls.push(['from', table]); return query; },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/api/products/pantryDetails.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '@/lib/supabase') return { supabase };
    if (name === '@/utils/pantryAmounts') return {};
    throw new Error(name);
  }, module, module.exports);
  return { remove: module.exports.deletePantryItem, calls };
}

test('deletion targets only the selected pantry row and authenticated owner', async () => {
  const { remove, calls } = setup();
  await remove(42);
  assert.deepEqual(calls, [['from', 'pantry'], ['delete'], ['eq', 'id', 42], ['eq', 'user_id', 'owner'], ['select', 'id']]);
});

test('invalid IDs and signed-out users cannot issue a deletion', async () => {
  for (const id of [0, -1, 1.5, NaN]) {
    const api = setup();
    await assert.rejects(api.remove(id));
    assert.equal(api.calls.length, 0);
  }
  const api = setup({ user: null });
  await assert.rejects(api.remove(42), /Sign in/);
  assert.equal(api.calls.length, 0);
});

test('database errors and zero deleted rows are not reported as success', async () => {
  await assert.rejects(setup({ error: { message: 'Permission denied' } }).remove(42), /Permission denied/);
  await assert.rejects(setup({ data: null }).remove(42), /could not be deleted/);
});
