import test from 'node:test';
import assert from 'node:assert/strict';
import { BotTransport } from '../src/transport/bot.js';
import { PySelfTransport } from '../src/transport/pyself.js';
import { normalizeMessage, HistoryStore } from '../src/history.js';
import { classifyMessage } from '../src/features/message-policy.js';
import { ReplyGate } from '../src/features/gate.js';
import { createResponder } from '../src/features/responder.js';
import { createReactionEngine } from '../src/features/reactions.js';
import { Ledger } from '../src/ledger.js';
import { sanitizeConfig } from '../src/config.js';
import { createMessageSync } from '../src/features/message-sync.js';

const self='1560000000000000003', channel='1560000000000000004', other='1560000000000000005', guild='1560000000000000006';
const quiet={info(){},warn(){},error(){},debug(){}};
let sequence=0;
const id=()=>String((BigInt(Date.now()-1420070400000)<<22n)+BigInt(++sequence));
const config=extra=>sanitizeConfig({othersDm_dmReplyEnabled:true,enabled:true,userEnabled:true,botEnabled:true,userReceiveOnly:false,userAutoReply:true,
  dryRun:false,cooldownSeconds:0,roundCapPerUser:0,minReplyDelaySeconds:0,maxReplyDelaySeconds:0,
  userContextBootstrap:false,userSimulateTyping:false,simulateTyping:false,gifVisionEnabled:false,...extra});
const raw=(extra={})=>({id:id(),channel_id:channel,author:{id:other,username:'sender',global_name:'測試朋友',bot:false},content:'',timestamp:new Date().toISOString(),...extra});
function gateFor(c) { const ledger=new Ledger();ledger.configure(c);const gate=new ReplyGate({config:c,ledger,log:quiet});gate.configure(c);return gate; }

for (const kind of ['user','bot']) {
  for (const scenario of ['sticker','gif-attachment','gif-preview','gif-url','guild-mention','guild-reply','group-mention']) {
    test(`${kind}: ${scenario} reaches the real gate, prompt, model, and text send`, async () => {
      const c=config();const gate=gateFor(c);const sends=[];let prompt;
      const llm={listProviders:()=>[{provider:'fixture'}],prepareCall:async cfg=>({config:cfg,async *stream(req){prompt=JSON.stringify(req.messages);
        yield {type:'text-delta',text:'收到你的訊息了'};yield {type:'finish',reason:{kind:'stop'}};}})};
      const history=new HistoryStore({config:c});
      const responder=createResponder({ctx:{get:()=>llm},getConfig:()=>c,history,ledger:{record(){}},log:quiet,semaphore:{run:fn=>fn()}});
      let completed;
      const receive=m=>{const category=classifyMessage(m,self);const decision=gate.check(m,category,{selfId:self,transportEnabled:true,transport:kind});
        assert.equal(decision.ok,true,decision.reason);completed=responder.respond(m,category,transport);};
      const transport=kind==='bot'?new BotTransport({log:quiet,onMessage:receive}):new PySelfTransport({log:quiet,onMessage:receive});
      transport.selfId=self;transport.state='connected';transport.process={};transport.liveSince=1;transport.config=c;
      transport.sendMessage=async(c,o)=>{sends.push(o);return {ok:true,messageId:id()};};
      const d=raw();
      if(scenario==='sticker')d.sticker_items=[{id:'sticker',name:'開心貓咪'}];
      if(scenario==='gif-attachment')d.attachments=[{filename:'dance.gif',content_type:'image/gif',url:'https://example.test/dance.gif'}];
      if(scenario==='gif-preview')d.embeds=[{type:'gifv',title:'Dancing Cat',provider:{name:'Tenor'},url:'https://tenor.com/view/cat-gif-123'}];
      if(scenario==='gif-url')d.content='https://tenor.com/view/happy-cat-gif-123';
      if(scenario==='guild-mention'){d.guild_id=guild;d.content=`<@!${self}> 你好`;d.mentions=[{id:self}];}
      if(scenario==='guild-reply'){d.guild_id=guild;d.content='再說明一下';d.referenced_message={id:'prior',author:{id:self}};}
      if(scenario==='group-mention'){d.channelType='group';d.content=`<@${self}> 你好`;d.mentions=[{id:self}];}
      if(kind==='bot')await transport.handleMessage(d);
      else transport.event({event:'message',message:normalizeMessage(d,'user',self)});
      assert.ok(completed,'message was dropped before responder');await completed;
      assert.equal(sends.length,1);assert.ok(sends[0].content || sends[0].embed?.description);
      if(scenario==='sticker')assert.match(prompt,/開心貓咪/);
      if(scenario==='gif-attachment')assert.match(prompt,/GIF 附件.*dance.gif/);
      if(scenario==='gif-preview')assert.match(prompt,/Dancing Cat/);
      if(scenario==='gif-url')assert.match(prompt,/GIF 連結/);
    });
  }
}

