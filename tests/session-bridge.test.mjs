import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DiscordSessions} from '../src/session-bridge.js';
import {AdminJournal} from '../src/admin-journal.js';
import {buildPrompt,processModelOutput} from '../src/persona.js';

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'dsh-session-test-')),stored=new Map(),headers=new Map(),live=new Map(),requests=[],sections=[],masks=[];
 let creates=0,resumes=0,active=0,maxActive=0;
 const make=async(options,resume)=>{
  const id=options.sessionId||options.resumeSessionId;
  if(resume)resumes++;else creates++;
  const data=stored.get(id)||structuredClone(options.seed||[]);stored.set(id,data);if(!headers.has(id))headers.set(id,{id,cwd:options.meta?.cwd||join(root,'existing')});
  let pending=Promise.resolve(),release;const listeners=new Map();const emit=frame=>{for(const fn of listeners.get('agent/assistant-stream')||[])fn({agent,frame})};
  const agent={id,status:'idle',session:{header:headers.get(id),get seq(){return data.length;},snapshotEvents:(from=0)=>data.map((e,seq)=>({...e,seq,time:e.time||1})).slice(from),append:(type,event)=>data.push({type,data:event})},model:{select(){}},
   runMaintenance:async job=>job(),
   followup(input){if(!data.some(e=>e.type==='system/message'))data.push({type:'system/message',data:{message:{content:[]}}});data.push({type:'user/message',data:input});requests.push({id,input});this.status='running';active++;maxActive=Math.max(maxActive,active);emit({type:'start',attemptId:'fixture-attempt'});emit({type:'chunk',attemptId:'fixture-attempt',chunk:{type:'text-delta',text:'fixture '}});
    pending=new Promise(r=>{release=r;const complete=()=>{if(this.status==='running'){emit({type:'chunk',attemptId:'fixture-attempt',chunk:{type:'text-delta',text:'answer'}});data.push({type:'assistant/message',data:{message:{content:[{type:'text',text:'fixture answer'}]}}});this.status='idle';active--;r();}};if(input.id==='manual')this.finishManual=complete;else setTimeout(complete,15);});},
   whenIdle:()=>pending,cancel(){if(this.status==='running'){this.status='idle';active--;release?.();}}};
  agent.ctx={tools:{restrict:filter=>{assert.ok(Array.isArray(filter.allow));masks.push(filter.allow);return ()=>{};}},systemPrompt:{section:s=>{sections.push(s);return ()=>{};}},on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return ()=>listeners.get(name).delete(fn);}};
  await options.setup(agent.ctx);
  live.set(id,agent);return {agent,dispose:async()=>{agent.cancel();live.delete(id);}};
 };
 const services={workspaceRegistry:{create:async()=>({id:'workspace-fixture',attachSession:async()=>{}})},agents:{get:id=>live.get(id),create:o=>make(o,false),resume:o=>make(o,true)},
 sessionPersistence:{stat:async id=>stored.has(id)?{header:headers.get(id)}:undefined},sessionQuery:{observeSession:async id=>({header:headers.get(id),events:stored.get(id).map((e,seq)=>({...e,seq,time:e.time||1})),[Symbol.dispose](){}})},llm:{listProviders:()=>[{id:'fixture'}]},agentDefaultModel:{currentSelection:()=>({provider:'fixture',model:'test'})}};
 const create=()=>new DiscordSessions({ctx:{get:k=>services[k]},file:join(root,'bindings.json'),workspace:root,getConfig:()=>({}),log:{info(){},warn(){}}});
 const bridge=create();await bridge.init();return {bridge,create,requests,sections,services,masks,counts:()=>({creates,resumes,maxActive}),cleanup:async()=>{await bridge.dispose();await rm(root,{recursive:true,force:true});}};
}
const message={channelId:'channel',isDm:true,author:{id:'owner'}},transport={kind:'bot',selfId:'bot'},config={adminUserId:'owner'},options={system:'contract',user:'hello'};
test('uninitialized-session archives remain durable across journal reload and drain after the system head',async()=>{
 const f=await fixture();try{
  const deps={file:f.bridge.file+'.journal',bridge:f.bridge,getConfig:()=>({...config,enabled:true})};
  const msg={...message,id:'1580000000000000006',content:'archive before first reply'};
  const journal=new AdminJournal(deps);await journal.init();
  await journal.capture(msg,transport,async()=>null);
  assert.equal(Object.keys(journal.pending).length,1);
  assert.equal(f.requests.length,0);
  const reloaded=new AdminJournal(deps);await reloaded.init();await reloaded.drain();
  assert.equal(Object.keys(reloaded.pending).length,1);
  await f.bridge.run({...message,id:'1580000000000000005'},transport,config,options);
  await reloaded.drain();assert.equal(Object.keys(reloaded.pending).length,0);
  const agent=[...f.bridge.live.values()][0].agent;
  assert.equal(agent.session.snapshotEvents()[0].type,'system/message');
  assert.equal(agent.session.snapshotEvents().filter(e=>e.data?.id===f.bridge.sourceId(msg)).length,1);
 }finally{await f.cleanup();}
});
test('native assistant stream is scoped to the active no-tool reply and detached after completion',async()=>{
 const f=await fixture(),deltas=[];try{const pending=f.bridge.run(message,transport,config,{...options,onTextDelta:text=>deltas.push(text)});while(!f.requests.length)await new Promise(r=>setTimeout(r,1));assert.deepEqual(deltas,['fixture ']);const result=await pending;assert.equal(result.text,'fixture answer');assert.deepEqual(deltas,['fixture ','answer']);
 f.services.tools={get:()=>({})};const toolReply=await f.bridge.run(message,transport,{...config,sessionAllowedTools:['read_only_tool']},{...options,onTextDelta:()=>assert.fail('tool-enabled reply must stay buffered')});assert.equal(toolReply.ok,true);assert.deepEqual(f.masks.at(-1),['read_only_tool']);
 }finally{await f.cleanup()}
});
test('real bridge serializes same conversation and separates accounts, channels and workspaces',async()=>{
 const f=await fixture();try{
 const [a,b]=await Promise.all([f.bridge.run(message,transport,config,options),f.bridge.run(message,transport,config,options)]);
 assert.equal(a.ok,true);assert.equal(a.sessionId,b.sessionId);assert.equal(f.counts().maxActive,1);
 const other=await f.bridge.run(message,{...transport,kind:'user',selfId:'alt'},config,options);assert.notEqual(other.sessionId,a.sessionId);
 const another=await f.bridge.run({...message,channelId:'different'},transport,config,options);assert.notEqual(another.sessionId,a.sessionId);
 assert.match(f.bridge.workspaceFor(message,config),/admin-dm$/);assert.match(f.bridge.workspaceFor({...message,author:{id:'stranger'}},config),/other-dm[\\/]stranger$/);
 }finally{await f.cleanup();}
});
test('binding resumes persisted session after disposal and reset retains old stored history',async()=>{
 const f=await fixture();let second;try{
 const first=await f.bridge.run(message,transport,config,options);await f.bridge.dispose();
 second=f.create();await second.init();const resumed=await second.run(message,transport,config,options);
 assert.equal(resumed.sessionId,first.sessionId);assert.equal(f.counts().resumes,1);
 await second.reset(second.identity(message,transport));const fresh=await second.run(message,transport,config,options);assert.notEqual(fresh.sessionId,first.sessionId);
 }finally{await second?.dispose();await f.cleanup();}
});
test('cancellation stops active generation and a queued cancelled prompt is never admitted',async()=>{
 const f=await fixture();try{
 const a=new AbortController(),b=new AbortController();
 const first=f.bridge.run(message,transport,config,{...options,signal:a.signal});
 const queued=f.bridge.run(message,transport,config,{...options,signal:b.signal});b.abort();
 while(!f.requests.length)await new Promise(r=>setTimeout(r,1));a.abort();
 assert.equal((await first).code,'CANCELLED');assert.equal((await queued).code,'CANCELLED');assert.equal(f.requests.length,1);
 }finally{await f.cleanup();}
});
test('external persona mode removes local identity and style, and output filters can be disabled independently',()=>{
 const input={config:{dmPersonaPrompt:'LOCAL_PERSONA_SECRET',pluginPersonaEnabled:false,pluginStyleEnabled:false,
  antiAiFlavorPromptEnabled:false,stripMarkdown:false},kind:'dm',message:'hi'};
 const prompt=buildPrompt(input);assert.ok(!prompt.system.includes('LOCAL_PERSONA_SECRET'));assert.ok(!prompt.system.includes('朋友的口吻'));
 assert.match(buildPrompt({...input,config:{...input.config,pluginPersonaEnabled:true}}).system,/LOCAL_PERSONA_SECRET/);
 assert.equal(processModelOutput('**保留格式**',{antiAiFlavor:false,stripMarkdown:false}).text,'**保留格式**');
});
test('an idle DSH UI Agent is reused without taking its lifecycle; busy UI work is not cancelled',async()=>{
 const f=await fixture();let other;try{
  const first=await f.bridge.run(message,transport,config,options);
  other=f.create();await other.init();
  const result=await other.run(message,transport,config,options);
  assert.equal(result.ok,true);assert.equal(result.sessionId,first.sessionId);assert.equal(f.counts().creates,1);
  const agent=f.services.agents.get(first.sessionId);agent.followup({id:'manual',content:[]});
  const busy=await other.run(message,transport,config,options);assert.equal(busy.ok,false);
  await other.dispose();assert.equal(agent.status,'running');agent.finishManual();await agent.whenIdle();
  assert.equal(f.services.agents.get(first.sessionId),agent);
 }finally{await other?.dispose();await f.cleanup();}
});
test('workspace rebinding requires an absolute path and existing-session binding never steals a live Agent',async()=>{
 const f=await fixture();try{
 const r=await f.bridge.run(message,transport,config,options),key=f.bridge.identity(message,transport);
 await assert.rejects(f.bridge.bind(key,{cwd:'relative/path'}),/完整絕對路徑/);
 await assert.rejects(f.bridge.bind(key,{sessionId:r.sessionId}),/關閉/);
 await f.bridge.bind(key,{cwd:join(f.bridge.workspace,'new-workspace')});
 const next=await f.bridge.run(message,transport,config,options);
 assert.notEqual(next.sessionId,r.sessionId);assert.match(f.bridge.list()[0].cwd,/new-workspace$/);
 }finally{await f.cleanup();}
});

