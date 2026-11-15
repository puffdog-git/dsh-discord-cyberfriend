import {authenticatedTestContext} from './http-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {setImmediate} from 'node:timers/promises';
import {createApiHandler} from '../src/api.js';
import {PySelfTransport} from '../src/transport/pyself.js';
import {sanitizeConfig,describeSchema} from '../src/config.js';
import {validatePresence} from '../src/user-presence.js';
test('presence UI fields are public nonsecret settings with validation',()=>{
 const keys=describeSchema().fields.map(f=>f.key);for(const k of ['userPresenceEnabled','userStatus','userActivityType','userActivityText','userCustomStatusText','userCustomStatusEmoji'])assert.ok(keys.includes(k));
 assert.throws(()=>validatePresence({status:'bad'}));assert.throws(()=>validatePresence({activityType:'playing',activityText:''}));assert.throws(()=>validatePresence({customStatusText:'x'.repeat(129)}));
});
test('ready and resume restore managed appearance; disabled management and receive-only never mutate Discord',async()=>{
 const t=new PySelfTransport();const calls=[];t.config=sanitizeConfig({userPresenceEnabled:true,userReceiveOnly:false,userStatus:'idle',userActivityType:'playing',userActivityText:'Stardew Valley',userCustomStatusText:'安靜聊天'});t.process={};t.rpc=async(method,params)=>{calls.push({method,params});return {ok:true};};
 t.event({event:'ready',user:{id:'1560000000000000003'},libraryVersion:'fixture'});await setImmediate();assert.equal(calls.length,1);assert.equal(calls[0].params.activityText,'Stardew Valley');assert.equal(t.getStatus().presence.verification,'request-accepted');
 t.event({event:'resumed'});await setImmediate();assert.equal(calls.length,2);
 t.config.userPresenceEnabled=false;t.event({event:'resumed'});await setImmediate();assert.equal(calls.length,2);
 t.config.userPresenceEnabled=true;t.config.userReceiveOnly=true;t.event({event:'resumed'});await setImmediate();assert.equal(calls.length,2);assert.equal(t.lastPresence.ok,false);
});
test('presence HTTP targets one account and reports each failure honestly',async()=>{
 const calls=[];const config=sanitizeConfig({userPresenceEnabled:true});const manager={byKind:{user:{getPresence:async()=>({ok:true,clientStatus:'idle',activities:[]}),applyPresence:async p=>{calls.push(['user',p]);return {ok:true};}},bot:{ready:true,setActivity:async s=>{calls.push(['bot',s]);return {ok:false,error:'fixture failure'};}}}};
 const server=createServer(createApiHandler({ctx:authenticatedTestContext,getConfig:()=>config,getManager:()=>manager,getLogger:()=>({error(){}})}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const post=async b=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/discord-cyberfriend/presence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};};
 try{
  const current=await(await fetch('http://127.0.0.1:'+server.address().port+'/api/discord-cyberfriend/presence')).json();assert.equal(current.current.clientStatus,'idle');
  assert.equal((await post({transport:'user',status:'idle'})).body.ok,true);assert.deepEqual(calls.map(x=>x[0]),['user']);
  const both=await post({transport:'both',status:'online'});assert.equal(both.body.ok,false);assert.equal(both.body.results.user.ok,true);assert.equal(both.body.results.bot.ok,false);
  const n=calls.length;assert.equal((await post({transport:'other'})).status,400);assert.equal((await post({transport:'user',activityType:'playing'})).status,400);assert.equal(calls.length,n);
  config.userPresenceEnabled=false;assert.equal((await post({transport:'user'})).body.ok,false);
  assert.equal((await post({transport:'bot',customStatusText:'unsupported'})).body.results.bot.ok,false);
 }finally{await new Promise(r=>server.close(r));}
});
