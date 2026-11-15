import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {MemoryOutput,dayKey,validDay} from '../src/memory-output.js';
import {BotTransport} from '../src/transport/bot.js';
import {PySelfTransport} from '../src/transport/pyself.js';

const bot={kind:'bot',selfId:'bot'},user={kind:'user',selfId:'alt'};
const msg=(id,author='other',extra={})=>({id,channelId:'channel',guildId:'guild',author:{id:author,name:author},content:`message ${id}`,ts:'2026-11-10T12:00:00Z',...extra});
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'memory-output-'));let clock=new Date('2026-11-10T12:00:00Z');
  const config={enabled:true,adminUserId:'admin',memoryOutputEnabled:true,memoryOutputTimezone:'Asia/Taipei',memoryDiaryHour:3};
  const deps={root:join(dir,'output'),bridge:{workspace:dir,workspaceFor:m=>join(dir,m.guildId||m.author.id)},getConfig:()=>config,now:()=>clock};
  const output=new MemoryOutput(deps);await output.init();return {dir,config,output,deps,time:v=>clock=new Date(v),cleanup:()=>rm(dir,{recursive:true,force:true})};
}
test('daily source preserves full transcript, actors, removals, edits and deletes; deduplicates two observers',async()=>{
 const f=await fixture();try{
  await f.output.recordMessage(msg('1','admin'),bot);await f.output.recordMessage(msg('1','admin'),user);
  await f.output.recordMessage(msg('2'),bot);
  await assert.rejects(f.output.recordReaction({channelId:'channel',guildId:'guild',userId:'admin',emoji:'😂'},bot),/缺少/);
  const reaction={channelId:'channel',messageId:'2',guildId:'guild',userId:'admin',emoji:'<:happy:123>'};
  await f.output.recordReaction(reaction,user);await f.output.recordReaction({...reaction,emoji:'happy:123'},bot);
  await f.output.recordReaction({...reaction,removed:true},bot);await f.output.recordReaction(reaction,user);
  await f.output.recordMessage(msg('2','other',{content:'edited',edited:true}),bot);
  await f.output.recordMessage(msg('2'),bot);
  await assert.rejects(f.output.recordReaction({channelId:'channel',guildId:'guild',userId:'admin',emoji:'😂'},bot),/缺少/); // A -> B -> A must preserve the final revision.
  await f.output.recordChange({event:'message_delete',channelId:'channel',messageId:'2'},bot);
  const events=await f.output.events('2026-11-10');assert.equal(events.filter(e=>e.type==='message').length,2);
  assert.equal(events.filter(e=>e.type.startsWith('reaction.')).length,3);
  const result=await f.output.exportDay('2026-11-10');assert.equal(result.generated,1);
  const artifact=f.output.status().artifacts[0],json=JSON.parse((await f.output.read(artifact.id,'json')).content);
  assert.equal(json.messages.length,2);assert.deepEqual(json.adminMessageIds,['1']);assert.equal(json.messages[1].deleted,true);
  assert.equal(json.messages[1].message.content,'message 2');assert.equal(json.reactionEvents.length,3);
  assert.deepEqual(json.reactedMessages[0].reactions,[{emoji:'happy:123',userId:'admin'}]);
  const markdown=(await f.output.read(artifact.id)).content;assert.match(markdown,/管理者當日說了什麼/);assert.match(markdown,/移除/);assert.match(markdown,/discord.com\/channels\/guild\/channel\/2/);
  assert.equal((await f.output.exportDay('2026-11-10')).generated,0);
  await assert.rejects(f.output.read('../../secret'),/找不到/);await assert.rejects(f.output.exportDay('../2026-11-10'),/日期/);
  const restarted=new MemoryOutput(f.deps);await restarted.init();await restarted.recordMessage(msg('1','admin'),user);
  assert.equal((await restarted.events('2026-11-10')).length,events.length);
 }finally{await f.cleanup();}
});
test('admin private/group data bypass channel selection; other private chats remain outside export',async()=>{
 const f=await fixture();try{f.config.memoryGroupChannelIds=['selected'];
  await f.output.recordMessage(msg('1'),bot);await f.output.recordMessage(msg('2','admin'),bot);
  await f.output.recordMessage(msg('3','admin',{channelId:'dm',guildId:undefined,isDm:true}),user);
  await f.output.recordMessage(msg('4','stranger',{channelId:'private',guildId:undefined,isDm:true}),bot);
  await f.output.recordMessage(msg('5','alt',{channelId:'dm',guildId:undefined,isDm:true}),user,{source:'outgoing',adminConversation:true});
  const events=await f.output.events('2026-11-10');assert.equal(events.length,3);assert.equal(events[2].cwd,join(f.dir,'admin'));
  f.config.memoryOutputEnabled=false;await f.output.recordMessage(msg('6','admin'),bot);assert.equal((await f.output.events('2026-11-10')).length,3);
 }finally{await f.cleanup();}
});
test('timezone schedule catches up after restart, waits until cutoff and finalizes a partial day',async()=>{
 const f=await fixture();try{
  assert.equal(dayKey('2026-11-10T16:10:00Z'),'2026-11-11');assert.equal(validDay('2026-02-30'),false);
  await f.output.recordMessage(msg('1'),bot);await f.output.exportDay('2026-11-10');assert.equal(f.output.status().artifacts[0].partial,true);
  f.time('2026-11-10T18:59:00Z');await f.output.tick();assert.equal(f.output.status().artifacts[0].partial,true);
  f.time('2026-11-10T19:00:00Z');await f.output.tick();assert.equal(f.output.status().artifacts[0].partial,false);
  const generatedAt=f.output.status().artifacts[0].generatedAt;f.time('2026-11-10T19:01:00Z');await f.output.tick();assert.equal(f.output.status().artifacts[0].generatedAt,generatedAt);
  f.time('2026-11-12T20:00:00Z');const restarted=new MemoryOutput(f.deps);await restarted.init();await restarted.tick();
  assert.equal(restarted.status().artifacts[0].generatedAt,generatedAt);
 }finally{await f.cleanup();}
});

