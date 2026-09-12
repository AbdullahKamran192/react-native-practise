const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
function load(file,imports={}) {
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  new Function("require","module","exports",code)(name=>{assert.ok(name in imports);return imports[name];},module,module.exports);
  return module.exports;
}
const h=load("src/utils/consumptionHistory.ts");
function row(overrides={}) {
  return {id:1,consumption_group_id:"one",consumed_on:"2026-09-12",created_at:"2026-09-12T10:00:00Z",
    meal_name_snapshot:null,product_name_snapshot:"Oats",brand_snapshot:null,amount_consumed:50,measurement_unit:"g",
    ...Object.fromEntries(h.nutrients.map(n=>[n+"_consumed",0])),...overrides};
}
test("30 local calendar dates include today and cross month/year/DST boundaries",()=>{
  for(const today of ["2026-01-05","2026-03-30","2026-11-02","2024-03-01"]) {
    const days=h.recentDates(today);
    assert.equal(days.length,30);
    assert.equal(new Set(days).size,30);
    assert.equal(days[0],today);
    assert.ok(days.every(d=>d<=today));
    const expected=h.parseDay(today);expected.setDate(expected.getDate()-29);
    assert.equal(days[29],h.dateKey(expected));
  }
  assert.equal(h.recentDates("2026-01-05")[29],"2025-12-07");
});
test("totals use stored nutrition, accept database numeric strings, preserve missing status",()=>{
  const result=h.summarize([row({calories_consumed:"52.8",protein_consumed:null}),row({calories_consumed:20,protein_consumed:2})]);
  assert.equal(result.totals.calories,72.8);
  assert.equal(result.totals.protein,2);
  assert.equal(result.missing.protein,true);
  assert.equal(result.missing.calories,false);
});
test("meal ingredients group once, deleted meal snapshots survive, repeated meals stay separate",()=>{
  const rows=[row({meal_name_snapshot:"Smoothie",calories_consumed:100}),
    row({id:2,meal_name_snapshot:"Smoothie",calories_consumed:200}),
    row({id:3,consumption_group_id:"two",meal_name_snapshot:"Smoothie",calories_consumed:80,created_at:"2026-09-12T11:00:00Z"}),
    row({id:4,consumption_group_id:"three",calories_consumed:50})];
  const groups=h.groupConsumptions(rows);
  assert.equal(groups.length,3);
  assert.equal(groups[0].totals.calories,80);
  assert.equal(groups.find(g=>g.items.length===2).totals.calories,300);
  assert.equal(h.summarize(rows).totals.calories,430);
  assert.equal(groups.filter(g=>g.isMeal).length,2);
});
test("date score uses the lower completion of both current targets and handles unknowns",()=>{
  for(const [calories,protein,colour] of [[2000,100,"green"],[1500,75,"yellow"],[1000,50,"orange"],[999,100,"red"],[2500,49,"red"]]) {
    assert.equal(h.dayScore([row({calories_consumed:calories,protein_consumed:protein})],2000,100),colour);
  }
  assert.equal(h.dayScore([],2000,100),"neutral");
  assert.equal(h.dayScore([row({protein_consumed:null})],2000,100),"neutral");
  assert.equal(h.dayScore([row()],0,100),"neutral");
  assert.equal(h.dayScore([row({calories_consumed:1000,protein_consumed:100})],1000,100),"green");
});
test("history pagination scopes every page to user and date window",async()=>{
  const calls=[];let page=0;
  const api=load("src/api/consumption/history.ts",{"@/lib/supabase":{supabase:{
    auth:{getUser:async()=>({data:{user:{id:"owner"}},error:null})},
    from(table){
      assert.equal(table,"food_consumption");
      const methods=[];
      const query={};
      for(const method of ["select","eq","gte","lte","order","limit","gt"])
        query[method]=(...args)=>{methods.push([method,...args]);return query;};
      query.then=(resolve,reject)=>{
        calls.push(methods);
        return Promise.resolve({data:page++===0?[row({id:5})]:page===2?[row({id:10})]:[],error:null}).then(resolve,reject);
      };
      return query;
    },
  }}});
  const rows=await api.getConsumptionHistory("2026-08-14","2026-09-12");
  assert.equal(rows.length,2);
  assert.equal(calls.length,3);
  for(const call of calls) {
    assert.ok(call.some(c=>c[0]==="eq"&&c[1]==="user_id"&&c[2]==="owner"));
    assert.ok(call.some(c=>c[0]==="gte"&&c[2]==="2026-08-14"));
    assert.ok(call.some(c=>c[0]==="lte"&&c[2]==="2026-09-12"));
  }
  assert.ok(calls[1].some(c=>c[0]==="gt"&&c[2]===5));
  assert.ok(calls[2].some(c=>c[0]==="gt"&&c[2]===10));
});
test("failed later page rejects the query instead of displaying partial totals",async()=>{
  let page=0;
  const api=load("src/api/consumption/history.ts",{"@/lib/supabase":{supabase:{
    auth:{getUser:async()=>({data:{user:{id:"owner"}},error:null})},
    from(){
      const q={};for(const name of ["select","eq","gte","lte","order","limit","gt"])q[name]=()=>q;
      q.then=(resolve,reject)=>Promise.resolve(page++===0?{data:[row()],error:null}:{data:null,error:{message:"Network error"}}).then(resolve,reject);
      return q;
    },
  }}});
  await assert.rejects(api.getConsumptionHistory("2026-08-14","2026-09-12"),/Network error/);
});

