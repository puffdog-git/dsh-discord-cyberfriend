import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStore } from '../src/history.js';
import { createContextLoader } from '../src/features/context.js';
import { createMessageSync } from '../src/features/message-sync.js';
import { createControls } from '../src/features/controls.js';
import { createResponder } from '../src/features/responder.js';
import { PySelfTransport } from '../src/transport/pyself.js';
import { sanitizeConfig } from '../src/config.js';

const quiet = { info(){}, debug(){}, warn(){}, error(){} };
const message = { id:'1560000000000000007', channelId:'1560000000000000004', isDm:true,
  author:{id:'sender',name:'sender'}, content:'question', ts:'2026-11-11T09:00:00Z' };
const config = () => sanitizeConfig({ enabled:true,userEnabled:true,userAutoReply:true,userReceiveOnly:false,
  dryRun:false,minReplyDelaySeconds:0,maxReplyDelaySeconds:0 });
const deferred = () => { let resolve; const promise=new Promise(r=>{resolve=r;}); return {promise,resolve}; };

test('bootstrap sorts and deduplicates history; quotes outside recent window are fetched once per reply', async () => {
  const h = new HistoryStore({config:config()}); h.record(message);
  let reads=0, quotes=0;
  const t={kind:'user',epoch:1,selfId:'self', async getMessages(){reads++;return {ok:true,messages:[{...message,id:'old',content:'older',ts:'2026-11-11T08:00:00Z'},message]};},
    async getMessage(){quotes++;return {ok:true,message:{...message,id:'quote',content:'quoted source'}};}};
  const load=createContextLoader({history:h,getConfig:config});
  const text=await load({...message,replyTo:'quote'},t);
  await load(message,t);
  assert.equal(reads,1); assert.equal(quotes,1); assert.match(text,/quoted source/);
  assert.deepEqual(h.recent(message.channelId).map(x=>x.id),['old',message.id]);
});

test('history off performs no remote reads; deleted messages cannot be resurrected by an in-flight bootstrap', async () => {
  const h=new HistoryStore({config:config()}), waiting=deferred();
  let calls=0;
  const t={kind:'user',epoch:1,selfId:'self',getMessages(){calls++;return waiting.promise;}};
  await createContextLoader({history:h,getConfig:()=>({...config(),historyEnabled:false})})(message,t);
  assert.equal(calls,0);
  const promise=createContextLoader({history:h,getConfig:config})(message,t);
  h.invalidate(message.channelId,message.id,true);
  waiting.resolve({ok:true,messages:[message]}); await promise;
  h.record(message); assert.equal(h.size(message.channelId),0);
});

test('edit/delete immediately cancel old answers and do not re-trigger generation; late edit fetch cannot undo deletion', async () => {
  const h=new HistoryStore({config:config()}); h.record(message);
  const waiting=deferred(); let cancels=0;
  const sync=createMessageSync({history:h,responder:{cancel(){cancels++;}},log:quiet});
  const transport={kind:'user',epoch:1,getMessage:()=>waiting.promise};
  const event={channelId:message.channelId,messageId:message.id,event:'message_edit'};
  const pending=sync(event,transport);
  assert.equal(h.size(message.channelId),0);
  await sync({...event,event:'message_delete'},transport);
  waiting.resolve({ok:true,message:{...message,content:'edited'}});await pending;
  assert.equal(h.size(message.channelId),0);assert.equal(cancels,2);
});

function controlFixture(extra={}) {
  let active={...config(),...extra}; const calls=[];
  const h=new HistoryStore({config:active});
  const responder={source:()=>null,cancel:()=>{calls.push('cancel');return 1;},respond:async(m,k,t,o)=>{calls.push(o.instruction);return {ok:true};}};
  const controls=createControls({getConfig:()=>active,history:h,responder,log:quiet,gate:{check(){calls.push('gate');return {ok:true};}}});
  const transport={kind:'user',epoch:1,selfId:'self',ready:true,watches:()=>true,getMessage:async()=>({ok:true,message})};
  const event={channelId:message.channelId,messageId:message.id,userId:'sender',emoji:'🔍',dm:true};
  return {controls,transport,event,calls,responder,setConfig:value=>{active=value;}};
}

test('reaction commands reject unrelated users, removals, duplicates, and unmonitored channels', async () => {
  const f=controlFixture();
  assert.equal((await f.controls.handle({...f.event,userId:'stranger'},f.transport)).ok,false);
  assert.equal((await f.controls.handle({...f.event,removed:true},f.transport)).ok,false);
  assert.equal(f.calls.length,0);
  assert.equal((await f.controls.handle(f.event,f.transport)).ok,true);
  assert.match(f.calls[1],/詳細解釋/);
  assert.equal((await f.controls.handle(f.event,f.transport)).ok,false);
  const g=controlFixture(); g.transport.watches=()=>false;
  assert.equal((await g.controls.handle(g.event,g.transport)).ok,false);
});

test('stop bypasses generation quotas; explicit control allowlist grants access but blacklist still wins', async () => {
  const f=controlFixture({reactionControlUserIds:['admin']});
  const result=await f.controls.handle({...f.event,userId:'admin',emoji:'⏹️'},f.transport);
  assert.equal(result.cancelled,1);assert.deepEqual(f.calls,['cancel']);
  const g=controlFixture({reactionControlUserIds:['admin'],blacklistUserIds:['admin']});
  assert.equal((await g.controls.handle({...g.event,userId:'admin',emoji:'⏹️'},g.transport)).ok,false);
});

