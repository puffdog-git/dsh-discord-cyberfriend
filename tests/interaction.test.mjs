import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {TurnCoordinator}from'../src/features/turn-coordinator.js';import {FollowupWindow}from'../src/features/followup.js';
import {FeiyuMoodAdapter}from'../src/mood-adapter.js';import {knowledgeCatalog,knowledgeToolsFor}from'../src/knowledge-tools.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const transport={kind:'bot',selfId:'bot',epoch:1},user={kind:'user',selfId:'user',epoch:1};
const config={messageCoalesceEnabled:true,messageCoalesceMs:100,primaryTransport:'bot'};
const message=(id,extra={})=>({id,channelId:'channel',guildId:'guild',author:{id:'author'},content:id,attachments:[],...extra});
test('other-account mention copies do not split or shorten a pending two-message burst',async()=>{
 for(const shadowFirst of [true,false]){
  const calls=[];const c=new TurnCoordinator({dispatch:async(m,t)=>{calls.push({m,t});return {ok:true,messageId:'answer'}},cancel:()=>{}});
  const submit=id=>{
   const entries=[[message(id,{isMention:true}),transport,'mention'],[message(id),user,'shadow-mention']];
   if(shadowFirst)entries.reverse();
   return entries.map(([m,t,kind])=>c.accept(m,t,{config:{...config,messageCoalesceMs:250},kind}));
  };
  const first=submit('first');await pause(120);const second=submit('second');
  await Promise.all([...first,...second]);
  assert.equal(calls.length,1);assert.equal(calls[0].t,transport);
  assert.deepEqual(calls[0].m.turnMessageIds,['first','second']);
  assert.equal(calls[0].m.content,'first\nsecond');c.close();
 }
});
test('same-author burst combines text/media once and different authors/channels stay separate',async()=>{
 const calls=[];const c=new TurnCoordinator({dispatch:async(m,t)=>{calls.push([m,t]);return {ok:true,messageId:'answer'}},cancel:()=>{}});
 await Promise.all([c.accept(message('a',{attachments:[{url:'a'}]}),transport,{config,kind:'mention'}),c.accept(message('b',{attachments:[{url:'b'}]}),transport,{config,kind:'mention'}),c.accept(message('c',{author:{id:'other'}}),transport,{config,kind:'mention'}),c.accept(message('d',{channelId:'other'}),transport,{config,kind:'mention'})]);
 assert.equal(calls.length,3);assert.equal(calls[0][0].content,'a\nb');assert.equal(calls[0][0].attachments.length,2);assert.ok(c.trace.snapshot().every(r=>r.phase==='delivered'&&r.reason==='回覆已交付'));c.close();
});
test('duplicate ingress chooses mentioned account and does not retry uncertain delivery',async()=>{
 const calls=[];const c=new TurnCoordinator({dispatch:async(m,t)=>{calls.push(t.kind);return {ok:false,uncertain:true}},cancel:()=>{}});
 await Promise.all([c.accept(message('a'),user,{config,kind:'cochat'}),c.accept(message('a',{isMention:true}),transport,{config,kind:'mention'})]);
 assert.deepEqual(calls,['bot']);await c.accept(message('a'),user,{config,kind:'mention'});assert.equal(calls.length,1);c.close();
});
test('supplement cancels a generating answer, only current revision resolves waiters',async()=>{
 let release,started;const ready=new Promise(r=>started=r),calls=[];let cancels=0;
 const c=new TurnCoordinator({dispatch:async(m)=>{calls.push(m);if(calls.length===1){started();await new Promise(r=>release=r);return {ok:true,cancelled:true}}return {ok:true,messageId:'new'}},cancel:()=>{cancels++;release()}});
 const first=c.accept(message('a'),transport,{config,kind:'mention'});await ready;const second=c.accept(message('b'),transport,{config,kind:'followup'});const results=await Promise.all([first,second]);assert.equal(cancels,1);assert.equal(calls.length,2);assert.equal(calls[1].content,'a\nb');assert.ok(results.every(r=>r.messageId==='new'));c.close();
});
test('sending is committed: new messages start a new turn rather than cancel a send',async()=>{
 let started,release;const ready=new Promise(r=>started=r);let count=0,cancels=0;const c=new TurnCoordinator({dispatch:async(m,t)=>{count++;if(count===1){c.phase(m,t,'sending');started();await new Promise(r=>release=r)}return {ok:true,messageId:m.id}},cancel:()=>cancels++});
 const first=c.accept(message('a'),transport,{config,kind:'mention'});await ready;const second=c.accept(message('b'),transport,{config,kind:'mention'});release();await Promise.all([first,second]);assert.equal(count,2);assert.equal(cancels,0);c.close();
});
test('cancel pending prevents dispatch; separate persona claims permit independent replies',async()=>{
 let count=0;const c=new TurnCoordinator({dispatch:async()=>{count++;return {ok:true,messageId:'x'}},cancel:()=>{}});const p=c.accept(message('a'),transport,{config,kind:'mention'});c.cancelPending({messageId:'a'});assert.equal((await p).cancelled,true);await pause(120);assert.equal(count,0);
 await Promise.all([c.accept(message('b'),transport,{config,kind:'mention',identity:'personaA'}),c.accept(message('b'),user,{config,kind:'mention',identity:'personaB'})]);assert.equal(count,2);c.close();
});
test('multiple participants retain separate provisional topics; another explicit recipient is rejected',async()=>{
 const f=new FollowupWindow(),cfg={followupEnabled:true,followupSeconds:60};const a=message('a'),b=message('b',{author:{id:'other'}});f.remember(a,transport,cfg,{pending:true});f.remember(b,transport,cfg);
 const result=await f.decide({},cfg,message('c',{content:'你覺得呢？'}),'',transport);assert.equal(result.relevant,true);assert.equal(f.windows.get(f.key(a,transport)).participants.size,2);
 const reject=await f.decide({},cfg,message('c',{replyToAuthorId:'someone',content:'你覺得呢？'}),'',transport);assert.equal(reject.reason,'EXPLICIT_OTHER_RECIPIENT');
});
test('mood is bound, decayed, read-only, respects off and never copies reason/lastActive',async()=>{
 const home=await fs.mkdtemp(path.join(os.tmpdir(),'mood-adapter-'));const root=path.join(home,'feiyu-mood');await fs.mkdir(root);const file=path.join(root,'config.json'),now=Date.now();
 const cfg={模式:'session',decayHalfHours:12,moodBase:70,slots:[{id:'a',sessions:['session-one']},{id:'b',sessions:['session-two']}],injectMode:'event'};
 await fs.writeFile(file,JSON.stringify(cfg));const state=JSON.stringify({lastActive:'b',moods:{a:{mood:90,dims:{happy:80},lastDecayAt:now-12*3600000,lastReason:'private secret'},b:{mood:1,dims:{sad:100},lastDecayAt:now}}});await fs.writeFile(path.join(root,'state.json'),state);
 const adapter=new FeiyuMoodAdapter({home,now:()=>now});const s=await adapter.snapshot({sessionId:'session-one'});assert.equal(s.slotId,'a');assert.equal(s.mood,80);assert.ok(!JSON.stringify(s).includes('private secret'));assert.equal((await adapter.snapshot({sessionId:'unknown'})).available,false);assert.equal(await fs.readFile(path.join(root,'state.json'),'utf8'),state);
 await fs.writeFile(file,JSON.stringify({...cfg,injectMode:'off'}));assert.equal(await adapter.prompt({slotId:'a'}),'');await fs.rm(home,{recursive:true});
});
test('knowledge discovery is generic but rejects undeclared writes and private group data',()=>{
 const definitions=[{name:'custom_wiki_lookup',description:'wiki',annotations:{readOnlyHint:true,dataScope:'public'}},{name:'private_rag',description:'knowledge base',annotations:{readOnlyHint:true}},{name:'wiki_delete',annotations:{readOnlyHint:true}},{name:'unmarked_wiki'},{name:'search_meme_wiki'}];const ctx={tools:{definitions:()=>definitions}},cfg={knowledgeLookupEnabled:true,adminUserId:'admin'};
 assert.deepEqual(knowledgeToolsFor(ctx,cfg,{isDm:false},'other'),['custom_wiki_lookup','search_meme_wiki']);assert.ok(knowledgeToolsFor(ctx,cfg,{isDm:true},'admin').includes('private_rag'));assert.ok(!knowledgeCatalog(ctx).find(x=>x.name==='wiki_delete').eligible);assert.deepEqual(knowledgeToolsFor(ctx,{...cfg,knowledgeLookupEnabled:false},{isDm:true},'admin'),[]);
});
