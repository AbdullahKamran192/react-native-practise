const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const m={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync('src/utils/productValue.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m);
const {coverageGrade,nutritionPerPound,targetCoverage,overallCoverage}=m.exports;
test('coverage thresholds use unrounded percentages',()=>{
 for(const [n,g] of [[0,'E'],[24.99,'E'],[25,'D'],[49.99,'D'],[50,'C'],[74.99,'C'],[75,'B'],[99.99,'B'],[100,'A'],[633,'A']])assert.equal(coverageGrade(n),g);
});
test('budget and targets personalise nutrition grades; overall caps each nutrient',()=>{
 const kcal=nutritionPerPound(380,500,1),protein=nutritionPerPound(13,500,1);
 assert.equal(kcal,1900);assert.equal(protein,65);
 assert.equal(targetCoverage(kcal,1,5000).grade,'D');
 assert.equal(targetCoverage(kcal,3,3000).percentage,190);
 assert.equal(targetCoverage(protein,3,150).percentage,130);
 assert.equal(overallCoverage(190,130),100);
 assert.equal(overallCoverage(500,0),50);
 assert.equal(coverageGrade(overallCoverage(58.9,20)),'D');
 assert.equal(targetCoverage(2500,1,5000).grade,'C');
});
test('missing and invalid inputs stay unknown while zero nutrition is E',()=>{
 for(const p of [null,-1,NaN,Infinity])assert.equal(nutritionPerPound(p,100,1),null);
 for(const p of [0,-1,Infinity])assert.equal(nutritionPerPound(100,100,p),null);
 assert.equal(targetCoverage(null,3,100),null);
 assert.equal(targetCoverage(100,0,100),null);
 assert.equal(targetCoverage(100,3,0),null);
 assert.equal(targetCoverage(0,3,100).grade,'E');
 assert.equal(overallCoverage(100,null),null);
 assert.equal(nutritionPerPound(100,1200,3),nutritionPerPound(100,400,1));
});
