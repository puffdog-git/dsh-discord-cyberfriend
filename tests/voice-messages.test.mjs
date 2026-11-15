import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {VoiceMessages,pcmWav,decodeVoiceMessage} from '../src/voice-messages.js';
import {BotTransport} from '../src/transport/bot.js';
import {normalizeMessage} from '../src/history.js';
import {createResponder} from '../src/features/responder.js';
import {sanitizeConfig} from '../src/config.js';
const U='400000000000000001',C='400000000000000008';
function fixture(){const c={voiceMessageEnabled:true,voiceMessageChannelIds:[C],voiceMessageUserIds:[U],voiceMessageMaxSeconds:5,voiceSttDailySeconds:20,voiceSttProvider:'local',voiceSttLanguage:'zh',voiceMaxTextChars:500,voiceDailyCharacterLimit:1000,voiceMaxSpeechSeconds:10},pcm=Buffer.alloc(32000);for(let i=0;i<16000;i++)pcm.writeInt16LE(Math.round(Math.sin(i*Math.PI*2*440/16000)*5000),i*2);const wav=pcmWav(pcm),calls=[],voice={usage:{days:{}},day:()=> 'today',save:async()=>{},tts:{refresh:async()=>{},synthesize:async r=>{calls.push({tts:r});return {data:wav}}}},ctx={get:()=>({resolve:r=>r,transcribe:async r=>{calls.push({stt:r});return {text:'明天下午三點到圖書館'}}})},vm=new VoiceMessages({ctx,voice,getConfig:()=>c,fetchImpl:async()=>{calls.push({download:true});return new Response(wav)}}),message={id:'123456789012345678',channelId:C,guildId:'400000000000000004',author:{id:U},attachments:[{name:'voice-message.ogg',url:'https://cdn.discordapp.com/attachments/400000000000000008/123456789012345678/voice.ogg',contentType:'audio/ogg',size:wav.length}]};return {c,wav,calls,voice,vm,message}}
test('recorded voice admission is independent of room listening and rejects unrelated users/channels/cochat/simulation before download',async()=>{
 const f=fixture();for(const [m,kind]of [[{...f.message,channelId:'other'},'mention'],[{...f.message,author:{id:'other'}},'mention'],[f.message,'cochat'],[{...f.message,simulated:true},'mention']])assert.equal(await f.vm.prepareIncoming(m,{}, {kind,signal:AbortSignal.timeout(5000)}),null);assert.equal(f.calls.length,0);
 const result=await f.vm.prepareIncoming(f.message,{}, {kind:'mention',signal:AbortSignal.timeout(5000)});assert.match(result.text,/圖書館/);assert.equal(result.audioSeconds,1);assert.equal(f.voice.usage.days.today.sttSeconds,1);assert.equal(f.calls[1].stt.providerId,'local');
});
test('quoted recordings are read only from the same channel and allowed author; hostile URLs never download',async()=>{
 const f=fixture(),m={...f.message,attachments:[],replyTo:'prior'};
 assert.ok(await f.vm.prepareIncoming(m,{getMessage:async()=>({ok:true,message:f.message})},{kind:'mention',signal:AbortSignal.timeout(5000)}));
 assert.equal(await f.vm.prepareIncoming(m,{getMessage:async()=>({ok:true,message:{...f.message,channelId:'elsewhere'}})},{kind:'mention'}),null);
 await assert.rejects(f.vm.prepareIncoming(m,{getMessage:async()=>({ok:true,message:{...f.message,author:{id:'other'}}})},{kind:'mention'}),/作者未列入/);
 await assert.rejects(f.vm.prepareIncoming({...f.message,attachments:[{...f.message.attachments[0],url:'http://127.0.0.1/secret'}]}, {},{kind:'mention'}),/Discord 附件/);
});
test('decoded duration and daily STT budget reject oversized recordings without a model call',async()=>{
 const f=fixture();await assert.rejects(decodeVoiceMessage(pcmWav(Buffer.alloc(6*32000)),AbortSignal.timeout(5000),5),/時長/);f.c.voiceSttDailySeconds=.5;await assert.rejects(f.vm.prepareIncoming(f.message,{}, {kind:'mention'}),/預算/);assert.ok(!f.calls.some(x=>x.stt));
});
test('voice reply creates real Ogg Opus with measured waveform and cleans temporary output after delivery',async()=>{
 const f=fixture();let filename,payload;const t=new BotTransport({});t.rest=async(method,path,body)=>{const form=body.form,p=JSON.parse(form.get('payload_json'));payload=p;assert.equal(p.flags,8192);assert.equal(p.attachments[0].duration_secs,1);assert.ok(Buffer.from(p.attachments[0].waveform,'base64').length<=256);const file=form.get('files[0]');assert.equal(file.type,'audio/ogg');assert.equal(Buffer.from(await file.arrayBuffer()).toString('ascii',0,4),'OggS');return {id:'voice-reply'}};
 const result=await f.vm.sendReply(f.message,{sendMessage:async(channel,o)=>{filename=o.files[0];assert.ok((await readFile(filename)).length>64);return t.sendMessage(channel,o)}},'記得明天下午三點到圖書館。',{signal:AbortSignal.timeout(5000),replyToMessageId:f.message.id},{kind:'mention',sessionId:'real-scope'});assert.equal(result.ok,true);assert.equal(payload.content,undefined);assert.equal(f.calls.find(x=>x.tts).tts.sessionId,'real-scope');await assert.rejects(stat(filename),/ENOENT/);
});
test('voice message metadata survives ingress and invalid send format fails without HTTP',async()=>{
 const m=normalizeMessage({flags:8192,attachments:[{filename:'voice.ogg',duration_secs:2,waveform:'AQI='}]},'bot');assert.equal(m.isVoiceMessage,true);assert.equal(m.attachments[0].durationSecs,2);const t=new BotTransport({});t.rest=()=>{throw Error('unexpected network')};assert.equal((await t.sendMessage(C,{content:'not allowed',files:['a'],voiceMessage:{durationSecs:1,waveform:'AQI='}})).ok,false);
});

