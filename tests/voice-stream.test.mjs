import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {pcmSource} from '../src/pcm-stream.js';
import {prepareVoiceStream} from '../src/voice-stream.js';
import {BotVoice} from '../src/voice-bot.js';
import {DiscordTts} from '../src/tts-adapters.js';
const G='123456789012345678',CH='123456789012345679';
function fixture(){
 const connection=new EventEmitter(),player=new EventEmitter();connection.state={status:'ready'};connection.rejoins=0;connection.rejoin=()=>{connection.rejoins++};connection.subscribe=()=>{};connection.destroy=()=>{connection.state={status:'destroyed'};connection.emit('stateChange',{},connection.state)};player.play=resource=>{player.resource=resource;player.calls=(player.calls||0)+1;player.emit('stateChange',{}, {status:'playing'})};player.stop=()=>player.emit('stateChange',{}, {status:'idle'});
 let enter=async(c,status,signal)=>{signal?.throwIfAborted();if(c.state.status===status)return c;await new Promise((resolve,reject)=>{const change=(_,s)=>{if(s.status===status){clean();resolve()}},abort=()=>{clean();reject(Error('aborted'))},clean=()=>{c.off('stateChange',change);signal?.removeEventListener('abort',abort)};c.on('stateChange',change);signal?.addEventListener('abort',abort,{once:true})});return c};
 const lib={VoiceConnectionStatus:{Ready:'ready',Disconnected:'disconnected',Destroyed:'destroyed'},AudioPlayerStatus:{Playing:'playing',Idle:'idle'},NoSubscriberBehavior:{Stop:'stop'},StreamType:{Raw:'raw',OggOpus:'ogg'},createAudioResource:(input,options)=>({input,options}),createAudioPlayer:()=>player,entersState:(...args)=>enter(...args),joinVoiceChannel:options=>{connection.config=options;options.adapterCreator({onVoiceStateUpdate(){},onVoiceServerUpdate(){}});return connection}};
 const transport={ready:true,selfId:'self',rest:async()=>({type:2,guild_id:G}),sendSocket:()=>true},voice=new BotVoice(transport,{load:async()=>lib,maxReconnects:2});
 return {voice,connection,player,transport,failWait:()=>enter=async()=>{throw Error('timeout')},state(status,other={}){const old=connection.state;connection.state={status,...other};connection.emit('stateChange',old,connection.state)}}
}
test('PCM bridge yields the first packet before producer finishes and applies consumer backpressure',async()=>{
 let sent=0,finished=false;const source=pcmSource(async(_signal,send)=>{sent++;await send(Buffer.alloc(4800));sent++;await send(Buffer.alloc(4800));finished=true});const iterator=source[Symbol.asyncIterator]();assert.equal((await iterator.next()).value.length,4800);assert.equal(sent,1);assert.equal(finished,false);await iterator.next();await iterator.next();assert.equal(finished,true)
});
test('closing a PCM consumer aborts upstream and a failed producer cannot report complete audio',async()=>{
 let aborted=false;const source=pcmSource(async(signal,send)=>{signal.addEventListener('abort',()=>aborted=true);await send(Buffer.alloc(100));signal.throwIfAborted();throw Error('upstream failed')});const iterator=source[Symbol.asyncIterator]();await iterator.next();await iterator.return();assert.equal(aborted,true);
 const failed=pcmSource(async(_signal,send)=>{await send(Buffer.alloc(100));throw Error('upstream failed')});await assert.rejects(async()=>{for await(const _ of failed){}},/upstream failed/)
});
test('real FFmpeg stream converts PCM24k mono to Discord PCM48k stereo without writing an audio file',async()=>{
 const p=prepareVoiceStream((async function*(){yield Buffer.alloc(48000)})(),{volume:1});try{let n=0;for await(const chunk of p.stream)n+=chunk.length;await p.done;assert.equal(n,192000)}finally{await p.remove()}
});
test('real FFmpeg exposes first audio while the upstream is still producing the next packet',async()=>{
 let release,first;const gate=new Promise(r=>release=r),heard=new Promise(r=>first=r),controller=new AbortController();const p=prepareVoiceStream((async function*(){yield Buffer.alloc(4800);await gate;yield Buffer.alloc(4800)})(),{signal:controller.signal,volume:1});
 const consume=(async()=>{for await(const chunk of p.stream){first(chunk.length)}})();try{const size=await Promise.race([heard,new Promise((_,reject)=>setTimeout(()=>reject(Error('first audio still buffered')),2000))]);assert.ok(size>0);release();await consume;await p.done}finally{release();controller.abort();await p.remove();await consume.catch(()=>{})}
});
test('disconnect fails the current sentence, recovery retains the player and never replays it',async()=>{
 const f=fixture();try{await f.voice.join({guildId:G,channelId:CH});const playback=f.voice.playStream('fixture',{durationMs:1000});f.state('disconnected');assert.equal((await playback).ok,false);assert.equal(f.voice.recovering,true);f.state('ready');await new Promise(r=>setImmediate(r));assert.equal(f.voice.connected,true);assert.equal(f.player.calls,1);assert.equal(f.player.resource.options.inputType,'raw')}finally{await f.voice.leave()}
});
test('server move out of the allowed room is terminal; manual leave cannot erase a newer Gateway hook',async()=>{
 const f=fixture();await f.voice.join({guildId:G,channelId:CH});f.transport.voiceGateway('VOICE_STATE_UPDATE',{guild_id:G,user_id:'self',channel_id:'another-room'});assert.equal(f.voice.connected,false);assert.equal(f.connection.rejoins,0);const newer=()=>{};f.transport.voiceGateway=newer;await f.voice.leave();assert.equal(f.transport.voiceGateway,newer)
});
test('recovery has a finite retry budget and manual leave cancels pending recovery',async()=>{
 const f=fixture();await f.voice.join({guildId:G,channelId:CH});f.failWait();f.connection.state={status:'disconnected'};await f.voice.recover(false);assert.equal(f.voice.connected,false);assert.equal(f.voice.phase,'disconnected');assert.equal(f.connection.rejoins,1);await f.voice.leave();
 const g=fixture();await g.voice.join({guildId:G,channelId:CH});g.state('disconnected');await g.voice.leave();await new Promise(r=>setImmediate(r));assert.equal(g.voice.recovering,false);assert.equal(g.voice.phase,'idle');assert.equal(g.connection.rejoins,0)
});

