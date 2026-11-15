import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionEngine } from '../src/features/reactions.js';
import {ReplyGate} from '../src/features/gate.js';

test('Bot reaction replies use the shared responder and permission gate',async()=>{
 let checked=0,responded;
 const target={id:'m',channelId:'c',content:'question',author:{id:'original'}};
 const engine=createReactionEngine({getConfig:()=>({reactionCommandEnabled:true,reactionCommandTriggerEmojis:['🤖'],botEnabled:true}),
  responder:{respond:async(...args)=>{responded=args;return {ok:true,messageId:'answer'};}},
  gate:{check:()=>{checked++;return {ok:true};}},log:{error(){}}});
 const result=await engine.handleReaction({channelId:'c',messageId:'m',emoji:'🤖',userId:'actor'},
  {kind:'bot',selfId:'self',getMessages:async()=>({ok:true,messages:[target]})});
 assert.equal(result.ok,true);assert.equal(checked,1);assert.equal(responded[0].author.id,'actor');assert.equal(responded[3].requesterId,'actor');
});

test('dry run suppresses reactions and does not mark the message as already handled', async () => {
  let config = { dryRun: true, autoReactionEnabled: true, autoReactionChance: 100, autoReactionEmojis: ['👍'] };
  let sends = 0, recorded = 0;
  const engine = createReactionEngine({ getConfig: () => config,
    ledger: { record() { recorded++; } }, log: { info() {}, debug() {} } });
  const transport = { kind: 'user', selfId: 'self', async sendReaction() { sends++; return { ok: true }; } };
  const message = { id: 'm1', channelId: 'c1', isDm: true, author: { id: 'other' } };
  const simulated = await engine.autoReact(message, transport,{decision:{ok:true}});
  assert.equal(simulated.dryRun, true); assert.equal(sends, 0); assert.equal(recorded, 0);
  config = { ...config, dryRun: false };
  assert.equal((await engine.autoReact(message, transport,{decision:{ok:true}})).ok, true);
  assert.equal(sends, 1); assert.equal(recorded, 1);
  await engine.autoReact(message, transport,{decision:{ok:true}});
  assert.equal(sends, 1);
});

test('reaction admission fails closed and effective audience settings cannot be bypassed',async()=>{
 let sends=0;const config={autoReactionEnabled:true,autoReactionChance:100,autoReactionEmojis:['👍']};
 const engine=createReactionEngine({getConfig:()=>config,ledger:{record(){}},log:{info(){},debug(){}}});
 const transport={kind:'bot',selfId:'bot',sendReaction:async()=>{sends++;return {ok:true}}},message={id:'one',channelId:'unmonitored',guildId:'g',author:{id:'person'}};
 await engine.autoReact(message,transport);
 for(const reason of ['閒聊已關閉','頻道不在閒聊監控清單','與該使用者的冷卻中','@ 回覆已關閉','機器人訊息不回覆'])await engine.autoReact(message,transport,{decision:{ok:false,reason}});
 assert.equal(sends,0);
 await engine.autoReact(message,transport,{decision:{ok:true},effectiveConfig:{...config,autoReactionEnabled:false}});assert.equal(sends,0);
 await engine.autoReact(message,transport,{decision:{ok:true},effectiveConfig:config});assert.equal(sends,1);
});

test('real reply admission blocks unrelated guild traffic and cooldown reactions',async()=>{
 const config={enabled:true,autoReactionEnabled:true,autoReactionChance:100,autoReactionEmojis:['👍'],coChatEnabled:false,mentionReplyEnabled:true,cooldownSeconds:60,monitoredChannelIds:[]};
 let sends=0;const engine=createReactionEngine({getConfig:()=>config,ledger:{record(){}},log:{info(){},debug(){}}}),gate=new ReplyGate({config,ledger:{}});
 const transport={kind:'bot',selfId:'bot',sendReaction:async()=>{sends++;return {ok:true}}},m={id:'m1',channelId:'c',guildId:'g',content:'hello',author:{id:'user'}};
 const candidate=gate.shouldConsiderCoChat(m,config);assert.equal(candidate.ok,false);await engine.autoReact(m,transport,{decision:candidate,effectiveConfig:config});assert.equal(sends,0);
 const context={selfId:'bot',transportEnabled:true,transport:'bot',effectiveConfig:config};
 const admitted=gate.check(m,'mention',context);assert.equal(admitted.ok,true);await engine.autoReact(m,transport,{decision:admitted,effectiveConfig:config});assert.equal(sends,1);
 const limited=gate.check({...m,id:'m2'},'mention',context);assert.equal(limited.ok,false);await engine.autoReact({...m,id:'m2'},transport,{decision:limited,effectiveConfig:config});assert.equal(sends,1);
 const bot=gate.check({...m,id:'m3',author:{id:'other-bot',bot:true}},'mention',context);assert.equal(bot.ok,false);await engine.autoReact({...m,id:'m3'},transport,{decision:bot,effectiveConfig:config});assert.equal(sends,1);
});
