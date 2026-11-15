import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DiscordVoice} from '../src/voice.js';
import {audioFile,prepareVoiceAudio,musicRequest} from '../src/voice-audio.js';
import {sanitizeConfig} from '../src/config.js';
import {BotTransport} from '../src/transport/bot.js';
const CH='400000000000000005',G='400000000000000004',TEXT='400000000000000006';
const turn=()=>new Promise(r=>setImmediate(r));
test('successful room audio replays without synthesis/character charges and cannot cross a rejoin',async()=>{
 const f=await fixture({voiceReplayEnabled:true,voiceStreaming:false});try{await f.voice.join({kind:'bot',channelId:CH,guildId:G,textChannelId:TEXT});const first=f.voice.speak({text:'已生成的原音訊',replayRef:'reply-1'});await until(()=>f.adapters[0].plays.length===1);f.adapters[0].plays[0].finish({ok:true});await first.done;await until(()=>!f.voice.sessions.get('bot').current);const count=f.voice.usage.days[f.voice.day()].characters;assert.equal(f.voice.replays.list().length,1);const replay=f.voice.replay({kind:'bot',id:'reply-1'});await until(()=>f.adapters[0].plays.length===2);f.adapters[0].plays[1].finish({ok:true});await replay.done;await until(()=>!f.voice.sessions.get('bot').current);assert.equal(f.syntheses.length,1);assert.equal(f.voice.usage.days[f.voice.day()].characters,count);await f.voice.leave('bot');await f.voice.join({kind:'bot',channelId:CH,guildId:G,textChannelId:TEXT});assert.throws(()=>f.voice.replay({kind:'bot',id:'reply-1'}),/找不到/);}finally{await f.close()}
});
test('complete normalized PCM stream is retained as WAV for replay without a second provider call',async()=>{
 const f=await fixture({voiceReplayEnabled:true,voiceStreaming:true});let calls=0;try{await f.voice.join({kind:'bot',channelId:CH,guildId:G,textChannelId:TEXT});f.voice.tts.canStream=()=>true;f.voice.tts.streamPcm=async function*(){calls++;yield Buffer.alloc(48000)};f.adapters[0].playStream=async(stream,{onStarted})=>{onStarted();let bytes=0;for await(const chunk of stream)bytes+=chunk.length;assert.ok(bytes>0);return {ok:true}};const first=f.voice.speak({text:'串流語音',replayRef:'stream-reply'});await first.done;await until(()=>!f.voice.sessions.get('bot').current);const row=f.voice.replays.get('stream-reply',f.voice.replayScope(f.voice.session('bot')));assert.equal(row.data.toString('ascii',0,4),'RIFF');assert.equal(row.data.length,48044);const replay=f.voice.replay({kind:'bot',id:'stream-reply'});await until(()=>f.adapters[0].plays.length===1);f.adapters[0].plays[0].finish({ok:true});await replay.done;assert.equal(calls,1);assert.equal(f.syntheses.length,0);}finally{await f.close()}
});
async function until(fn){for(let n=0;n<1000;n++){if(fn())return;await new Promise(r=>setTimeout(r,2));}assert.fail('fixture timed out');}
async function fixture(overrides={}){
 const root=await mkdtemp(join(tmpdir(),'voice-tests-'));let now=1000000;
 const config=sanitizeConfig({enabled:true,userEnabled:true,botEnabled:true,userReceiveOnly:false,userAutoReply:true,dryRun:false,voiceEnabled:true,voiceAllowedChannelIds:[CH],voiceIdleMinutes:1,...overrides});
 const transport={ready:true,selfId:'1560000000000000001',rest:async()=>({guild_id:G,type:0}),rpc:async()=>({ok:true})};
 const adapters=[],syntheses=[];let synth=async p=>{syntheses.push(p);return {data:Buffer.from('audio')};};
 const voice=new DiscordVoice({ctx:{get:()=>({synthesize:p=>synth(p),capabilities:()=>({provider:'fixture',engine:{ready:true}})})},getConfig:()=>config,getManager:()=>({byKind:{bot:transport,user:transport}}),file:join(root,'usage.json'),now:()=>now,
  adapterFactory:()=>{const a={connected:false,plays:[],join:async()=>{a.connected=true;},leave:async()=>{a.connected=false;return {ok:true};},stop:async()=>{},play:async(path,{signal})=>new Promise(resolve=>{const row={path,finish:resolve};a.plays.push(row);signal.addEventListener('abort',()=>resolve({ok:false,interrupted:true}),{once:true});if(signal.aborted)resolve({ok:false,interrupted:true});})};adapters.push(a);return a;},
  makeFile:async()=>({path:'fixture-audio',remove:async()=>{}}),prepare:async()=>({path:'fixture-opus',durationMs:60000,remove:async()=>{}})});
 await voice.init();return {voice,config,transport,adapters,syntheses,setSynth:fn=>synth=fn,advance:n=>now+=n,close:async()=>{await voice.dispose();await until(()=>[...voice.sessions.values()].every(s=>!s.running));await voice.saves;await rm(root,{recursive:true,force:true});}};
}
test('voice defaults remain off; joining needs saved room allowlist, correct account and writable mode',async()=>{
 assert.equal(sanitizeConfig({}).voiceEnabled,false);const f=await fixture();try{await assert.rejects(f.voice.join({kind:'bot',channelId:TEXT,guildId:G}),/允許清單/);f.config.dryRun=true;await assert.rejects(f.voice.join({kind:'bot',channelId:CH,guildId:G}),/演練/);f.config.dryRun=false;f.config.userReceiveOnly=true;await assert.rejects(f.voice.join({kind:'user',channelId:CH,guildId:G}),/觀察/);assert.equal(f.adapters.length,0);}finally{await f.close();}
});