test('4014 handshake waits without blind rejoin; destroyed connections stop once and old recovery cannot replace a new hook',async()=>{
 const f=fixture(),losses=[];await f.voice.join({guildId:G,channelId:CH,onUnavailable:reason=>losses.push(reason)});f.state('disconnected',{closeCode:4014});f.state('ready');await new Promise(r=>setImmediate(r));assert.equal(f.connection.rejoins,0);assert.equal(f.voice.connected,true);assert.equal(losses.length,1);
 f.state('destroyed');assert.equal(f.voice.connected,false);assert.equal(f.voice.life.signal.aborted,true);assert.equal(losses.length,2);const newer=()=>{};f.transport.voiceGateway=newer;await f.voice.leave();assert.equal(f.transport.voiceGateway,newer);
});

test('player going idle before a raw source ends is failure rather than a completed truncated sentence',async()=>{
 const f=fixture(),source=new PassThrough();try{await f.voice.join({guildId:G,channelId:CH});const playing=f.voice.playStream(source,{durationMs:1000});f.player.stop();const result=await playing;assert.equal(result.ok,false);assert.match(result.error,/尚未結束/);assert.equal(f.player.calls,1);}finally{source.destroy();await f.voice.leave()}
});

test('server mute is terminal and late Ready events cannot resurrect the stopped connection',async()=>{
 const f=fixture();try{await f.voice.join({guildId:G,channelId:CH});const playing=f.voice.playStream('fixture',{durationMs:1000});f.transport.voiceGateway('VOICE_STATE_UPDATE',{guild_id:G,user_id:'self',channel_id:CH,mute:true});assert.equal((await playing).ok,false);assert.match(f.voice.status.lastFailure,/限制發話/);f.state('ready');assert.equal(f.voice.phase,'disconnected');assert.equal(f.voice.connected,false);assert.equal(f.connection.rejoins,0);}finally{await f.voice.leave()}
});
test('HTTP streaming requires a complete marker and never retries a truncated partial response',async()=>{
 let calls=0,body;const tts=new DiscordTts({ctx:{get:()=>null},getConfig:()=>({voiceTtsAdapter:'dsh-tts',voiceTtsBaseUrl:'http://127.0.0.1:1'}),fetchImpl:async(url,options)=>{calls++;if(url.endsWith('/config'))return Response.json({ok:true,config:{chain:[{provider:'edge'}]},speechApi:{version:1,streamEndpoint:'/dsh-tts/stream'}});assert.ok(url.endsWith('/stream'));body=JSON.parse(options.body);return new Response(JSON.stringify({type:'pcm',sampleRate:24000,channels:1,audioBase64:Buffer.alloc(4800).toString('base64')})+'\n')}});
 await tts.refresh();const source=tts.streamPcm({text:'おかえりなさい。',sourceText:'歡迎回來。',spokenLanguage:'ja',sessionId:'persona-session'}),iterator=source[Symbol.asyncIterator]();assert.equal((await iterator.next()).value.length,4800);await assert.rejects(iterator.next(),/完整音訊確認/);assert.equal(body.text,'歡迎回來。');assert.equal(body.spokenText,'おかえりなさい。');assert.equal(body.sessionId,'persona-session');assert.equal(calls,2)
});
