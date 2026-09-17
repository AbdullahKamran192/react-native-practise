const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');

function loadSearch(barcodeCount, genericCount, failTable) {
  const calls = [];
  const source = fs.readFileSync(path.join(__dirname, '../src/api/products/search/searchProducts.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const supabase = { from(table) {
    const call = { table, order: [], range: null, fetched: 0 };
    calls.push(call);
    return {
      select(fields, options) { call.options = options; return this; },
      ilike(field, pattern) { call.pattern = pattern; return this; },
      order(field) { call.order.push(field); return this; },
      range(from, to) { call.range = [from, to]; return this; },
      then(resolve) {
        if (table === failTable) return resolve({ error: { message: 'Search unavailable' } });
        const count = table === 'products' ? barcodeCount : genericCount;
        if (call.options?.head) return resolve({ data: null, count });
        assert.ok(call.range, 'Every row request must have a database range');
        const [from, to] = call.range;
        if (from >= count) return resolve({ error: { code: "PGRST103", message: "Requested range not satisfiable" } });
        assert.ok(to - from + 1 <= 50);
        const data = Array.from({ length: Math.max(0, Math.min(count, to + 1) - from) }, (_, i) => ({
          id: from + i, barcode_number: String(from + i), product_name: 'Same name',
          product_amount: 100, default_amount: 100, measurement_unit: 'g', image_path: null, image_url: null,
        }));
        call.fetched = data.length;
        resolve({ data, count });
      },
    };
  } };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '@/lib/supabase') return { supabase };
    if (name === '@/utils/productImage') return { genericProductImageUrl: () => null, barcodeProductImageUrl: () => null };
    throw new Error(name);
  }, module, module.exports);
  return { ...module.exports, calls };
}

test('combined pages fetch at most 50 rows and cross catalogue boundaries without skipping products', async () => {
  const api = loadSearch(60, 65);
  const all = [];
  for (let page = 0; page < 3; page++) {
    const start = api.calls.length;
    const result = await api.searchProducts(' food ', page);
    assert.equal(result.total, 125);
    assert.equal(result.items.length, page === 2 ? 25 : 50);
    assert.ok(api.calls.slice(start).reduce((sum, c) => sum + c.fetched, 0) <= 50);
    all.push(...result.items.map(item => `${item.source}-${item.id}`));
  }
  assert.equal(new Set(all).size, 125);
  assert.equal(all[59], 'barcode-59');
  assert.equal(all[60], 'generic-0');
  assert.deepEqual(api.calls.find(c => c.table === 'products' && c.range).order, ['product_name', 'barcode_number']);
  assert.deepEqual(api.calls.find(c => c.table === 'generic_products' && c.range).order, ['product_name', 'id']);
  assert.equal(api.calls[0].pattern, '%food%');
});

test('single-catalogue searches still fill pages; empty search fetches nothing', async () => {
  for (const counts of [[0, 101], [101, 0]]) {
    const api = loadSearch(...counts);
    assert.deepEqual(await api.searchProducts(' '), { items: [], total: 0 });
    assert.equal(api.calls.length, 0);
    assert.equal((await api.searchProducts('food', 1)).items.length, 50);
    assert.equal((await api.searchProducts('food', 2)).items.length, 1);
    assert.equal((await api.searchProducts('food', 3)).items.length, 0);
  }
});

test('invalid pages and database failures surface as errors', async () => {
  const api = loadSearch(10, 10);
  await assert.rejects(api.searchProducts('food', -1), /Invalid search page/);
  assert.equal(api.calls.length, 0);
  for (const table of ['products', 'generic_products']) {
    await assert.rejects(loadSearch(10, 10, table).searchProducts('food'), /Search unavailable/);
  }
});

test('generic-only later pages never request exhausted barcode ranges', async () => {
  const api = loadSearch(12, 110);
  const second = await api.searchProducts('h', 1);
  assert.equal(second.items.length, 50);
  assert.equal(second.items[0].id, '38');
  assert.equal(second.items[0].source, 'generic');
  assert.equal(api.calls.filter(c => c.table === 'products' && c.range).length, 0);
  const third = await api.searchProducts('h', 2);
  assert.equal(third.items.length, 22);
  assert.equal(third.items[0].id, '88');
  assert.deepEqual(await api.searchProducts('h', 3), { items: [], total: 122 });
});