test('regeneration of an AI reply fetches the original question; toggling autoReply while fetching cancels action', async () => {
  const f=controlFixture();
  f.responder.source=()=>({...message,controlOwnerId:'sender'});
  f.transport.getMessage=async(c,id)=>({ok:true,message:id==='answer'?{...message,id:'answer',author:{id:'self'}}:message});
  assert.equal((await f.controls.handle({...f.event,messageId:'answer',emoji:'🔁'},f.transport)).ok,true);
  assert.deepEqual(f.calls.slice(0,2),['gate','cancel']);
  const g=controlFixture(), waiting=deferred();g.transport.getMessage=()=>waiting.promise;
  const pending=g.controls.handle(g.event,g.transport);g.setConfig({...config(),userAutoReply:false});
  waiting.resolve({ok:true,message}); assert.equal((await pending).ok,false);assert.equal(g.calls.length,0);
});

test('stop returns promptly, stops typing, and suppresses a late model completion', async () => {
  const waiting=deferred(), entered=deferred(), events=[];
  const llm={listProviders:()=>[{provider:'fixture'}],prepareCall:async c=>({config:c,async *stream(){
    entered.resolve();await waiting.promise;yield {type:'text-delta',text:'late answer'};yield {type:'finish',reason:{kind:'stop'}};
  }})};
  const responder=createResponder({ctx:{get:()=>llm},getConfig:config,history:new HistoryStore({config:config()}),
    ledger:{record(){}},log:quiet,semaphore:{run:fn=>fn()}});
  const transport={kind:'user',epoch:1,selfId:'self',startTyping:async()=>({typingId:'x'}),stopTyping:async()=>events.push('stop'),
    cancelReply:()=>events.push('cancel_rpc'),sendMessage:async()=>{events.push('sent');return {ok:true};}};
  const pending=responder.respond(message,'dm',transport);await entered.promise;
  assert.equal(responder.cancel(message.channelId,message.id),1);
  assert.equal((await pending).cancelled,true);assert.ok(events.includes('stop'));
  waiting.resolve();await new Promise(r=>setImmediate(r));assert.ok(!events.includes('sent'));
});

test('cancel while queued for sending suppresses delivery even after model completed', async () => {
  const entered=deferred(), queue=deferred();let sent=0;
  const llm={listProviders:()=>[{provider:'fixture'}],prepareCall:async c=>({config:c,async *stream(){yield {type:'text-delta',text:'answer'};yield {type:'finish',reason:{kind:'stop'}};}})};
  const responder=createResponder({ctx:{get:()=>llm},getConfig:()=>({...config(),userSimulateTyping:false}),
    history:new HistoryStore({config:config()}),ledger:{record(){}},log:quiet,semaphore:{async run(fn){entered.resolve();await queue.promise;return fn();}}});
  const transport={kind:'user',epoch:1,selfId:'self',sendMessage:async()=>{sent++;return {ok:true};}};
  const promise=responder.respond(message,'dm',transport);await entered.promise;responder.cancel(message.channelId);
  await promise;queue.resolve();await new Promise(r=>setImmediate(r));assert.equal(sent,0);
});

test('resume preserves dedupe window and invalidates replies from the interrupted connection', async () => {
  let lost=0, changes=0, reactions=0;
  const t=new PySelfTransport({log:quiet,onConnectionLost:()=>lost++,onMessageChange:()=>changes++,onReaction:()=>reactions++});
  t.config=config();t.process={};t.state='connected';t.selfId='1560000000000000003';t.liveSince=123;
  t.seen.add(message.id);const generation=t.connectionGeneration;
  t.event({event:'disconnected'});assert.equal(t.state,'reconnecting');assert.equal(lost,1);
  t.event({event:'resumed'});assert.equal(t.ready,true);assert.equal(t.liveSince,123);assert.ok(t.seen.has(message.id));
  const send=await t.sendMessage(message.channelId,{autoReply:true,connectionGeneration:generation});assert.equal(send.ok,false);
  t.event({event:'message_edit',channelId:message.channelId,messageId:message.id});
  t.event({event:'reaction',channelId:message.channelId,messageId:message.id,userId:'sender'});
  assert.equal(changes,1);assert.equal(reactions,1);
  t.event({event:'disconnected',terminal:true});assert.equal(t.state,'disconnected');
});

test('messages replayed before RESUMED wait for readiness, deduplicate, and respect intervening deletion', () => {
  const received=[];
  const t=new PySelfTransport({log:quiet,onMessage:m=>received.push(m)});
  t.config=config();t.process={};t.selfId='1560000000000000003';t.state='connected';t.liveSince=1;
  t.event({event:'disconnected'});
  const packet={event:'message',message};
  t.event(packet);t.event(packet);
  const removed={...message,id:'1560000000000000008'};
  t.event({event:'message',message:removed});
  t.event({event:'message_delete',messageId:removed.id,channelId:removed.channelId});
  assert.equal(received.length,0);
  t.event({event:'resumed'});t.event(packet);
  assert.deepEqual(received.map(m=>m.id),[message.id]);assert.equal(t.replayBuffer.size,0);
});
