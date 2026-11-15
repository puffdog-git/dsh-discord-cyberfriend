import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MediaCulture} from '../src/media-culture.js';
import {prepareGif} from '../src/media.js';
import {processModelOutput} from '../src/persona.js';
const transport={kind:'bot',selfId:'bot'};
const message=(id,author='member',content='哇，是 Astra 大人')=>({id,channelId:'channel',guildId:'guild',author:{id:author},content});
async function fixture(){const root=await mkdtemp(join(tmpdir(),'culture-'));let now=Date.now(),calls=0;const events=[],config={enabled:true,mediaPerceptionCacheEnabled:true,cultureChorusEnabled:true};
 const deps={file:join(root,'culture.json'),getConfig:()=>config,memoryOutput:{recordSource:async(type,data)=>events.push({type,...data})},getSelfIds:()=>['bot','alt'],now:()=>now,
 recognize:async()=>{calls++;return {ok:true,text:JSON.stringify({description:'一隻貓站在門邊；只根據抽樣畫格。',confidence:0.9}),provider:'fixture',model:'vision'};}};
 const culture=new MediaCulture(deps);await culture.init();return {culture,config,events,deps,calls:()=>calls,advance:ms=>now+=ms,cleanup:()=>rm(root,{recursive:true,force:true})};}
test('perception is recognized once, survives restart and CDN signature changes; same bytes share the result',async()=>{
 const f=await fixture();let downloads=0;const deps={fetcher:async()=>{downloads++;return new Response(Buffer.from('GIF89a fixture'),{headers:{'content-type':'image/gif'}});},extract:async()=>({frames:[{data:'fixture',mediaType:'image/jpeg',timeMs:0}],totalFrames:20,durationMs:2000})};
 try{const m=message('1','member','https://cdn.discordapp.com/attachments/111/222/cat.gif?ex=abc');
  const first=await f.culture.prepare(m,transport,f.config,undefined,prepareGif,deps);assert.equal(first.observations.length,1);assert.equal(first.images.length,0);assert.equal(f.calls(),1);
  const second=await f.culture.prepare({...m,content:m.content.replace('abc','def')},transport,f.config,undefined,prepareGif,deps);
  assert.equal(second.observations.length,1);assert.equal(downloads,1);assert.equal(f.calls(),1);
  const restarted=new MediaCulture(f.deps);await restarted.init();await restarted.prepare(m,transport,f.config,undefined,prepareGif,deps);assert.equal(f.calls(),1);
  await restarted.prepare({...m,content:'https://cdn.discordapp.com/attachments/111/333/another.gif'},transport,f.config,undefined,prepareGif,deps);assert.equal(f.calls(),1);assert.equal(downloads,2);
  await restarted.invalidate(first.observations[0].assetId);await restarted.prepare(m,transport,f.config,undefined,prepareGif,deps);assert.equal(f.calls(),2);
 }finally{await f.cleanup();}
});
test('usage is scoped and external recall needs matching scope and evidence; reuse cannot cross a private/group boundary',async()=>{
 const f=await fixture();try{const m=message('1','member','https://static.klipy.com/cat.gif');await f.culture.observe(m,transport,{recent:()=>[]});await f.culture.observe(m,{kind:'user',selfId:'alt'},{recent:()=>[]});
  const lookup=await f.culture.lookup(m);assert.equal(lookup.candidates[0].count,1);
  assert.equal((await f.culture.lookup({...m,guildId:'other'})).candidates.length,0);
  f.culture.registerRecallProvider('fixture',async()=>[{scope:'guild:other',text:'wrong',evidenceMessageIds:['1']},{scope:'guild:guild',text:'本群用來歡迎熟人',evidenceMessageIds:['1'],confidence:0.8}]);
  assert.equal((await f.culture.lookup(m)).external.length,1);
  const id=lookup.candidates[0].assetId;assert.equal((await f.culture.reuse(id,{...m,guildId:undefined},transport)).ok,false);
  assert.equal((await f.culture.reuse(id,m,transport)).ok,true);
  assert.equal(processModelOutput(`[ASSET: ${id}]`,{antiAiFlavor:false}).assetId,id);
 }finally{await f.cleanup();}
});
test('one person and own accounts cannot trigger chorus; multiple users claim only once across transports',async()=>{
 const f=await fixture();const h={recent:()=>[]};try{
  for(let i=0;i<5;i++)await f.culture.observe(message(String(i),'one'),transport,h);
  assert.equal(f.culture.chorus(message('4','one')),null);
  await f.culture.observe(message('5','bot'),transport,h);await f.culture.observe(message('6','two'),transport,h);await f.culture.observe(message('7','three'),transport,h);
  assert.equal(f.culture.chorus(message('7','three')).users,3);assert.equal(f.culture.claim(message('7','three')),true);assert.equal(f.culture.claim(message('7','three')),false);
  await f.culture.observe(message('8','four'),transport,h);assert.equal(f.culture.chorus(message('8','four')).claimed,true);
  f.advance(91000);assert.equal(f.culture.chorus(message('8','four')),null);
 }finally{await f.cleanup();}
});
test('different GIF links still form one multi-user media wave; simulation cannot start a production wave',async()=>{
 const f=await fixture(),h={recent:()=>[]};try{
  for(let i=0;i<4;i++)await f.culture.observe(message('fake'+i,'fake'+i,'哇, 是 Astra 大人！'),transport,h,{simulation:true});
  assert.equal(f.culture.chorus(message('fake3')),null);
  for(let i=0;i<4;i++)await f.culture.observe(message('real'+i,'user'+i,`https://static.klipy.com/${i}.gif`),transport,h);
  const b=f.culture.chorus(message('real3'));assert.equal(b.pattern,'media:gif');assert.equal(b.users,4);assert.equal(b.assetIds.length,4);
 }finally{await f.cleanup();}
});

