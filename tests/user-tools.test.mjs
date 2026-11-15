import {authenticatedTestContext} from './http-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {UserTakeover} from '../src/user-takeover.js';
import {UserInbox} from '../src/user-inbox.js';
import {createApiHandler} from '../src/api.js';
import {PySelfTransport} from '../src/transport/pyself.js';
import {sanitizeConfig} from '../src/config.js';
import {createResponder} from '../src/features/responder.js';
const channel='1560000000000000011',id='1560000000000000012';
test('takeover persists, cancels immediately, expires by server clock and resumes without replay',async()=>{
 const root=await mkdtemp(join(tmpdir(),'takeover-'));let now=100000,cancelled=[];const opts={file:join(root,'takeover.json'),now:()=>now,onPause:c=>{cancelled.push(c);return 2;}};
 try{const t=new UserTakeover(opts);await t.init();const result=await t.pause(channel,{seconds:900,label:'test'});assert.equal(result.cancelled,2);assert.deepEqual(cancelled,[channel]);
 const restored=new UserTakeover(opts);await restored.init();assert.ok(restored.active(channel));assert.equal(restored.active('1560000000000000013'),null);
 now+=900001;assert.equal(restored.active(channel),null);await restored.pause(channel,{seconds:0});now+=9999999;assert.ok(restored.active(channel));await restored.resume(channel);assert.equal(restored.status().entries.length,0);
 await assert.rejects(restored.pause('../x'),/頻道/);await assert.rejects(restored.pause(channel,{seconds:-1}),/時間/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('paused user transport blocks automated text, typing and reactions but allows explicit manual reply',async()=>{
 const t=new PySelfTransport();t.state='connected';t.selfId=id;t.process={};t.config={userReceiveOnly:false,userAutoReply:true};t.isPaused=c=>c===channel;const calls=[];t.rpc=async(m,p)=>{calls.push(m);return {ok:true,messageId:'sent'};};
 assert.equal((await t.sendMessage(channel,{autoReply:true,content:'no'})).cancelled,true);assert.equal(await t.startTyping(channel,{autoReply:true}),null);assert.equal((await t.sendReaction(channel,id,'x')).ok,false);assert.equal(calls.length,0);
 assert.equal((await t.sendMessage(channel,{content:'manual'})).ok,true);assert.deepEqual(calls,['send']);
 const r=createResponder({});assert.equal((await r.respond({channelId:channel},'dm',t)).skipped,true);
});
test('inbox deduplicates, keeps newer pending messages, syncs edits/deletes and never counts simulations',async()=>{
 const root=await mkdtemp(join(tmpdir(),'inbox-'));try{const file=join(root,'inbox.json'),inbox=new UserInbox({file});await inbox.init();const t={kind:'user',selfId:'self'};const m={id,channelId:channel,isDm:true,author:{id:'admin',name:'管理者'},content:'hi'};
 await inbox.record(m,t);await inbox.record(m,t);await inbox.record({...m,id:'1560000000000000013'},t);await inbox.record({...m,id:'1560000000000000014',simulated:true},t);assert.equal(inbox.status().total,2);
 await inbox.resolve(id,'ai','reply');assert.equal(inbox.status().total,1);
 const pending='1560000000000000013';await inbox.change({event:'message_edit',messageId:pending},{content:'new text'});assert.equal(inbox.status().items[0].content,'new text');
 const reload=new UserInbox({file});await reload.init();assert.equal(reload.status().total,1);await reload.change({event:'message_delete',messageId:pending});assert.equal(reload.status().total,0);
 await reload.record({...m,isDm:false,guildId:'guild',id:'1560000000000000015'},t);assert.equal(reload.status().total,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('user tools HTTP routes validate delete confirmation and isolate personal account',async()=>{
 const calls=[];const user={editMessage:async(...a)=>{calls.push(['edit',...a]);return {ok:true};},deleteMessage:async(...a)=>{calls.push(['delete',...a]);return {ok:true};}};
 const server=createServer(createApiHandler({ctx:authenticatedTestContext,getManager:()=>({byKind:{user}}),getLogger:()=>({error(){}})}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const post=async(path,body)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/discord-cyberfriend'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{assert.equal((await post('/user-message/delete',{channelId:channel,messageId:id})).status,400);assert.equal(calls.length,0);assert.equal((await post('/user-message/edit',{channelId:channel,messageId:id,content:'fixed'})).data.ok,true);assert.equal((await post('/user-message/delete',{channelId:channel,messageId:id,confirmed:true})).data.ok,true);assert.deepEqual(calls.map(c=>c[0]),['edit','delete']);}finally{await new Promise(r=>server.close(r));}
});

test('taking over a conversation cancels in-flight generation and stops typing before any late send',async()=>{
 const root=await mkdtemp(join(tmpdir(),'takeover-flight-'));let release,started;const ready=new Promise(r=>started=r),wait=new Promise(r=>release=r),events=[];
 const llm={listProviders:()=>[{provider:'fixture'}],prepareCall:async()=>({async *stream(){started();await wait;yield {type:'text-delta',text:'late answer'};yield {type:'finish',reason:{kind:'stop'}};}})};
 const config=sanitizeConfig({dryRun:false,userSimulateTyping:true,minReplyDelaySeconds:0,maxReplyDelaySeconds:0});
 const responder=createResponder({ctx:{get:k=>k==='llm'?llm:undefined},getConfig:()=>config,history:{contextText:()=>'',record(){}},ledger:{record(){}},log:{info(){},warn(){},error(){}},semaphore:{run:f=>f()}});
 const t={kind:'user',selfId:'self',epoch:1,startTyping:async()=>({typingId:'lease'}),stopTyping:async()=>events.push('stopped'),sendMessage:async()=>{events.push('sent');return {ok:true};}};
 try{const reply=responder.respond({id,channelId:channel,isDm:true,author:{id:'other'},content:'question'},'dm',t);await ready;
 const takeover=new UserTakeover({file:join(root,'pause.json'),onPause:c=>responder.cancel(c,undefined,undefined,t)});await takeover.pause(channel);assert.equal((await reply).cancelled,true);release();await new Promise(r=>setTimeout(r,20));assert.ok(events.includes('stopped'));assert.ok(!events.includes('sent'));
 }finally{release?.();await rm(root,{recursive:true,force:true});}
});

test('only new manual-origin own messages trigger takeover callback, not plugin echoes or ambiguous packets',async()=>{
 const calls=[];const t=new PySelfTransport({onOwnMessage:m=>calls.push(m.id)});t.state='connected';t.selfId='1560000000000000003';t.process={};t.liveSince=Date.now()-1000;t.config={userReceiveOnly:true,userAutoReply:false,userInboxEnabled:false,memoryOutputEnabled:false};
 const fresh=String(BigInt(Date.now()-1420070400000)<<22n);const m={id:fresh,channelId:channel,author:{id:t.selfId},content:'own manual',isDm:true};
 t.event({event:'message',origin:'manual',message:m});t.event({event:'message',origin:'plugin',message:{...m,id:String(BigInt(fresh)+1n)}});t.event({event:'message',origin:'unknown',message:{...m,id:String(BigInt(fresh)+2n)}});t.event({event:'message',origin:'manual',message:{...m,id:'100000000000000000'}});assert.deepEqual(calls,[fresh]);
});