test('admin archive writes native user events without generating and deduplicates replied messages',async()=>{
 const f=await fixture();try{
  const msg={...message,id:'1580000000000000002',content:'未 @ 也保存'};
  await assert.rejects(f.bridge.archive(msg,transport,config),/保留待寫入/);
  assert.equal(f.requests.length,0);
  const emptyAgent=[...f.bridge.live.values()][0].agent;
  assert.equal(emptyAgent.session.snapshotEvents().length,0);
  await f.bridge.run({...msg,id:'1580000000000000001'},transport,config,options);
  const count=emptyAgent.session.snapshotEvents().length;
  const a=await f.bridge.archive(msg,transport,config);
  assert.equal(f.requests.length,1);
  assert.equal((await f.bridge.archive(msg,transport,config)).duplicate,true);
  assert.equal(f.services.agents.get(a.sessionId).session.snapshotEvents().length,count+1);
  const second={...msg,id:'1580000000000000003'};
  assert.equal((await f.bridge.run(second,transport,config,options)).ok,true);
  assert.equal((await f.bridge.archive(second,transport,config)).duplicate,true);
  const agent=f.services.agents.get(a.sessionId);agent.followup({id:'manual',content:[]});
  await assert.rejects(f.bridge.archive({...msg,id:'1580000000000000004'},transport,config),/稍後保存/);
  assert.equal(agent.status,'running');agent.finishManual();await agent.whenIdle();
 }finally{await f.cleanup();}
});
test('a stored session holding only archived user messages is replaced before its first reply and the messages are carried over',async()=>{
 const f=await fixture();let second;try{
  const state=await f.bridge.acquire(f.bridge.identity(message,transport),message,transport,config),oldId=state.agent.id;
  // 修復前的程式會在系統開頭建立之前直接寫入管理者訊息，留下這種半成品。
  state.agent.session.append('user/message',{id:'discord:channel:1580000000000000007',role:'user',content:[{type:'text',text:'earlier admin note'}],source:{kind:'user'}});
  await f.bridge.dispose();
  second=f.create();await second.init();
  const reply=await second.run({...message,id:'1580000000000000008'},transport,config,options);
  assert.equal(reply.ok,true);assert.notEqual(reply.sessionId,oldId);
  const events=[...second.live.values()][0].agent.session.snapshotEvents();
  assert.equal(events[0].type,'system/message');
  assert.equal(events.filter(e=>e.data?.id==='discord:channel:1580000000000000007').length,1);
  const binding=second.list()[0];assert.deepEqual(binding.replaced,[oldId]);assert.equal(binding.carry,undefined);
  // 再跑一次不會重複補寫，也不會再換會話。
  const again=await second.run({...message,id:'1580000000000000009'},transport,config,options);assert.equal(again.sessionId,reply.sessionId);
  assert.equal([...second.live.values()][0].agent.session.snapshotEvents().filter(e=>e.data?.id==='discord:channel:1580000000000000007').length,1);
 }finally{await second?.dispose();await f.cleanup();}
});
test('a healthy stored session and an empty one are never replaced',async()=>{
 const f=await fixture();let second;try{
  const first=await f.bridge.run(message,transport,config,options);
  const other={...message,channelId:'empty-channel'};const empty=await f.bridge.acquire(f.bridge.identity(other,transport),other,transport,config);
  await f.bridge.dispose();second=f.create();await second.init();
  assert.equal((await second.run(message,transport,config,options)).sessionId,first.sessionId);
  assert.equal((await second.run(other,transport,config,options)).sessionId,empty.agent.id);
  assert.ok(second.list().every(b=>!b.replaced));
 }finally{await second?.dispose();await f.cleanup();}
});
test('a stored session the host refuses to load as corrupt is replaced; other load errors are not hidden',async()=>{
 const f=await fixture();let second;try{
  const first=await f.bridge.run(message,transport,config,options);await f.bridge.dispose();
  const resume=f.services.agents.resume;let mode='corrupt';
  f.services.agents.resume=o=>{if(mode==='corrupt')throw Object.assign(Error('system/message requires a protected first surface head'),{name:'SessionPersistenceCorruptionError'});if(mode==='other')throw Error('disk unavailable');return resume(o);};
  second=f.create();await second.init();
  const reply=await second.run(message,transport,config,options);assert.equal(reply.ok,true);assert.notEqual(reply.sessionId,first.sessionId);
  assert.deepEqual(second.list()[0].replaced,[first.sessionId]);
  await second.dispose();mode='other';const third=f.create();await third.init();
  const failed=await third.run(message,transport,config,options);assert.equal(failed.ok,false);assert.equal(third.list()[0].sessionId,reply.sessionId);await third.dispose();
 }finally{await second?.dispose();await f.cleanup();}
});