test('empty room list permits both accounts; saved restrictions still apply during playback', async () => {
 for (const kind of ['bot', 'user']) {
  const f = await fixture({ voiceAllowedChannelIds: [] });
  try {
   await f.voice.join({ kind, channelId: CH, guildId: G });
   const room = f.voice.sessions.get(kind);
   assert.doesNotThrow(() => f.voice.check(room));
   f.config.voiceAllowedChannelIds = [TEXT];
   assert.throws(() => f.voice.check(room), /允許房間/);
   await f.voice.tick();
   assert.equal(f.voice.sessions.size, 0);
  } finally { await f.close(); }
 }
});

test('both accounts recheck room restrictions after a pending unrestricted join', async () => {
 for (const kind of ['bot', 'user']) {
  const f = await fixture({ voiceAllowedChannelIds: [] });
  let release;
  try {
   f.voice.adapters = () => ({ join: () => new Promise(r => release = r), leave: async () => {} });
   const joining = f.voice.join({ kind, channelId: CH, guildId: G });
   await until(() => release);
   f.config.voiceAllowedChannelIds = [TEXT];
   release();
   await assert.rejects(joining, /設定已變更/);
   assert.equal(f.voice.sessions.size, 0);
  } finally { release?.(); await f.close(); }
 }
});

test('bot room discovery includes voice names only when requested; default channel lists stay textual', async () => {
 const bot = Object.create(BotTransport.prototype);
 bot.rest = async () => [{ id: CH, name: '音樂房', type: 2 }, { id: TEXT, name: '聊天', type: 0 },
  { id: 'category', type: 4 }, { id: 'stage', type: 13 }];
 assert.deepEqual((await bot.getChannels(G)).channels.map(c => c.id), [TEXT]);
 const rooms = (await bot.getChannels(G, { includeVoice: true })).channels;
 assert.deepEqual(rooms.map(c => c.name), ['音樂房', '聊天']);
 assert.equal(rooms[0].guildId, G);
});

test('speech-triggered interruption records its cause instead of a generic aborted error',async()=>{
 const f=await fixture();try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});const job=f.voice.speak({kind:'bot',text:'等待插話取消測試'});await until(()=>f.adapters[0].plays.length===1);f.voice.interruptForInput('bot');assert.equal((await job.done).ok,false);await until(()=>!f.voice.sessions.get('bot').current);assert.match(f.voice.sessions.get('bot').lastResult.error,/依插話設定中止播放/);}finally{await f.close()}
});

