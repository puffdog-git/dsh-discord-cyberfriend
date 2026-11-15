import {authenticatedTestContext} from './http-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MediaCulture} from '../src/media-culture.js';
import {createApiHandler} from '../src/api.js';
test('real HTTP catalogue/editor saves, rejects stale versions and scopes without touching production cache',async()=>{
 const root=await mkdtemp(join(tmpdir(),'culture-api-'));const culture=new MediaCulture({file:join(root,'culture.json'),getConfig:()=>({})});await culture.init();
 const a=culture.asset({urls:['https://static.klipy.com/cat.gif']},{guildId:'123',channelId:'456'});
 const handler=createApiHandler({ctx:authenticatedTestContext,culture,getLogger:()=>({error(){}})});const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/api/discord-cyberfriend';
 const post=async body=>{const r=await fetch(base+'/culture/assets/update',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 try{
  let r=await post({id:a.id,expectedVersion:0,manualName:'我的道歉貓',manualDescription:'低頭鞠躬',manualMeanings:{'guild:123':{meaning:'道歉',avoid:'嚴肅話題'}}});assert.equal(r.status,200);assert.equal(r.body.asset.manualName,'我的道歉貓');
  const list=await (await fetch(base+'/culture/assets?query='+encodeURIComponent('道歉')+'&type=gif')).json();assert.equal(list.total,1);assert.equal(list.assets[0].manualMeanings['guild:123'].meaning,'道歉');
  assert.equal((await post({id:a.id,expectedVersion:0,manualDescription:'stale'})).status,409);
  assert.equal((await post({id:a.id,expectedVersion:1,scope:'guild:other',meaning:'bad',avoid:''})).status,400);
  assert.equal((await post({id:'missing',expectedVersion:0})).status,404);
  const restarted=new MediaCulture({file:join(root,'culture.json'),getConfig:()=>({})});await restarted.init();assert.equal(restarted.cached(restarted.data.assets[a.id],{}).description,'低頭鞠躬');
 }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