test('cached pre-system archives are replaced before replying, with each message carried once',async()=>{
 const f=await fixture();try{
 const state=await f.bridge.acquire(f.bridge.identity(message,transport),message,transport,config),old=state.agent.id;
 state.agent.session.append('user/message',{id:'old-cached-note',content:[{type:'text',text:'note'}]});const snapshot=JSON.stringify(state.agent.session.snapshotEvents());
 const result=await f.bridge.run(message,transport,config,options);assert.equal(result.ok,true);assert.notEqual(result.sessionId,old);assert.equal(JSON.stringify(state.agent.session.snapshotEvents()),snapshot);
 const data=f.services.agents.get(result.sessionId).session.snapshotEvents();assert.equal(data[0].type,'system/message');assert.equal(data.filter(e=>e.data?.id==='old-cached-note').length,1);
 }finally{await f.cleanup();}
});
test('an idle borrowed pre-system session is forked without disposing or writing the original agent',async()=>{
 const f=await fixture();let second;try{
 const original=await f.bridge.acquire(f.bridge.identity(message,transport),message,transport,config);original.agent.session.append('user/message',{id:'borrowed-note',content:[{type:'text',text:'note'}]});const snapshot=JSON.stringify(original.agent.session.snapshotEvents());
 second=f.create();await second.init();const r=await second.run(message,transport,config,options);assert.equal(r.ok,true);assert.notEqual(r.sessionId,original.agent.id);assert.equal(f.services.agents.get(original.agent.id),original.agent);assert.equal(JSON.stringify(original.agent.session.snapshotEvents()),snapshot);assert.equal(f.services.agents.get(r.sessionId).session.snapshotEvents().filter(e=>e.data?.id==='borrowed-note').length,1);
 }finally{await second?.dispose();await f.cleanup();}
});
test('a busy pre-system session is not replaced or cancelled',async()=>{
 const f=await fixture();let second,original;try{
 original=await f.bridge.acquire(f.bridge.identity(message,transport),message,transport,config);original.agent.session.append('user/message',{id:'busy-note'});original.agent.status='running';second=f.create();await second.init();const r=await second.run(message,transport,config,options);assert.equal(r.ok,false);assert.match(r.error,/正在使用中/);assert.equal(second.list()[0].sessionId,original.agent.id);assert.equal(original.agent.status,'running');
 }finally{if(original)original.agent.status='idle';await second?.dispose();await f.cleanup();}
});

