const fs=require('fs'),ts=require('typescript');
const {test}=require('node:test'),assert=require('node:assert/strict');
const mod={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync('src/theme/palette.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {darkColor,darkPalette}=mod.exports;
const luminance=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('white surfaces darken while white filled-button text and shadows are preserved',()=>{
 assert.equal(darkColor('#fff','surface'),darkPalette.surface);
 assert.equal(darkColor('white','surface'),darkPalette.surface);
 assert.equal(darkColor('#fff','text'),'#fff');
 assert.equal(darkColor('#000','shadow'),'#000');
 assert.equal(darkColor('rgba(0,0,0,0.4)','surface'),'rgba(0,0,0,0.4)');
 assert.equal(darkColor('transparent','surface'),'transparent');
});
test('light-theme text and borders gain contrast against dark surfaces',()=>{
 for(const foreground of ['#102739','#222','#617783','#999']) {
  assert.ok(contrast(darkColor(foreground),darkPalette.surface)>=4.5,foreground);
 }
 assert.equal(darkColor('#DCEDEF','border'),darkPalette.tealBorder);
 assert.equal(darkColor('#F3FAFB','surface'),darkPalette.background);
});
test('nutrition and status tones retain readable foregrounds on their tinted surfaces',()=>{
 for(const [foreground,background] of [['#AD510B','#FFF3E2'],['#287C3D','#EAF7EC'],['#1764B1','#EAF4FF'],['#8053AD','#F3EDFC'],['#AF3264','#FDEDF4'],['#426D9C','#ECF3FA'],['#147967','#E4F6F0'],['#BA2436','#FDEBED'],['#705000','#FFF8DB']]){
  assert.ok(contrast(darkColor(foreground),darkColor(background,'surface'))>=4.5,foreground);
 }
});
test('filled primary controls keep readable white labels',()=>{
 const background=darkColor('#007F95','surface');
 assert.equal(background,'#007F95');
 assert.ok(contrast('#FFFFFF',background)>=4.5);
});
