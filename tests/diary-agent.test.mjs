import test from 'node:test';
import assert from 'node:assert/strict';
import {DiaryAgent,memuReceipt} from '../src/diary-agent.js';
const source={date:'2026-11-11',channelId:'channel',guildId:'guild',cwd:'C:/workspace',messages:[{message:{id:'real',author:{id:'owner',name:'管理者'},content:'管理者今天談到了日記與群內貼圖的使用情境',ts:'2026-11-11'},admin:true,source:'gateway'}],reactionEvents:[],cultureEvents:[]};
function fixture(fail=false,writerId='memu'){let tool,turn=0,pending=Promise.resolve();const events=[],writes=[],allowed=[];
 const agent={id:'diary-agent',status:'idle',session:{get seq(){return events.length;},snapshotEvents:(from=0)=>events.slice(from)},cancel(){},ctx:{tools:{restrict:x=>{allowed.push(x.allow);return ()=>{};},guard:()=>()=>{},register:x=>{tool=x;return ()=>{};}},systemPrompt:{section(){}}},
  followup(input){const current=++turn;pending=(async()=>{    events.push({type:'assistant/message',data:{message:{content:[{type:'text',text:current===1?'素材筆記':current===2?'我今天和管理者談了日記與貼圖用法。[real]':JSON.stringify({memories:[{title:'管理者今日的日記需求',content:'2026-11-11，管理者提出希望日記由目前工作區人格閱讀群聊素材後撰寫，再由記憶插件保存有來源的摘要。這次談話也包含群內貼圖的使用情境。',evidence_ids:['real']}]})}]}}},{type:'turn/end',data:{reason:{kind:'completed'}}});})();},whenIdle:()=>pending};
 const ctx={get:name=>({agentDefaultModel:{currentSelection:()=>({provider:'fixture',model:'model'})},llm:{listProviders:()=>[{id:'fixture'}]},workspaceRegistry:{create:async()=>({attachSession:async()=>{}})},agents:{create:async o=>{agent.session.header={cwd:o.meta.cwd,id:o.sessionId};await o.setup(agent.ctx);return {agent,dispose:async()=>{}};}},tools:{get:name=>name==='memu_private_remember'?{execute:async(args,exec)=>{writes.push({args,cwd:exec.agent.session.header.cwd});return fail?'dsh-memu-memory error: engine unavailable':'已写入私有记忆：mem-abc-123abc';}}:undefined}}[name])};
 return {writer:new DiaryAgent({ctx,getConfig:()=>({memoryDiaryWriteEnabled:true,memoryDiaryWriter:writerId})}),writes,allowed};}
test('persona diary precedes public memory tool call; verifies receipts and passes genuine workspace scope',async()=>{
 const f=fixture(),order=[];let otherWrites=0;f.writer.registerMemoryWriter('meow',async()=>{otherWrites++;throw Error('must not fan out')});const result=await f.writer.write(source,{onDraft:async()=>order.push('draft'),onReceipt:async()=>order.push('receipt')});assert.equal(otherWrites,0);
 assert.deepEqual(order,['draft','receipt']);assert.equal(result.memory.status,'stored');assert.equal(f.writes[0].cwd,'C:/workspace');assert.match(f.writes[0].args.fact_key,/discord-diary:2026-11-11/);
 assert.equal(result.text,'我今天和管理者談了日記與貼圖用法。[real]');assert.deepEqual(f.allowed[0],[]);assert.deepEqual(f.allowed.at(-1),[]);
});
test('tool errors never become stored; simulation-only sources never call memory writers',async()=>{
 const f=fixture(true);let fallbackWrites=0;f.writer.registerMemoryWriter('meow',async()=>{fallbackWrites++;return {status:'stored',ids:['wrong-provider']}});assert.equal((await f.writer.write(source)).memory.status,'failed');assert.equal(fallbackWrites,0);
 const g=fixture();const result=await g.writer.write({...source,messages:source.messages.map(m=>({...m,source:'simulation'}))});assert.equal(result.memory.status,'skipped');assert.equal(g.writes.length,0);
 assert.equal(memuReceipt('AI 說已經記住，但沒有實際工具結果').status,'failed');
});
test('session handoff does not call another writer; file and review receipts never become confirmed storage',async()=>{
 const a=fixture(false,'session'),session=await a.writer.write(source);assert.equal(session.memory.status,'delegated');assert.equal(a.writes.length,0);
 const b=fixture(false,'files');b.writer.registerMemoryWriter('files',async()=>({status:'exported',ids:[],path:'fixture.jsonl'}));assert.equal((await b.writer.write(source)).memory.status,'exported');
 const c=fixture();c.writer.registerMemoryWriter('memu',async()=>({status:'pending_review',ids:['pending-id']}));assert.equal((await c.writer.write(source)).memory.status,'submitted');
 const d=fixture(false,'session');assert.equal((await d.writer.write({...source,messages:source.messages.map(m=>({...m,source:'simulation'}))})).memory.status,'skipped');
});
