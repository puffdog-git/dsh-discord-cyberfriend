import test from 'node:test';
import assert from 'node:assert/strict';
import { searchGifs } from '../src/gif.js';
import { BotTransport } from '../src/transport/bot.js';
import { createResponder } from '../src/features/responder.js';
import { sanitizeConfig } from '../src/config.js';
import { buildPrompt } from '../src/persona.js';
const quiet={info(){},warn(){},error(){}};
const items=[{id:'one',url:'https://klipy.com/gifs/one',src:'https://static.klipy.com/one.gif',title:'Happy Cat'},
  {id:'two',url:'https://klipy.com/gifs/two',src:'https://static.klipy.com/two.gif',title:'Another Happy Cat'}];

test('legacy Tenor settings migrate to KLIPY; Bot uses the verified minimum Discord search limit',async()=>{
  const config=sanitizeConfig({gifProvider:'tenor',gifApiKey:'old-secret'});
  assert.equal(config.gifProvider,'klipy');assert.equal(config.gifApiKey,undefined);
  const t=new BotTransport({log:quiet});let request;
  t.rest=async(method,path)=>{request={method,path};return items;};
  const result=await searchGifs(config,'happy cat',{transport:t});
  assert.equal(result.ok,true);assert.match(request.path,/provider=klipy/);assert.match(request.path,/limit=20/);
  assert.equal(result.results[0].url,items[0].url);
});

for(const kind of ['bot','user'])test(`${kind}: sends ranked KLIPY links with text, avoids immediate duplicates, records only successful sends`,async()=>{
  const config=sanitizeConfig({dryRun:false,gifEnabled:true,minReplyDelaySeconds:0,maxReplyDelaySeconds:0,
    userContextBootstrap:false,userSimulateTyping:false});
  let prompt;const sent=[],counts=[];
  const llm={listProviders:()=>[{id:'fixture'}],prepareCall:async config=>({config,async *stream(req){prompt=JSON.stringify(req.messages);
    yield {type:'text-delta',text:'這是文字回答 [GIF: happy cat]'};}})};
  const t={kind,selfId:'self',searchGifs:async()=>({ok:true,items}),sendMessage:async(c,o)=>{sent.push(o);return {ok:true,messageId:'reply'};}};
  const responder=createResponder({ctx:{llm},getConfig:()=>config,history:{contextText:()=>'',record(){}},
    ledger:{record:k=>counts.push(k)},log:quiet,semaphore:{run:fn=>fn()}});
  for(let i=0;i<2;i++)await responder.respond({id:String(i),channelId:'channel',author:{id:'other'},content:'說明並附 GIF'},'dm',t);
  assert.match(sent[0].content,/klipy.com\/gifs\/one/);assert.match(sent[1].content,/klipy.com\/gifs\/two/);
  assert.equal(sent[0].fileUrls,undefined);assert.ok(sent[0].content.includes('文字回答') || sent[0].embed?.description.includes('文字回答'));
  assert.equal(counts.filter(k=>k==='gif').length,2);assert.match(prompt,/必須先用文字回答/);
  t.sendMessage=async()=>({ok:false,error:'fixture'});
  await responder.respond({id:'3',channelId:'channel',author:{id:'other'},content:'again'},'dm',t);
  assert.equal(counts.filter(k=>k==='gif').length,2);
});

test('GIF whitelist blocks generated tags; model must produce a text fallback',async()=>{
  const config=sanitizeConfig({dryRun:false,gifAccessMode:'whitelist',gifAccessWhitelist:['allowed'],userContextBootstrap:false,
    minReplyDelaySeconds:0,maxReplyDelaySeconds:0});let calls=0,searches=0,sent;
  const llm={listProviders:()=>[{id:'fixture'}],prepareCall:async config=>({config,async *stream(){yield {type:'text-delta',text:++calls===1?'[GIF: cat]':'文字備援'};}})};
  const responder=createResponder({ctx:{llm},getConfig:()=>config,history:{contextText:()=>'',record(){}},ledger:{record(){}},log:quiet,semaphore:{run:f=>f()}});
  await responder.respond({id:'1',channelId:'c',author:{id:'blocked'},content:'hi'},'dm',
    {kind:'bot',searchGifs:async()=>{searches++;return {ok:true,items};},sendMessage:async(c,o)=>{sent=o;return {ok:true};}});
  assert.equal(searches,0);assert.equal(calls,2);assert.match(sent.content || sent.embed?.description,/文字備援/);
  assert.match(buildPrompt({config:{...config,gifEnabled:false},kind:'dm'}).system,/本次不可使用 GIF/);
});