test('manual edits drive perception and scoped recall, persist separately, reject conflicts and foreign scopes',async()=>{
 const f=await fixture();try{
  const m=message('manual','member','https://static.klipy.com/cat.gif');await f.culture.observe(m,transport,{recent:()=>[]});
  const a=Object.values(f.culture.data.assets)[0];a.perception={version:1,description:'original',expiresAt:Date.now()+100000};
  await f.culture.updateAsset(a.id,{expectedVersion:0,manualName:'道歉貓',manualDescription:'貓鞠躬',manualMeanings:{'guild:guild':{meaning:'自嘲搞砸了',avoid:'別人遭遇不幸'}}});
  assert.equal(a.perception.description,'original');assert.equal(f.culture.cached(a,f.config).description,'貓鞠躬');
  const rows=(await f.culture.lookup(m)).candidates;assert.equal(rows[0].manualMeaning,'自嘲搞砸了');assert.equal(rows[0].avoid,'別人遭遇不幸');
  assert.equal((await f.culture.lookup({...m,guildId:'other'})).candidates.length,0);
  await assert.rejects(f.culture.updateAsset(a.id,{expectedVersion:0,manualDescription:'stale'}),/已變更/);
  await assert.rejects(f.culture.updateAsset(a.id,{expectedVersion:1,manualMeanings:{'guild:other':{meaning:'bad',avoid:''}}}),/範圍/);
  assert.equal(a.editVersion,1);assert.equal(f.events.filter(x=>x.type==='media.annotation').length,1);
  const restarted=new MediaCulture(f.deps);await restarted.init();assert.equal(restarted.listAssets({query:'道歉貓',type:'gif'}).total,1);
  assert.equal(restarted.listAssets({scope:'guild:other'}).total,0);
  await restarted.updateAsset(a.id,{expectedVersion:1,manualDescription:''});assert.equal(restarted.cached(restarted.data.assets[a.id],f.config).description,'original');
  await restarted.invalidate(a.id);assert.equal(restarted.data.assets[a.id].manualName,'道歉貓');
 }finally{await f.cleanup();}
});

test('media review flags persist, expose scope evidence and ban reuse without removing understanding',async()=>{
 const f=await fixture();try{const m=message('review','member','https://static.klipy.com/cat.gif');await f.culture.observe(m,transport,{recent:()=>[]});const a=Object.values(f.culture.data.assets)[0];a.perception={version:1,description:'cat',expiresAt:Date.now()+100000};
 await f.culture.updateAsset(a.id,{expectedVersion:0,favorite:true,disabledForReuse:true,reviewState:'confirmed'});
 const list=f.culture.listAssets({reviewState:'confirmed'});assert.equal(list.total,1);assert.equal(list.assets[0].evidence['guild:guild'].count,1);assert.equal(f.culture.cached(a,f.config).description,'cat');assert.equal((await f.culture.reuse(a.id,m,transport)).ok,false);assert.equal(f.culture.listAssets({reviewState:'unreviewed'}).total,0);
 }finally{await f.cleanup();}
});