test('session head type remains stable across incremental reads and resets when sequence rolls back',async()=>{
 const {sessionEventIndex}=await import('../src/token-budget.js');const events=[{type:'session/title'}],reads=[];const session={get seq(){return events.length},snapshotEvents(from=0){reads.push(from);return events.slice(from)}};
 assert.equal(sessionEventIndex(session).firstMessageType,undefined);events.push({type:'user/message',data:{id:'a'}});assert.equal(sessionEventIndex(session).firstMessageType,'user/message');events.push({type:'system/message'});assert.equal(sessionEventIndex(session).firstMessageType,'user/message');assert.deepEqual(reads,[0,1,2]);events.splice(0,events.length,{type:'system/message'});assert.equal(sessionEventIndex(session).firstMessageType,'system/message');
});

test('account workspaces share DMs and guilds but retain separate channel sessions and account roots',async()=>{
 const f=await fixture();try{
 const cfg={...config,sessionWorkspaceGrouping:'account'};
 const dm=f.bridge.workspaceFor(message,cfg,transport),guild={...message,isDm:false,guildId:'guild',channelId:'guild-channel'};
 assert.equal(f.bridge.workspaceFor(guild,cfg,transport),dm);
 assert.equal(f.bridge.workspaceFor({...message,author:{id:'stranger'}},cfg,transport),dm);
 assert.notEqual(f.bridge.workspaceFor(message,cfg,{kind:'user',selfId:'alt'}),dm);
 const a=await f.bridge.run(message,transport,cfg,options),b=await f.bridge.run(guild,transport,cfg,options);
 assert.notEqual(a.sessionId,b.sessionId);assert.equal(f.bridge.list()[0].cwd,f.bridge.list()[1].cwd);
 assert.throws(()=>f.bridge.workspaceFor(message,cfg,{kind:'bot',selfId:'../escape'}));
 }finally{await f.cleanup()}
});
test('workspace migration copies all history exactly, retains original, and resumes without another migration',async()=>{
 const f=await fixture();try{
 const first=await f.bridge.run(message,transport,config,options),key=f.bridge.identity(message,transport);
 const before=f.services.agents.get(first.sessionId).session.snapshotEvents();
 const target=join(f.bridge.workspace,'brand-new');
 const moved=await f.bridge.bind(key,{cwd:target});assert.equal(moved.inheritedEvents,before.length);
 const source=await f.services.sessionQuery.observeSession(first.sessionId),child=await f.services.sessionQuery.observeSession(moved.sessionId);
 assert.deepEqual(source.events,before);assert.deepEqual(child.events.slice(0,before.length),before);
 assert.equal(child.events.at(-1).type,'session/end-seed');assert.equal(child.header.cwd,target);
 assert.equal((await f.bridge.bind(key,{cwd:target})).changed,false);
 assert.equal((await f.bridge.run(message,transport,config,options)).sessionId,moved.sessionId);
 assert.equal(f.counts().creates,2);
 }finally{await f.cleanup()}
});
test('workspace migration refuses busy, queued and unfinished sessions without cancelling work',async()=>{
 const f=await fixture();try{
 const first=await f.bridge.run(message,transport,config,options),key=f.bridge.identity(message,transport),agent=f.services.agents.get(first.sessionId);
 agent.followup({id:'manual',content:[]});
 await assert.rejects(f.bridge.bind(key,{cwd:join(f.bridge.workspace,'busy')}),/執行中/);assert.equal(agent.status,'running');
 agent.finishManual();await agent.whenIdle();agent.inbox={nextTurn:[{}]};
 await assert.rejects(f.bridge.bind(key,{cwd:join(f.bridge.workspace,'queued')}),/排隊/);agent.inbox={};
 agent.session.append('turn/start',{});
 await assert.rejects(f.bridge.bind(key,{cwd:join(f.bridge.workspace,'unfinished')}),/未結束/);
 assert.equal(f.bridge.bindings[key].sessionId,first.sessionId);assert.equal(f.counts().creates,1);
 }finally{await f.cleanup()}
});
test('workspace migration failures and concurrent source changes retain original binding and history',async()=>{
 for(const failure of ['attach','save','source-change','copy']){
 const f=await fixture();try{
 const first=await f.bridge.run(message,transport,config,options),key=f.bridge.identity(message,transport),original=f.bridge.bindings[key],agent=f.services.agents.get(first.sessionId),before=agent.session.snapshotEvents();
 if(failure==='attach')f.services.workspaceRegistry.create=async()=>({id:'failed',attachSession:async()=>{throw Error('attach failed')}});
 if(failure==='save')f.bridge.save=async()=>{throw Error('save failed')};
 if(failure==='source-change')f.services.workspaceRegistry.create=async()=>({id:'racing',attachSession:async()=>agent.session.append('user/message',{content:[]})});
 if(failure==='copy'){const create=f.services.agents.create;f.services.agents.create=async opts=>{const h=await create(opts);h.agent.session.snapshotEvents=()=>[];return h;};}
 await assert.rejects(f.bridge.bind(key,{cwd:join(f.bridge.workspace,'failed')}));
 assert.equal(f.bridge.bindings[key],original);assert.deepEqual(agent.session.snapshotEvents().slice(0,before.length),before);
 assert.equal(agent.status,'idle');
 }finally{await f.cleanup()}}
});
test('switching workspace policy migrates once instead of losing previous dialogue',async()=>{
 const f=await fixture();try{
 const first=await f.bridge.run(message,transport,config,options),before=f.services.agents.get(first.sessionId).session.snapshotEvents();
 const cfg={...config,sessionWorkspaceGrouping:'account'};
 const second=await f.bridge.run(message,transport,cfg,options);assert.equal(second.ok,true);assert.notEqual(first.sessionId,second.sessionId);
 assert.deepEqual(f.services.agents.get(second.sessionId).session.snapshotEvents().slice(0,before.length),before);
 assert.equal((await f.bridge.run(message,transport,cfg,options)).sessionId,second.sessionId);
 assert.equal(f.bridge.list()[0].manualCwd,false);
 }finally{await f.cleanup()}
});

