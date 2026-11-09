import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,readdir,access} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const html=await readFile(new URL('championship.html',root),'utf8');
const source=await readFile(new URL('assets/championship.js',root),'utf8');
const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{id,value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,required:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},reportValidity(){return true;},reset(){}}]));
for(const [,id] of source.matchAll(/getElementById\(["']([^"']+)["']\)/g)) assert.ok(nodes.has(id),`Missing DOM target ${id}`);
const calls=[];const store=new Map();
const future={id:'00000000-0000-4000-8000-000000000001',game:'smash',title:'Future event',starts_at:'2099-01-01T20:00:00Z',location:'Test hall',details:'Bring a deck',status:'scheduled'};
let role=null, calendarAvailable=true;
const context=vm.createContext({
 console, URL, URLSearchParams, Blob, Date, setTimeout, setInterval(){},
 location:{hash:'',pathname:'/championship.html',origin:'https://example.test',search:''},history:{replaceState(){}},
 window:{FEASTED_SUPABASE:{url:'https://example.supabase.co',anonKey:'public-test-key'},confirm(){return true;}},
 confirm(){return true;},
 localStorage:{getItem(){return JSON.stringify({events:[{title:'STALE DEMO'}],registrations:[]});}},
 sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
 document:{getElementById:id=>nodes.get(id),querySelectorAll:()=>[],createElement:()=>({click(){}})},
 fetch:async(url,options={})=>{
  calls.push({url,options}); let payload=[];
  if(url.includes('championship_schedule')) { if(!calendarAvailable)return{ok:false,status:404,text:async()=>'{"message":"missing schema"}'}; payload=[future]; }
  if(url.includes('get_championship_role'))payload=role;
  if(url.includes('championship_announcements'))payload=[{title:'<img onerror=bad()>',body:'<script>bad()</script>',created_at:new Date().toISOString()}];
  return{ok:true,text:async()=>JSON.stringify(payload),json:async()=>payload};
 }
});
vm.runInContext(source,context);
const run=code=>vm.runInContext(code,context);
await new Promise(resolve=>setImmediate(resolve));
await new Promise(resolve=>setImmediate(resolve));
assert.equal(run('data.events.length'),0,'Cloud mode must not show cached demo data');
assert.ok(nodes.get('calendarList').innerHTML.includes('Future event'));
assert.ok(!nodes.get('announcementList').innerHTML.includes('<script>'));
assert.ok(nodes.get('announcementList').innerHTML.includes('&lt;script&gt;'));
assert.equal(run("safeHttpUrl('javascript:alert(1)')"),'');
assert.equal(run("safeHttpUrl('https://example.test/video')"),'https://example.test/video');
run(`data.events=[{game:'smash',results:[{name:'__proto__',place:1},{name:'constructor',place:2}]},{game:'pokemon',results:[{name:'Other',place:1}]}]`);
assert.equal(run("allScores('smash')[0].points"),5);
assert.equal(run("allScores('smash').length"),2);
assert.equal(run("allScores('pokemon')[0].name"),'Other');
assert.ok(run('calendarFile(scheduledEvents[0])').includes('DTSTART:20990101T200000Z'));
assert.equal(run(`icsEscape(${JSON.stringify('a,b;c\nX:bad')})`),'a\\,b\\;c\\nX:bad');
nodes.get('scheduleEvent').value=future.id;
nodes.get('playerName').value='Test Player';
nodes.get('playerNote').value='Deck';
run("saveSession({access_token:'test',user:{id:'player-id'},expires_at:Date.now()/1000+3600})");
await nodes.get('playerForm').handlers.submit({preventDefault(){},target:{reset(){}}});
const registration=calls.find(call=>call.url.endsWith('/player_registrations') && call.options.method==='POST');
assert.equal(JSON.parse(registration.options.body).schedule_id,future.id);
assert.equal(JSON.parse(registration.options.body).user_id,'player-id');
nodes.get('paymentType').value='tournament';nodes.get('paymentItem').value='Test event';nodes.get('paymentAmount').value='5';nodes.get('paymentReference').value='Test transaction';
await nodes.get('paymentForm').handlers.submit({preventDefault(){},target:{reset(){}}});
const payment=calls.find(call=>call.url.endsWith('/payment_requests') && call.options.method==='POST');
assert.equal(JSON.parse(payment.options.body).status,'pending');
assert.equal(JSON.parse(payment.options.body).amount_cents,500);
role='admin';await run('refreshAccount()');
assert.equal(nodes.get('ownerDashboard').hidden,false);
role=null;await run('refreshAccount()');
assert.equal(nodes.get('ownerDashboard').hidden,true);
for(const id of ['paymentHistory','paymentRequests','staffRegistrations','staffManagementList','myRegistrationList'])nodes.get(id).textContent='PRIVATE';
run('clearAccount()');
for(const id of ['paymentHistory','paymentRequests','staffRegistrations','staffManagementList','myRegistrationList'])assert.ok(!nodes.get(id).textContent.includes('PRIVATE'));
assert.equal(run('session'),null);
calendarAvailable=false;await run('loadSchedule()');
assert.equal(nodes.get('legacyRegistration').hidden,false);
assert.equal(nodes.get('scheduleEvent').required,false);
let links=0;
for(const name of (await readdir(root)).filter(name=>name.endsWith('.html'))) {
 const page=await readFile(new URL(name,root),'utf8');
 const ids=[...page.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(ids).size,ids.length,`${name}: duplicate IDs`);
 for(const [,value] of page.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if(/^(https?:|mailto:|tel:|data:)/.test(value))continue;
  const [file,fragment]=value.split('#');
  const target=file.split('?')[0]||name;
  await access(new URL(target,root));
  if(fragment){const content=await readFile(new URL(target,root),'utf8');assert.ok(content.includes(`id="${fragment}"`),`${name}: broken anchor ${value}`);}
  links++;
 }
}
console.log(`PASS: frontend workflow/security assertions and ${links} internal file/anchor links. Browser rendering and real Auth delivery are separate checks.`);