test('actual responder puts decoded audio in model context and delivers one native voice message without room playback',async()=>{
 const f=fixture(),c=sanitizeConfig({enabled:true,dryRun:false,replyEngine:'dsh',minReplyDelaySeconds:0,maxReplyDelaySeconds:0,gifEnabled:false,botEmbedReplies:true}),records=[];let prompt,delivered=0,roomPlayback=0;
 const history={find:()=>null,record:m=>records.push(m),contextText:()=>''},transport={kind:'bot',ready:true,selfId:'bot',selfName:'AI',sendMessage:async()=>{throw Error('plain text must not be sent')}};
 const responder=createResponder({getConfig:()=>c,history,ledger:{record(){}},log:{info(){},debug(){},warn(){},error(){}},semaphore:{run:f=>f()},prepareMedia:async()=>({images:[]}),sessionBridge:{run:async(m,t,c,o)=>{prompt=o.user;return {ok:true,text:'明天下午三點，記得去圖書館。',sessionId:'session'}}},voiceMessages:{prepareIncoming:f.vm.prepareIncoming.bind(f.vm),sendReply:async(m,t,text,o,meta)=>{assert.equal(o.signal.aborted,false);assert.equal(meta.kind,'mention');assert.match(text,/圖書館/);delivered++;return {ok:true,messageId:'audio-message'}}},onTextDelivered:()=>roomPlayback++});
 const result=await responder.respond({...f.message,content:'<@bot>',stickers:[],embedDetails:[]},'mention',transport);assert.equal(result.ok,true);assert.match(prompt,/明天下午三點到圖書館/);assert.equal(delivered,1);assert.equal(roomPlayback,0);assert.ok(records.some(x=>x.id==='audio-message'));
});

test('separate mention and recording pair in both orders, once, within the same author/channel/transport',async()=>{
 const f=fixture(),botId='1560000000000000001',t={kind:'bot',selfId:botId},mention={...f.message,id:'mention',content:`<@${botId}>`,isMention:true,attachments:[]};
 assert.equal(await f.vm.routeIncoming(f.message,t),null);const paired=await f.vm.routeIncoming(mention,t);assert.equal(paired.voiceMessageSource.id,f.message.id);assert.equal(await f.vm.routeIncoming(mention,t),null);
 const next={...f.message,id:'next',memoryOnly:true};const directed=await f.vm.routeIncoming(next,t);assert.equal(directed.isMention,true);assert.equal(directed.memoryOnly,false);
 assert.equal(await f.vm.routeIncoming(mention,t),null);const outside={...next,id:'else',author:{id:'not-allowed'}};assert.equal(await f.vm.routeIncoming(outside,t),outside);const pendingKey=[t.kind,t.selfId,C,U].join(':');f.vm.pendingMentions.get(pendingKey).at-=91000;assert.equal(await f.vm.routeIncoming({...next,id:'late'},t),null);
 const textQuestion={...mention,content:`<@${botId}> 請說明一下`};assert.equal(await f.vm.routeIncoming(textQuestion,t),textQuestion);
});

test('recorded message uses the same terminology settings before model context',async()=>{
 const f=fixture();f.c.voiceSttLanguage='zh';f.c.voiceTranscriptGlossary='{"图书馆":"市立圖書館"}';f.vm.ctx={get:()=>({resolve:r=>r,transcribe:async()=>({text:'明天下午3点到图书馆。'})})};const r=await f.vm.prepareIncoming(f.message,{}, {kind:'mention'});assert.equal(r.text,'明天下午3點到市立圖書館。');assert.equal(r.normalization.corrections,1);
});