test('disconnect while TTS is preparing cancels late audio and queued speech; recovery never sends either',async()=>{
 const f=await fixture();let release;try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});f.setSynth(()=>new Promise(r=>release=r));const first=f.voice.speak({text:'尚未合成完成的舊回覆'});await until(()=>release);const second=f.voice.speak({text:'另一個待播回覆'});const a=f.adapters[0];a.connected=false;f.voice.connectionLost('bot',a,'測試斷線，停止舊音訊');release({data:Buffer.from('audio')});assert.equal((await first.done).ok,false);assert.equal((await second.done).ok,false);await until(()=>!f.voice.sessions.get('bot').running);a.connected=true;await f.voice.tick();assert.equal(a.plays.length,0);assert.equal(f.voice.sessions.get('bot').queue.length,0);
 }finally{release?.({data:Buffer.from('audio')});await f.close()}
});

test('incremental model sentences reach real FFmpeg before the final sentence exists and use a single playback',async()=>{
 const f=await fixture({voiceIncrementalReplies:true,voiceAutoSpeak:true,voiceStreaming:true});let heard,plays=0;const firstAudio=new Promise(r=>heard=r),calls=[];
 try{await f.voice.join({kind:'bot',channelId:CH,guildId:G,textChannelId:TEXT});f.voice.tts.canStream=()=>true;f.voice.tts.streamPcm=async function*(request){calls.push(request.text);yield Buffer.alloc(9600);};f.adapters[0].playStream=async(stream,{onStarted})=>{plays++;let n=0;for await(const chunk of stream){if(!n){onStarted();heard();}n+=chunk.length;}return {ok:n>0}};
 const live=f.voice.beginIncremental({voiceInput:true,guildId:G,channelId:TEXT},{kind:'bot'},{maxChars:100});live.push('第一句。');await firstAudio;assert.deepEqual(calls,['第一句。']);assert.equal(f.voice.sessions.get('bot').current.phase,'playing');live.push('第二句。');live.end();assert.equal((await live.done).ok,true);assert.equal(plays,1);assert.deepEqual(calls,['第一句。','第二句。']);assert.equal(f.syntheses.length,0);assert.equal(f.voice.status().usage.characters,8);assert.equal(f.voice.sessions.get('bot').lastResult.streamMode,'incremental');
 }finally{await f.close()}
});

