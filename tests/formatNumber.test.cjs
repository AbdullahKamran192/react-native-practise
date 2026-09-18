const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const m={exports:{}};
new Function('exports','module',ts.transpileModule(fs.readFileSync('src/utils/formatNumber.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m);
test('display numbers have at most one decimal with no trailing zero',()=>{
 for(const [value,expected] of [[12.6666666666667,'12.7'],[12,'12'],[12.0,'12'],['1000.250','1,000.3'],[0,'0'],[-0.01,'0'],[null,'—'],['','—'],[Infinity,'—'],['12,66','12.7']]){
   assert.equal(m.exports.formatNumber(value),expected);
 }
 const amount=12.6666666666667;m.exports.formatNumber(amount);assert.equal(amount,12.6666666666667);
});