test('Bot Gateway forwards reaction removal, previews, edits and deletes without generating replies',async()=>{
 const reactions=[],changes=[];const transport=new BotTransport({onReaction:e=>reactions.push(e),onMessageChange:async e=>changes.push(e)});
 const d={channel_id:'channel',guild_id:'guild',message_id:'1',user_id:'admin',emoji:{id:'123',name:'happy'}};
 await transport.handleGateway({op:0,t:'MESSAGE_REACTION_ADD',d});
 await transport.handleGateway({op:0,t:'MESSAGE_REACTION_REMOVE',d});
 await transport.handleGateway({op:0,t:'MESSAGE_UPDATE',d:{id:'1',channel_id:'channel',embeds:[{title:'preview'}]}});
 await transport.handleGateway({op:0,t:'MESSAGE_UPDATE',d:{id:'1',channel_id:'channel',edited_timestamp:'2026-11-11T00:00:00Z'}});
 await transport.handleGateway({op:0,t:'MESSAGE_DELETE_BULK',d:{channel_id:'channel',ids:['1','2']}});
 assert.equal(reactions.length,2);assert.equal(reactions[1].removed,true);assert.equal(reactions[0].guildId,'guild');
 assert.deepEqual(changes.map(e=>e.event),['message_preview','message_edit','message_delete','message_delete']);
});

test('receive-only user transport forwards unmonitored group data as archival-only and keeps private strangers out',()=>{
 const received=[],reactions=[];const t=new PySelfTransport({onMessage:m=>received.push(m),onReaction:e=>reactions.push(e)});
 t.config={enabled:true,memoryOutputEnabled:true,userReceiveOnly:true,userAutoReply:false,userWatchDms:false};
 t.selfId='self';t.process={};t.state='connected';t.liveSince=1;
 const id=offset=>String((BigInt(Date.now()-1420070400000)<<22n)+BigInt(offset));
 t.event({event:'message',message:msg(id(1))});
 t.event({event:'message',message:msg(id(2),'stranger',{guildId:undefined,isDm:true})});
 t.event({event:'reaction',channelId:'channel',messageId:id(1),guildId:'guild',userId:'someone',emoji:'😂'});
 assert.equal(received.length,1);assert.equal(received[0].memoryOnly,true);assert.equal(reactions.length,1);
});

test('persona diary is previewable before ingestion completes and a slow diary never blocks incoming source writes',async()=>{
 const f=await fixture();let unblock,published=false;const pause=new Promise(r=>unblock=r);
 try{f.config.memoryDiaryPersonaEnabled=true;f.config.memoryDiaryWriteEnabled=true;
  f.output.diaryAgent={write:async(data,{onDraft,onReceipt})=>{await onDraft({text:'我今天和管理者聊了群內表情的用法。',sessionId:'diary-test',chunkCount:1});published=true;await pause;
    await onReceipt({sessionId:'diary-test',receipts:[{status:'stored',ids:['memory-test']}]});return {text:'我今天和管理者聊了群內表情的用法。',sessionId:'diary-test',memory:{status:'stored'}};}};
  await f.output.recordMessage(msg('1','admin'),bot);const exportJob=f.output.exportDay('2026-11-10');
  while(!published)await new Promise(r=>setTimeout(r,2));
  const a=f.output.status().artifacts[0];assert.match((await f.output.read(a.id)).content,/我今天/);
  assert.match((await f.output.read(a.id,'source')).content,/message 1/);
  await f.output.recordMessage(msg('2','admin'),bot);assert.equal((await f.output.events('2026-11-10')).filter(e=>e.type==='message').length,2);
  unblock();await exportJob;assert.equal(f.output.status().artifacts[0].memory.status,'stored');
 }finally{unblock?.();await f.output.flush();await f.cleanup();}
});

test('memory output follows an explicit workspace migration for future source records',async()=>{
 const f=await fixture();try{
 f.deps.bridge.identity=()=> 'bound';f.deps.bridge.bindings={bound:{manualCwd:true,cwd:join(f.dir,'moved')}};
 await f.output.recordMessage(msg('after-move','admin'),bot);
 assert.equal((await f.output.events('2026-11-10'))[0].cwd,join(f.dir,'moved'));
 }finally{await f.cleanup()}
});
