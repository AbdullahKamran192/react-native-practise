const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');
function api(type='success',platform='ios',failed=false){
 const calls=[];const m={exports:{}};
 const deps={
 'react-native':{Platform:{OS:platform}},
 'expo-linking':{createURL:()=> 'myapp://auth-callback'},
 'expo-web-browser':{openAuthSessionAsync:async(...args)=>{calls.push(['browser',...args]);return {type,url:'myapp://auth-callback#access_token=a&refresh_token=b'};}},
 '@/lib/supabase':{supabase:{auth:{
 signInWithOAuth:async input=>{calls.push(['start',input]);return {data:{url:'https://provider.example'},error:failed?new Error('Provider disabled'):null};},
 setSession:async input=>{calls.push(['session',input]);return {error:null};}
 }}}
 };
 new Function('require','module','exports','window',ts.transpileModule(fs.readFileSync('src/api/socialAuth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>deps[n],m,m.exports,{location:{assign:url=>calls.push(['redirect',url])}});
 return {...m.exports,calls};
}
test('both providers request an auth session and finish mobile callback',async()=>{
 for(const provider of ['google','apple']){
 const a=api();await a.signInWithProvider(provider);
 assert.equal(a.calls[0][1].provider,provider);assert.equal(a.calls[0][1].options.redirectTo,'myapp://auth-callback');
 assert.deepEqual(a.calls.at(-1),['session',{access_token:'a',refresh_token:'b'}]);
 await a.completeSocialSignIn('myapp://auth-callback#access_token=a&refresh_token=b');
 assert.equal(a.calls.filter(c=>c[0]==='session').length,1);
 }
});
test('cancellation and disabled providers never establish a session',async()=>{
 const a=api('cancel');await a.signInWithProvider('google');assert.ok(!a.calls.some(c=>c[0]==='session'));
 const b=api('success','ios',true);await assert.rejects(b.signInWithProvider('apple'),/disabled/);assert.equal(b.calls.length,1);
});
test('web redirects; invalid and recovery callbacks cannot become social logins',async()=>{
 const a=api('success','web');await a.signInWithProvider('google');assert.deepEqual(a.calls.at(-1),['redirect','https://provider.example']);
 for(const url of ['myapp://auth-callback','myapp://auth-callback#error=access_denied','myapp://auth-callback#type=recovery&access_token=a&refresh_token=b'])await assert.rejects(a.completeSocialSignIn(url));
 assert.ok(!a.calls.some(c=>c[0]==='session'));
});
