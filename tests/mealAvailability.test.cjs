const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const api = {};
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/mealAvailability.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(api);
const ingredient = (id, amount=100) => ({product_barcode:null,generic_product_id:id,amount});
const stock = (id, amount) => ({product_barcode:null,generic_product_id:id,amount_remaining:amount});
test('four complete ingredients out of five gives 80 percent', () => {
  const result = api.mealAvailability([1,2,3,4,5].map(id=>ingredient(id)), [1,2,3,4].map(id=>stock(id,100)));
  assert.deepEqual(result, {available:4,total:5,progress:0.8});
});
test('partial, missing and excess amounts use required recipe quantity', () => {
  assert.equal(api.ingredientAvailability(ingredient(1),[stock(1,50)]),0.5);
  assert.equal(api.ingredientAvailability(ingredient(1),[]),0);
  assert.equal(api.ingredientAvailability(ingredient(1),[stock(1,200)]),1);
  assert.equal(api.mealAvailability([ingredient(1)],[stock(1,99)]).available,0);
  assert.equal(api.mealAvailability([],[]).progress,0);
});
test('barcode and generic identities stay distinct; invalid amounts do not count', () => {
  assert.equal(api.ingredientAvailability(ingredient(1),[{product_barcode:'1',generic_product_id:null,amount_remaining:100}]),0);
  assert.equal(api.ingredientAvailability({product_barcode:'1',generic_product_id:null,amount:200},[{product_barcode:'1',generic_product_id:null,amount_remaining:50}]),0.25);
  assert.equal(api.ingredientAvailability(ingredient(1),[stock(1,NaN),stock(1,-2)]),0);
  assert.equal(api.ingredientAvailability(ingredient(1,0),[stock(1,100)]),0);
});