test('Bot normalization preserves author, bot flag, DM, both mention forms and referenced author', async()=>{
  let message;const bot=new BotTransport({log:quiet,onMessage:m=>{message=m;}});bot.selfId=self;
  await bot.handleMessage(raw({content:`<@!${self}>`,guild_id:guild,author:{id:other,global_name:'BOT 名稱',bot:true}}));
  assert.equal(message.isMention,true);assert.equal(message.isDm,false);assert.equal(message.author.bot,true);assert.equal(message.author.name,'BOT 名稱');
  await bot.handleMessage(raw({content:'DM'}));assert.equal(message.isDm,true);assert.equal(classifyMessage(message,self),'dm');
  assert.equal(classifyMessage(normalizeMessage(raw({channelType:'group',content:'群聊'}),'user',self),self),'cochat');
});

test('user guild mentions bypass the cochat list, but ordinary messages and blacklisted channels do not',()=>{
  const received=[];const t=new PySelfTransport({log:quiet,onMessage:m=>received.push(m)});
  t.config=config({followupEnabled:false});t.selfId=self;t.process={};t.state='connected';t.liveSince=1;
  const send=d=>t.event({event:'message',message:normalizeMessage(d,'user',self)});
  send(raw({guild_id:guild,content:`<@${self}> hi`}));
  send(raw({guild_id:guild,content:'ordinary after mention'}));
  t.config={...t.config,blacklistChannelIds:[channel]};send(raw({guild_id:guild,content:`<@${self}> hi`}));
  assert.equal(received.filter(m=>!m.memoryOnly).length,1);
  assert.equal(received.filter(m=>m.memoryOnly).length,2);
});

test('media obeys real permissions, reply switches, quotas and cooldown; dry run does not bypass blacklists',()=>{
  const m=normalizeMessage(raw({sticker_items:[{id:'s',name:'cat'}]}),'user',self);
  for(const extra of [{blacklistUserIds:[other]},{whitelistUserIds:['someone-else']},{othersDm_dmReplyEnabled:false},{dryRun:true,blacklistChannelIds:[channel]}]) {
    assert.equal(gateFor(config(extra)).check(m,'dm',{selfId:self,transportEnabled:true}).ok,false);
  }
  const gate=gateFor(config({cooldownSeconds:20}));
  assert.equal(gate.check(m,'dm',{selfId:self,transportEnabled:true}).ok,true);
  assert.match(gate.check(m,'dm',{selfId:self,transportEnabled:true}).reason,/冷卻/);
});

test('round cap expires from the last reply, not reactions, while zero disables only the round cap',()=>{
  const ledger=new Ledger();const c=config({roundCapPerUser:5,roundResetMinutes:10});ledger.configure(c);
  const past=new Date(Date.now()-11*60000).toISOString();
  ledger.state.users[other]={rounds:5,lastReplyAt:past,lastAt:past};ledger.record('reaction',{userId:other});
  assert.equal(ledger.roundsExceeded(other,c),false);assert.equal(ledger.state.users[other].rounds,0);
  for(let i=0;i<5;i++)ledger.record('dm',{userId:other});
  assert.equal(ledger.roundsExceeded(other,c),true);assert.equal(ledger.roundsExceeded(other,{...c,roundCapPerUser:0}),false);
  assert.equal(ledger.usedToday('dm'),5);
});

