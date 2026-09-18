const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const m={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync('src/utils/shoppingSpending.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m);
const {spendingSeries}=m.exports;
test('midyear tracking compares spending and budget for the same days',()=>{
 const r=spendingSeries([{completed_at:'2026-09-18T12:00:00',total_spent:10.12},{completed_at:'2026-09-19T12:00:00',total_spent:4.21}], '2026-09-18T12:00:00',3,new Date(2026,8,20));
 assert.equal(r.days,3);assert.equal(r.expected,9);assert.equal(r.spent,14.33);
 assert.equal(r.points.at(-1).spent,14.33);
});
test('existing tracking restarts the year budget on January 1, including leap days',()=>{
 const r=spendingSeries([], '2023-10-01T12:00:00',2,new Date(2024,1,29));
 assert.equal(r.days,60);assert.equal(r.expected,120);assert.equal(r.spent,0);
 assert.equal(spendingSeries([],null,3),null);
 assert.equal(spendingSeries([],'2026-09-18T12:00:00',0,new Date(2026,8,18)).expected,0);
});