test('rebinding another stored session rejects busy work and rolls back failed binding persistence',async()=>{
 const f=await fixture();try{
 const a=await f.bridge.run(message,transport,config,options),key=f.bridge.identity(message,transport);
 const otherMessage={...message,channelId:'other-stored'};
 const b=await f.bridge.run(otherMessage,transport,config,options),otherKey=f.bridge.identity(otherMessage,transport);
 await f.bridge.live.get(b.sessionId).dispose();f.bridge.live.delete(b.sessionId);delete f.bridge.bindings[otherKey];
 const agent=f.services.agents.get(a.sessionId);agent.followup({id:'manual',content:[]});
 await assert.rejects(f.bridge.bind(key,{sessionId:b.sessionId}),/仍在執行/);assert.equal(agent.status,'running');agent.finishManual();await agent.whenIdle();
 const original=f.bridge.bindings[key],save=f.bridge.save;f.bridge.save=async()=>{throw Error('save failed')};
 await assert.rejects(f.bridge.bind(key,{sessionId:b.sessionId}),/save failed/);assert.equal(f.bridge.bindings[key],original);assert.equal(f.services.agents.get(a.sessionId),agent);
 f.bridge.save=save;await f.bridge.bind(key,{sessionId:b.sessionId});assert.equal(f.bridge.bindings[key].sessionId,b.sessionId);assert.equal(f.bridge.bindings[key].workspaceId,'workspace-fixture');
 }finally{await f.cleanup()}
});
test('returning to account workspace policy clears manual overrides without copying the same session',async()=>{
 const f=await fixture();try{
 const cfg={...config,sessionWorkspaceGrouping:'account'};f.bridge.getConfig=()=>cfg;
 const a=await f.bridge.run(message,transport,cfg,options),key=f.bridge.identity(message,transport);
 f.bridge.bindings[key].manualCwd=true;
 const result=await f.bridge.bind(key,{useAccountWorkspace:true});assert.equal(result.changed,false);assert.equal(f.bridge.bindings[key].manualCwd,false);assert.equal(f.bridge.bindings[key].sessionId,a.sessionId);
 }finally{await f.cleanup()}
});