test('cooldown exemptions apply only to listed users and never bypass quotas, blocks, or cochat cooldown',()=>{
  const c=config({cooldownSeconds:20,replyCooldownExemptUserIds:[other],coChatEnabled:true,coChatCooldownSeconds:30});
  const m=normalizeMessage(raw({content:'hi'}),'user');const context={selfId:self,transportEnabled:true};
  const gate=gateFor(c);
  for(const kind of ['dm','mention']) {
    assert.equal(gate.check(m,kind,context).ok,true);assert.equal(gate.check(m,kind,context).ok,true);
  }
  const stranger={...m,author:{id:'stranger'}};
  assert.equal(gate.check(stranger,'dm',context).ok,true);assert.match(gate.check(stranger,'dm',context).reason,/冷卻/);
  assert.equal(gate.check(m,'cochat',context).ok,true);assert.match(gate.check(m,'cochat',context).reason,/冷卻/);
  assert.match(gateFor({...c,blacklistUserIds:[other]}).check(m,'dm',context).reason,/黑名單/);
  const capped=gateFor({...c,maxDailyDmReplies:1});capped.ledger.record('dm',{userId:other});
  assert.match(capped.check(m,'dm',context).reason,/今日/);
});

test('only-guild reaction setting works identically for user and bot',async()=>{
  for(const kind of ['user','bot']){
    let sent=0;const c=config({autoReactionOnlyGuild:true,autoReactionEnabled:true,autoReactionChance:100});
    const engine=createReactionEngine({getConfig:()=>c,ledger:{record(){}},log:quiet});
    const t={kind,selfId:self,sendReaction:async()=>{sent++;return {ok:true};}};
    const m=normalizeMessage(raw({content:'hi'}),kind,self);
    await engine.autoReact(m,t,{decision:{ok:true}});assert.equal(sent,0);
    await engine.autoReact({...m,guildId:guild,isDm:false},t,{decision:{ok:true}});assert.equal(sent,1);
  }
});

test('unavailable GIF output falls back to a second text generation, never an empty send',async()=>{
  let calls=0;const sends=[];const c=config({gifEnabled:true,gifApiKey:'',gifProvider:'tenor'});
  const llm={listProviders:()=>[{provider:'fixture'}],prepareCall:async cfg=>({config:cfg,async *stream(){
    yield {type:'text-delta',text:++calls===1?'[GIF: happy cat]':'這隻貓真有趣'};yield {type:'finish',reason:{kind:'stop'}};}})};
  const responder=createResponder({ctx:{get:()=>llm},getConfig:()=>c,history:new HistoryStore({config:c}),ledger:{record(){}},log:quiet,semaphore:{run:fn=>fn()}});
  const transport={kind:'user',selfId:self,epoch:1,sendMessage:async(c,o)=>{sends.push(o);return {ok:true,messageId:id()};}};
  const result=await responder.respond(normalizeMessage(raw({content:'https://tenor.com/view/cat-gif-123'}),'user'),'dm',transport);
  assert.equal(result.ok,true);assert.equal(calls,2);assert.equal(sends[0].content,'這隻貓真有趣');
});

test('a GIF preview arriving during generation updates history without cancelling its pending answer',async()=>{
  let release, entered, sends=0;
  const wait=new Promise(r=>{release=r;}), started=new Promise(r=>{entered=r;});
  const c=config();const history=new HistoryStore({config:c});
  const message=normalizeMessage(raw({content:'https://tenor.com/view/cat-gif-123'}),'user');history.record(message);
  const llm={listProviders:()=>[{provider:'fixture'}],prepareCall:async cfg=>({config:cfg,async *stream(){entered();await wait;
    yield {type:'text-delta',text:'這個 GIF 真有趣'};yield {type:'finish',reason:{kind:'stop'}};}})};
  const responder=createResponder({ctx:{get:()=>llm},getConfig:()=>c,history,ledger:{record(){}},log:quiet,semaphore:{run:fn=>fn()}});
  const transport={kind:'user',epoch:1,selfId:self,sendMessage:async()=>{sends++;return {ok:true,messageId:id()};}};
  const pending=responder.respond(message,'dm',transport);await started;
  await createMessageSync({history,responder,log:quiet})({event:'message_preview',channelId:channel,messageId:message.id,
    embedDetails:[{type:'gifv',title:'Dancing Cat'}]},transport);
  assert.equal(history.find(channel,message.id).embedDetails[0].title,'Dancing Cat');
  assert.equal(history.revision(channel),0);
  release();assert.equal((await pending).ok,true);assert.equal(sends,1);
  assert.equal(history.find(channel,message.id).embedDetails[0].title,'Dancing Cat');
});
