const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('supabase/functions/delete-account/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({authenticated=true,failStorage=false,failAuth=false}={}){
 let handler;const calls=[];
 class ListObjectsV2Command{constructor(input){this.input=input;}}
 class DeleteObjectCommand{constructor(input){this.input=input;}}
 class S3Client{async send(command){
  calls.push(command);
  if(failStorage)throw Object.assign(new Error('secret should not be logged'),{name:'AccessDenied'});
  if(command instanceof ListObjectsV2Command){
   const next=command.input.ContinuationToken;
   return {Contents:[{Key:command.input.Prefix+(next?'second.webp':'first.webp')}],IsTruncated:!next,NextContinuationToken:next?undefined:'page2'};
  }
  return {};
 }}
 vm.runInNewContext(code,{exports:{},Response,console:{error:()=>{}},
  Deno:{env:{get:()=> 'secret'},serve:fn=>handler=fn},
  require:name=>name.includes('supabase')?{createClient:()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null}}),admin:{deleteUser:async(...args)=>{calls.push(args);return {error:failAuth?{code:'DB_ERROR'}:null};}}}})}:{S3Client,ListObjectsV2Command,DeleteObjectCommand}
 });
 const request=(body={confirmation:'DELETE',userId:'victim'})=>handler(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify(body)}));
 return {request,calls};
}
test('authenticated confirmed deletion cleans both owner prefixes across pages before hard deletion',async()=>{
 const h=harness();assert.equal((await h.request()).status,200);
 assert.deepEqual(h.calls.at(-1),['owner',false]);
 assert.equal(h.calls.filter(c=>c.input?.Key).length,4);
 assert.ok(h.calls.slice(0,-1).every(c=>c.input.Bucket==='foodworth-private-images'&&(c.input.Prefix??c.input.Key).includes('/owner/')));
});
test('invalid session or missing confirmation never touches storage or auth deletion',async()=>{
 const a=harness({authenticated:false});assert.equal((await a.request()).status,401);assert.equal(a.calls.length,0);
 const b=harness();assert.equal((await b.request({confirmation:'no'})).status,400);assert.equal(b.calls.length,0);
});
test('storage failure preserves auth account and database failure does not claim success',async()=>{
 const a=harness({failStorage:true});assert.equal((await a.request()).status,500);assert.ok(a.calls.every(c=>!Array.isArray(c)));
 const b=harness({failAuth:true});const response=await b.request();assert.equal(response.status,500);assert.equal((await response.json()).deleted,undefined);
});