test('a bound session the user archived in DSH is replaced by a new one on the next message; the old file is kept',async()=>{
 const f=await fixture();try{
  const archived=[];f.services.workspaceRegistry.archivedSessionIds=archived;
  const first=await f.bridge.run(message,transport,config,options);
  assert.equal((await f.bridge.run(message,transport,config,options)).sessionId,first.sessionId);
  archived.push(first.sessionId);
  const next=await f.bridge.run(message,transport,config,options);
  assert.equal(next.ok,true);assert.notEqual(next.sessionId,first.sessionId);
  assert.deepEqual(f.bridge.list()[0].replaced,[first.sessionId]);
  assert.ok(await f.services.sessionPersistence.stat(first.sessionId));
  assert.equal(f.requests.filter(r=>r.id===first.sessionId).length,2);
  assert.equal((await f.bridge.run(message,transport,config,options)).sessionId,next.sessionId);
  const other={...message,channelId:'other-channel'};const untouched=await f.bridge.run(other,transport,config,options);
  assert.equal((await f.bridge.run(other,transport,config,options)).sessionId,untouched.sessionId);
 }finally{await f.cleanup();}
});
test('an archived session that is still running elsewhere is not replaced mid-work, and a host without the archive list behaves as before',async()=>{
 const f=await fixture();try{
  const first=await f.bridge.run(message,transport,config,options);
  assert.equal((await f.bridge.run(message,transport,config,options)).sessionId,first.sessionId);
  f.services.workspaceRegistry.archivedSessionIds=[first.sessionId];
  f.services.agents.get(first.sessionId).status='running';
  const busy=await f.bridge.run(message,transport,config,options);
  assert.equal(busy.ok,false);assert.equal(f.bridge.list()[0].sessionId,first.sessionId);
 }finally{await f.cleanup();}
});