test('disconnect aborts incremental speech even while it is waiting for the model next sentence',async()=>{
 const f=await fixture({voiceIncrementalReplies:true,voiceAutoSpeak:true,voiceStreaming:true});let heard;const first=new Promise(r=>heard=r);
 try{await f.voice.join({kind:'bot',channelId:CH,guildId:G,textChannelId:TEXT});f.voice.tts.canStream=()=>true;f.voice.tts.streamPcm=async function*(){yield Buffer.alloc(9600)};f.adapters[0].playStream=async(stream,{onStarted})=>{for await(const _ of stream){onStarted();heard();}return {ok:true}};
 const live=f.voice.beginIncremental({voiceInput:true,guildId:G,channelId:TEXT},{kind:'bot'},{maxChars:100});live.push('先說一句。');await first;f.voice.connectionLost('bot',f.adapters[0],'語音斷線');assert.equal((await live.done).ok,false);assert.throws(()=>live.push('不應晚到的第二句'),/取消|斷線/);await until(()=>!f.voice.sessions.get('bot').running);assert.equal(f.voice.sessions.get('bot').lastResult.ok,false);
 }finally{await f.close()}
});
test('streaming queue preserves Japanese source and direction, starts audio before completion, and never uses the file route',async()=>{
 const f=await fixture({voiceSpokenLanguage:'ja',voiceStreaming:true,voiceSubtitles:true});let release,heard,request;const gate=new Promise(r=>release=r),first=new Promise(r=>heard=r);try{
  await f.voice.join({kind:'bot',channelId:CH,guildId:G});f.voice.tts={refresh:async()=>{},capabilities:()=>({engine:{ready:true}}),canStream:()=>true,streamPcm:async function*(r){request=r;r.onPrepared?.({sourceText:r.sourceText,text:r.text,spokenLanguage:'ja'});yield Buffer.alloc(4800);await gate;yield Buffer.alloc(4800);r.onStreamInfo?.({mode:'native'})},synthesize:()=>{throw Error('file route must not run')}};
  const adapter=f.adapters[0];adapter.playStream=async(stream,{onStarted})=>{let started=false;for await(const _ of stream){if(!started){started=true;onStarted();heard()}}return {ok:true}};
  const job=f.voice.speak({text:'歡迎回來。',spokenText:'おかえりなさい。',sessionId:'voice-persona',speechDirection:{emotion:'happy',intensity:.5,pace:'normal'}});await first;assert.equal(request.sourceText,'歡迎回來。');assert.equal(request.text,'おかえりなさい。');assert.equal(request.sessionId,'voice-persona');assert.equal(request.speechDirection.emotion,'happy');assert.equal(f.voice.sessions.get('bot').current.phase,'playing');release();assert.equal((await job.done).ok,true);assert.equal(f.voice.status().sessions[0].lastResult.streamMode,'native');assert.equal(adapter.plays.length,0);const caption=f.voice.status().captions[0];assert.equal(caption.sourceText,'歡迎回來。');assert.equal(caption.spokenText,'おかえりなさい。');assert.equal(caption.phase,'complete');assert.equal(f.voice.usage.days[f.voice.day()].scopes['voice-persona'].characters,'おかえりなさい。'.length);f.advance(300001);assert.equal(f.voice.status().captions.length,0)
 }finally{release();await f.close()}
});
test('idle timeout is measured from empty queue; polling does not reset it, playing prevents idle departure',async()=>{
 const f=await fixture();try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});const exit=f.voice.status().sessions[0].idleExitAt;f.advance(59000);assert.equal(f.voice.status().sessions[0].idleExitAt,exit);await f.voice.tick();assert.equal(f.voice.sessions.size,1);f.advance(1000);await f.voice.tick();assert.equal(f.voice.sessions.size,0);
 await f.voice.join({kind:'bot',channelId:CH,guildId:G});const j=f.voice.speak({text:'測試'});await until(()=>f.adapters.at(-1).plays.length===1);f.advance(120000);await f.voice.tick();assert.equal(f.voice.sessions.size,1);f.adapters.at(-1).plays[0].finish({ok:true});await j.done;await until(()=>!f.voice.sessions.get('bot').current);f.advance(60000);await f.voice.tick();assert.equal(f.voice.sessions.size,0);
 }finally{await f.close();}
});
test('stop aborts synthesis, empties waiting items and never starts a late playback',async()=>{
 const f=await fixture();let release;f.setSynth(()=>new Promise(r=>release=r));try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});const first=f.voice.speak({text:'第一句'});await until(()=>release);const second=f.voice.speak({text:'第二句'});await f.voice.stop('bot');release({data:Buffer.from('late')});assert.equal((await first.done).ok,false);assert.equal((await second.done).ok,false);assert.equal(f.adapters[0].plays.length,0);await until(()=>!f.voice.sessions.get('bot').current);}finally{await f.close();}
});
test('automatic speech never broadcasts DMs, simulations, other guilds or unbound text channels',async()=>{
 const f=await fixture({voiceAutoSpeak:true});try{await f.voice.join({kind:'bot',channelId:CH,guildId:G,textChannelId:TEXT});for(const m of [{channelId:TEXT,isDm:true},{guildId:G,channelId:CH},{guildId:'other',channelId:TEXT},{guildId:G,channelId:TEXT,simulated:true}])await f.voice.autoSpeak(m,{kind:'bot'},'私密');assert.equal(f.syntheses.length,0);await f.voice.autoSpeak({guildId:G,channelId:TEXT},{kind:'bot'},'群聊答案');await until(()=>f.adapters[0].plays.length);f.adapters[0].plays[0].finish({ok:true});await until(()=>!f.voice.sessions.get('bot').current);assert.equal(f.syntheses.length,1);}finally{await f.close();}
});
test('TTS daily budget includes pending reservations; submitted characters persist separately from LLM tokens',async()=>{
 const f=await fixture({voiceDailyCharacterLimit:6});let release;f.setSynth(p=>{f.syntheses.push(p);return new Promise(r=>release=r);});try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});const j=f.voice.speak({text:'1234'});await until(()=>release);assert.throws(()=>f.voice.speak({text:'567'}),/預算/);await f.voice.stop('bot');release({data:Buffer.from('audio')});await j.done;await until(()=>!f.voice.sessions.get('bot').current);assert.equal(f.voice.status().usage.characters,4);assert.equal(f.voice.status().usage.day,'1970-01-01');}finally{await f.close();}
});
test('music pauses for speech and resumes its remaining progress; hard session limit leaves during playback',async()=>{
 const f=await fixture({voiceMaxSessionMinutes:5});try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});const s=f.voice.sessions.get('bot'),music=f.voice.add(s,{type:'music',label:'music',file:{path:'music',remove:async()=>{}},offset:0});await until(()=>f.adapters[0].plays.length===1);f.advance(7000);const speech=f.voice.speak({text:'插話'});await until(()=>f.adapters[0].plays.length===2);assert.equal(s.current.type,'speech');assert.equal(s.queue[0].offset,7);f.adapters[0].plays[1].finish({ok:true});await speech.done;await until(()=>f.adapters[0].plays.length===3);assert.equal(s.current.type,'music');f.advance(300000);await f.voice.tick();assert.equal(f.voice.sessions.size,0);assert.equal((await music.done).ok,false);await until(()=>!s.running);}finally{await f.close();}
});
test('opt-in ducking keeps background music during speech, queues the next track and counts it as active',async()=>{
 const f=await fixture({voiceMusicMode:'duck'});try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});const s=f.voice.sessions.get('bot'),a=f.adapters[0],music=[];a.supportsMixing=true;a.playMusic=async(path,{signal})=>new Promise(resolve=>{music.push({path,finish:resolve});signal.addEventListener('abort',()=>resolve({ok:false}),{once:true})});
  const first=f.voice.add(s,{type:'music',label:'first',file:{path:'first',remove:async()=>{}},offset:0});await until(()=>music.length===1&&!s.running);const second=f.voice.add(s,{type:'music',label:'second',file:{path:'second',remove:async()=>{}},offset:0});const speech=f.voice.speak({text:'音樂繼續播放'});await until(()=>a.plays.length===1);assert.equal(s.music.id,first.id);assert.equal(music.length,1);f.advance(70000);await f.voice.tick();assert.equal(f.voice.sessions.size,1);a.plays[0].finish({ok:true});await speech.done;music[0].finish({ok:true});assert.equal((await first.done).ok,true);await until(()=>music.length===2);await f.voice.stop('bot');assert.equal((await second.done).ok,false)
 }finally{await f.close()}
});
test('account/settings changes disconnect; leave also cancels a join already in flight',async()=>{
 const f=await fixture();try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});f.transport.selfId='different';await f.voice.tick();assert.equal(f.voice.sessions.size,0);let release;f.voice.adapters=()=>({connected:false,join:()=>new Promise(r=>release=r),leave:async()=>{}});const joining=f.voice.join({kind:'bot',channelId:CH,guildId:G});await until(()=>release);await f.voice.leave('bot');release();await assert.rejects(joining,/取消/);assert.equal(f.voice.sessions.size,0);}finally{await f.close();}
});
test('local FFmpeg pipeline really creates bounded Ogg Opus; arbitrary music endpoints are rejected',async()=>{
 const data=Buffer.alloc(44+4800*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(48000,24);data.writeUInt32LE(96000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);
 const file=await audioFile(data);let opus;try{opus=await prepareVoiceAudio(file.path,{seconds:1,volume:0.5});assert.ok(opus.durationMs>=80&&opus.durationMs<=1000);assert.ok((await stat(opus.path)).size>64);await assert.rejects(musicRequest({socket:{localPort:1234}},'https://example.com'),/不支援/);}finally{await opus?.remove();await file.remove();}
});
test('Bot forwards only relevant Gateway voice events to its custom adapter and requests voice states intent',async()=>{
 const t=new BotTransport({});t.config={};assert.ok(t.intents()&(1<<7));const events=[];t.voiceGateway=(type,data)=>events.push([type,data]);await t.handleGateway({op:0,t:'VOICE_SERVER_UPDATE',d:{guild_id:G}});assert.equal(events[0][0],'VOICE_SERVER_UPDATE');
});
test('unconfirmed leave stays visible and retries cleanup instead of claiming the room was left',async()=>{
 const f=await fixture();try{await f.voice.join({kind:'bot',channelId:CH,guildId:G});const a=f.adapters[0];a.leave=async()=>({ok:false});assert.equal((await f.voice.leave('bot')).ok,false);assert.equal(f.voice.status().sessions[0].phase,'leaving-error');assert.throws(()=>f.voice.speak({text:'不得繼續'}),/變更/);a.leave=async()=>{a.connected=false;return {ok:true};};f.advance(5000);await f.voice.tick();assert.equal(f.voice.sessions.size,0);}finally{await f.close();}
});
