import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {Readable} from 'node:stream';
import {managementRejection} from '../src/http-security.js';import {createApiHandler} from '../src/api.js';
import {createConfigVault} from '../src/config-vault.js';import {HubLogger} from '../src/logger.js';
import {DiscordTts} from '../src/tts-adapters.js';import {VoiceMessages,pcmWav} from '../src/voice-messages.js';
import {createJapaneseSpeech} from '../src/speech-language.js';
const request=(headers={},method='GET')=>({method,headers:{host:'127.0.0.1:1234',...headers}});
const host=status=>({get:n=>n==='connection'?{requestRejection:()=>status}:undefined});
test('management boundary rejects cross-site, missing/forged auth, unavailable Host and non-JSON writes',async()=>{
 assert.equal(await managementRejection(request(),host(401)),401);
 assert.equal(await managementRejection(request({authorization:'Bearer made-up',cookie:'dsh-auth-fake=made-up'}),host(401)),401);
 assert.equal(await managementRejection(request(),{}),503);
 assert.equal(await managementRejection(request({origin:'https://untrusted.invalid'}),host()),403);
 assert.equal(await managementRejection(request({'sec-fetch-site':'cross-site'}),host()),403);
 assert.equal(await managementRejection(request({'content-type':'text/plain'},'POST'),host()),415);
 assert.equal(await managementRejection(request({'content-type':'application/json; charset=utf-8',origin:'http://127.0.0.1:1234'},'POST'),host()),undefined);
});
test('cross-site configuration write never reaches setter and authenticated JSON does',async()=>{
 let writes=0;const handler=createApiHandler({ctx:host(),getConfig:()=>({}),setConfig:async()=>{writes++;return {ok:true}},getLogger:()=>({error(){}})});
 async function run(headers){const req=Readable.from([Buffer.from('{}')]);Object.assign(req,request(headers,'POST'),{url:'/api/discord-cyberfriend/config'});let body;const res={setHeader(){},end(v){body=JSON.parse(v)}};await handler(req,res);return {code:res.statusCode,body}}
 assert.equal((await run({origin:'https://untrusted.invalid','content-type':'text/plain'})).code,403);assert.equal(writes,0);
 assert.equal((await run({'content-type':'text/plain'})).code,415);assert.equal(writes,0);
 assert.equal((await run({'content-type':'application/json'})).code,200);assert.equal(writes,1);
});
test('real OS protection migrates legacy credentials without plaintext and survives reopening',{skip:process.platform!=='win32'},async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'discord-vault-'));try{const file=path.join(root,'config.json'),original={enabled:true,userToken:'fixture-user-opaque',botToken:'fixture-bot-opaque',customLlmApiKey:'fixture-api-opaque',gifApiKey:'fixture-gif-opaque'};
 await fs.writeFile(file,JSON.stringify(original));const vault=createConfigVault({file});assert.deepEqual(await vault.read(),original);await vault.save(original);
 const raw=await fs.readFile(file,'utf8');for(const value of Object.values(original).filter(x=>typeof x==='string'))assert.ok(!raw.includes(value));
 const restored=await createConfigVault({file}).read();for(const [k,v]of Object.entries(original))assert.equal(restored[k],v);
 const bad=createConfigVault({file,protect:async()=>{throw Error('fixture encryption failed')}});await assert.rejects(bad.save({...original,enabled:false}));assert.equal(await fs.readFile(file,'utf8'),raw);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('non-Windows credential storage fails closed without a Host vault',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'discord-vault-unavailable-'));try{const file=path.join(root,'config.json');const vault=createConfigVault({file,platform:'linux'});await assert.rejects(vault.save({userToken:'private'}));await assert.rejects(fs.stat(file),/ENOENT/)}finally{await fs.rm(root,{recursive:true,force:true})}
});
test('logger removes known opaque credentials and nested Bearer/query secrets from summaries and errors',()=>{
 const logger=new HubLogger({toFile:false});logger.configure({botToken:'opaque-fixture-bot-secret'});
 const entry=logger.error('fixture','bad opaque-fixture-bot-secret',{error:'Bearer fixture-value https://example.invalid/?api_key=opaque-query',nested:{detail:'opaque-fixture-bot-secret'},apiKey:'private'});
 const raw=JSON.stringify(entry);for(const s of ['opaque-fixture-bot-secret','fixture-value','opaque-query','private'])assert.ok(!raw.includes(s));
});
test('existing log files are atomically scrubbed before new logging starts',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'discord-log-redact-'));try{
 const logger=new HubLogger({dir:root,toFile:false});logger.configure({botToken:'opaque-old-log-fixture'});
 const file=logger.fileName();await fs.writeFile(file,JSON.stringify({event:'old',summary:'opaque-old-log-fixture',data:{error:'{"password":"json-fixture-password"}',details:['opaque-old-log-fixture']}})+'\n');
 await logger.init();assert.equal(logger.fileWritable,true);const raw=await fs.readFile(file,'utf8');assert.ok(!raw.includes('opaque-old-log-fixture'));assert.ok(!raw.includes('json-fixture-password'));assert.equal(JSON.parse(raw).event,'old');
 }finally{assert.equal(path.dirname(root),os.tmpdir());await fs.rm(root,{recursive:true,force:true})}
});
test('API exception output and event log never contain configured opaque credentials',async()=>{
 const secret='opaque-api-fixture-secret',logger=new HubLogger({toFile:false});logger.configure({customLlmApiKey:secret});
 const handler=createApiHandler({ctx:host(),getConfig:()=>({customLlmApiKey:secret}),getManager:()=>{throw Error('bad '+secret)},getLogger:()=>logger});
 const req=Readable.from([]);Object.assign(req,request(),{url:'/api/discord-cyberfriend/presence'});let body='';await handler(req,{setHeader(){},end(v){body=v}});assert.ok(!body.includes(secret));assert.ok(!JSON.stringify(logger.recent()).includes(secret));
});
test('explicit Host TTS selection wins with both services present and never falls back',async()=>{
 const calls=[];const service=id=>({capabilities:()=>({engine:{ready:true}}),synthesize:async()=>{calls.push(id);if(id==='host'&&calls.length>1)throw Error('fixture billed failure');return {data:Buffer.from(id)}}});
 const ours=service('ours'),remote=service('host'),cfg={voiceTtsAdapter:'service',voiceTtsService:'speechSynthesis'};
 const tts=new DiscordTts({ctx:{get:n=>n==='dshTts'?ours:n==='speechSynthesis'?remote:undefined},getConfig:()=>cfg,fetchImpl:()=>{throw Error('unexpected HTTP')}});
 assert.equal((await tts.synthesize({text:'你好'})).data.toString(),'host');assert.equal(tts.capabilities().serviceId,'speechSynthesis');await assert.rejects(tts.synthesize({text:'再次'}));assert.deepEqual(calls,['host','host']);
 cfg.voiceTtsService='dshTts';assert.equal((await tts.synthesize({text:'切換'})).data.toString(),'ours');
});
test('missing explicitly selected TTS service is unready even when another service exists',async()=>{
 const tts=new DiscordTts({ctx:{get:n=>n==='dshTts'?{capabilities:()=>({engine:{ready:true}}),synthesize:()=>{throw Error('wrong provider')}}:undefined},getConfig:()=>({voiceTtsService:'speechSynthesis'}),fetchImpl:()=>{throw Error('unexpected HTTP')}});
 assert.equal((await tts.refresh()).engine.ready,false);await assert.rejects(tts.synthesize({text:'不能偷換'}));
});
function recordedFixture(){const calls=[],config={voiceMessageEnabled:true,voiceMessageChannelIds:['c'],voiceMessageUserIds:['u'],voiceSpokenLanguage:'ja',voiceJapaneseFallback:false,voiceMaxTextChars:500,voiceDailyCharacterLimit:1000,voiceMaxSpeechSeconds:5},voice={usage:{days:{}},day:()=> 'today',save:async()=>{},tts:{refresh:async()=>{},synthesize:async args=>{calls.push(args);return {data:pcmWav(Buffer.alloc(32000))}}}},messages=new VoiceMessages({ctx:{},voice,getConfig:()=>config});return {calls,config,voice,messages,message:{channelId:'c',author:{id:'u'}},options:{signal:new AbortController().signal}}}
test('recorded replies use provided Japanese once, count spoken characters and preserve Chinese separately',async()=>{
 const f=recordedFixture(),sent=[];const result=await f.messages.sendReply(f.message,{sendMessage:async(c,b)=>{sent.push(b);if(b.voiceMessage)assert.equal((await fs.readFile(b.files[0])).subarray(0,4).toString(),'OggS');return {ok:true,messageId:String(sent.length)}}},'歡迎回來。',f.options,{kind:'mention',sessionId:'session-one',spokenText:'おかえりなさい。'});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,'おかえりなさい。');assert.equal(f.calls[0].sourceText,'歡迎回來。');assert.equal(f.calls[0].spokenLanguage,'ja');assert.equal(f.voice.usage.days.today.characters,'おかえりなさい。'.length);assert.equal(sent[1].content,'歡迎回來。');assert.equal(result.textDelivered,true);
});
test('missing Japanese with fallback disabled preserves text without Chinese speech or TTS charge',async()=>{
 const f=recordedFixture(),sent=[];const result=await f.messages.sendReply(f.message,{sendMessage:async(c,b)=>{sent.push(b);return {ok:true,messageId:'text'}}},'中文仍保留。',f.options,{kind:'mention'});
 assert.equal(result.voiceSkipped,true);assert.equal(sent[0].content,'中文仍保留。');assert.equal(f.calls.length,0);assert.deepEqual(f.voice.usage.days,{});
});
test('recorded Japanese fallback uses the existing translation seam once and forwards its scope',async()=>{
 const f=recordedFixture();f.config.voiceJapaneseFallback=true;const translations=[];f.messages.japanese=createJapaneseSpeech({generate:async(_ctx,_cfg,args)=>{translations.push(args);return {ok:true,text:JSON.stringify({translation:'こんにちは。'})}}});
 await f.messages.sendReply(f.message,{sendMessage:async()=>({ok:true,messageId:'fixture'})},'你好。',f.options,{kind:'mention',sessionId:'scope-one'});
 assert.equal(translations.length,1);assert.equal(translations[0].usageCategory,'speech-translation');assert.equal(translations[0].usageScope,'scope-one');assert.equal(f.calls[0].text,'こんにちは。');
});
test('cancelling recorded Japanese preparation does not send text, voice or start TTS',async()=>{
 const f=recordedFixture(),controller=new AbortController();let release,started;const ready=new Promise(r=>started=r);f.config.voiceJapaneseFallback=true;
 f.messages.japanese=createJapaneseSpeech({generate:async()=>{started();await new Promise(r=>release=r);return {ok:true,text:'{"translation":"こんにちは。"}'}}});let sends=0;
 const work=f.messages.sendReply(f.message,{sendMessage:async()=>{sends++;return {ok:true}}},'你好。',{signal:controller.signal},{kind:'mention'});await ready;controller.abort();release();await assert.rejects(work);assert.equal(sends,0);assert.equal(f.calls.length,0);
});
