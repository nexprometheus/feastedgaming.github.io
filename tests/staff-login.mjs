import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('assets/staff-login.js',root),'utf8');
const page=await readFile(new URL('crew-access.html',root),'utf8');
assert.match(page,/noindex, nofollow, noarchive/);
for(const file of (await readdir(root)).filter(file=>file.endsWith('.html')&&file!=='crew-access.html')) {
 assert.ok(!(await readFile(new URL(file,root),'utf8')).includes('crew-access.html'),`${file} must not advertise the staff entrance`);
}
assert.ok(!(await readFile(new URL('sitemap.xml',root),'utf8')).includes('crew-access.html'));
const shortcut=await readFile(new URL('assets/staff-shortcut.js',root),'utf8');
const shortcutNavigations=[];
let shortcutTime=0, shortcutClick;
vm.runInNewContext(shortcut,{
 document:{querySelector:()=>({addEventListener:(type,handler)=>{assert.equal(type,'click');shortcutClick=handler;}})},
 Date:{now:()=>shortcutTime},window:{location:{assign:url=>shortcutNavigations.push(url)}}
});
let prevented=0;
const clickLogo=()=>shortcutClick({preventDefault(){prevented++;}});
for(let i=0;i<4;i++){clickLogo();shortcutTime+=500;}
assert.equal(shortcutNavigations.length,0,'Normal logo clicks retain home navigation');
assert.equal(prevented,0);
clickLogo();
assert.equal(shortcutNavigations[0],'crew-access.html');
assert.equal(prevented,1);
clickLogo();shortcutTime+=7000;
for(let i=0;i<4;i++)clickLogo();
assert.equal(shortcutNavigations.length,1,'Old clicks expire');
clickLogo();
assert.equal(shortcutNavigations.length,2);
async function attempt(role,{authFailure=false,roleFailure=false}={}){
 const nodes=Object.fromEntries(['staffLoginForm','staffLoginButton','staffLoginStatus','staffEmail','staffPassword'].map(id=>[id,{value:'',disabled:false,textContent:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}}]));
 nodes.staffEmail.value='staff@example.test';nodes.staffPassword.value='test-only-password';
 const saved=new Map([['existing','preserved']]);const navigations=[];const calls=[];
 vm.runInNewContext(source,{
  document:{getElementById:id=>nodes[id]},Date,
  window:{FEASTED_SUPABASE:{url:'https://example.supabase.co',anonKey:'public-test-key'},location:{replace:target=>navigations.push(target)}},
  sessionStorage:{setItem:(key,value)=>saved.set(key,value)},
  fetch:async(url,options)=>{calls.push({url,options});const isAuth=url.includes('/token?');const isRole=url.includes('get_championship_role');return{ok:!(isAuth&&authFailure)&&!(isRole&&roleFailure),json:async()=>isAuth?{access_token:'fixture-token',user:{id:'fixture-user'},expires_in:3600}:isRole?role:null};}
 });
 await nodes.staffLoginForm.handlers.submit({preventDefault(){}});
 return{nodes,saved,navigations,calls};
}
for(const role of ['staff','admin']){
 const result=await attempt(role);
 assert.equal(result.navigations[0],'championship.html#staff');
 assert.equal(JSON.parse(result.saved.get('feastedSupabaseSessionV1')).user.id,'fixture-user');
 assert.ok(result.calls.find(call=>call.url.includes('get_championship_role')).options.headers.Authorization==='Bearer fixture-token');
 assert.equal(result.nodes.staffPassword.value,'');
}
for(const options of [{},{authFailure:true},{roleFailure:true}]){
 const result=await attempt(null,options);
 assert.equal(result.navigations.length,0);
 assert.equal(result.saved.has('feastedSupabaseSessionV1'),false);
 assert.equal(result.saved.get('existing'),'preserved');
 assert.equal(result.nodes.staffPassword.value,'');
 if(!options.authFailure)assert.ok(result.calls.some(call=>call.url.includes('/logout?scope=local')));
}
console.log('PASS: unlisted staff entrance, server-confirmed staff/admin access, player/error denial and rejected-session cleanup.');
