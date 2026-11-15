import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceInput,speechWavInfo} from '../src/voice-input.js';
const U='123456789012345678';
function wav(){const h=Buffer.alloc(44+32000);h.write('RIFF');h.writeUInt32LE(h.length-8,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(16000,24);h.writeUInt32LE(32000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(32000,40);return h}
function fixture(){const c={voiceReceiveEnabled:true,voiceReceiveConsent:true,voiceReceiveUserIds:[U],voiceInputMaxSeconds:15,voiceSttDailySeconds:10,voiceSttLanguage:'auto',voiceSubtitles:false,voiceReceiveAutoReply:false},s={receiving:true,textChannelId:'text',selfId:'bot'},calls=[],submitted=[];let recognize=async()=>({text:'你好'});const stt={snapshot:()=>({providers:[{id:'local',name:'本機',location:'host-local',preparation:{phase:'ready'}}]}),resolve:r=>r,transcribe:(spec,signal)=>{calls.push(spec);return recognize(signal)}};const voice={sessions:new Map([['bot',s]]),session:()=>s,check(){},usage:{days:{}},day:()=> 'day',save:async()=>{}};const input=new VoiceInput({ctx:{get:n=>n==='speechToText'?stt:null},voice,getConfig:()=>c,onTranscript:r=>submitted.push(r)});return {input,c,s,voice,calls,submitted,setRecognizer:r=>recognize=r}}
test('conservative interruption waits for STT, ignores playback-like text and does not cancel a newer job',async()=>{
 const f=fixture(),stopped=[],cancelled=[];Object.assign(f.c,{voiceInterruptOnSpeech:true,voiceInterruptMode:'transcript',voiceReceiveAutoReply:true});
 f.voice.interruptForInput=(_kind,id)=>stopped.push(id);f.input.onCandidate=()=>['old-reply'];f.input.onInterrupt=(_id,_s,target)=>cancelled.push(target);
 f.s.current={id:'old',type:'speech',phase:'playing',text:'明天下午三點到圖書館整理筆記。'};f.setRecognizer(async()=>({text:'明天下午三點到圖書館整理筆記。'}));
 assert.equal(f.input.interrupt(U).jobId,'old');assert.deepEqual(stopped,[]);const echo=await f.input.acceptWav(U,wav());assert.equal(echo.echoIgnored,true);assert.deepEqual(stopped,[]);assert.equal(f.submitted.length,0);
 f.setRecognizer(async()=>({text:'等等，我想改成後天。'}));await f.input.acceptWav(U,wav());assert.deepEqual(stopped,['old']);assert.deepEqual(cancelled,[['old-reply']]);
 let release,entered;const ready=new Promise(r=>entered=r);f.setRecognizer(async()=>{entered();await new Promise(r=>release=r);return {text:'我還有一個問題'}});const pending=f.input.acceptWav(U,wav());await ready;f.s.current={id:'new',type:'speech',text:'新回答'};release();await pending;assert.deepEqual(stopped,['old']);
});
test('fast interruption requires an acoustic confirmation and the setting remains revocable',async()=>{
 const f=fixture(),stopped=[];Object.assign(f.c,{voiceInterruptOnSpeech:true,voiceInterruptMode:'acoustic'});f.s.current={id:'playing',type:'speech',text:'正在說話'};f.voice.interruptForInput=(_kind,id)=>stopped.push(id);
 await f.input.acceptWav(U,wav());assert.deepEqual(stopped,[]);f.input.interrupt(U);assert.deepEqual(stopped,['playing']);f.c.voiceInterruptOnSpeech=false;f.input.interrupt(U);assert.deepEqual(stopped,['playing']);
});
test('voice input requires consent, explicit speaker and room; no recording is submitted when a gate fails',async()=>{
 const f=fixture();f.c.voiceReceiveConsent=false;await assert.rejects(f.input.acceptWav(U,wav()),/未啟用/);f.c.voiceReceiveConsent=true;await assert.rejects(f.input.acceptWav('other',wav()),/未允許/);f.s.receiving=false;await assert.rejects(f.input.acceptWav(U,wav()));assert.equal(f.calls.length,0)
});
test('STT is provider-pinned, budgeted and local-only by default; explicit auto reply sends the final transcript once',async()=>{
 const f=fixture();assert.equal((await f.input.acceptWav(U,wav())).submitted,false);assert.equal(f.submitted.length,0);assert.equal(f.input.status().recent.length,0);assert.equal(f.voice.usage.days.day.sttSeconds,1);f.c.voiceReceiveAutoReply=true;f.c.voiceSubtitles=true;await f.input.acceptWav(U,wav());assert.equal(f.submitted.length,1);assert.equal(f.input.status().recent.length,1);f.c.voiceSttDailySeconds=2;await assert.rejects(f.input.acceptWav(U,wav()),/預算/);assert.equal(f.calls.length,2)
});
test('stopping recognition or revoking consent drops late transcripts without a reply',async()=>{
 const f=fixture();f.c.voiceReceiveAutoReply=true;let release,entered;const ready=new Promise(r=>entered=r);f.setRecognizer(async signal=>{entered();await new Promise(r=>release=r);return {text:'late'}});const pending=f.input.acceptWav(U,wav());await ready;f.input.close();release();await assert.rejects(pending);assert.equal(f.submitted.length,0);assert.equal(f.input.pending.size,0)
});
test('invalid WAV format and duration fail before the transcription provider runs',async()=>{
 const f=fixture(),audio=wav();audio.writeUInt32LE(48000,24);await assert.rejects(f.input.acceptWav(U,audio),/16kHz/);assert.throws(()=>speechWavInfo(wav(),.5),/時長/);assert.equal(f.calls.length,0)
});

test('live voice transcript normalizes to Traditional Chinese before subtitles and AI delivery',async()=>{
 const f=fixture();f.c.voiceReceiveAutoReply=true;f.c.voiceSubtitles=true;f.c.voiceSttLanguage='zh';f.c.voiceTranscriptGlossary='{"图书馆":"市立圖書館"}';f.setRecognizer(async()=>({text:'明天下午3点到图书馆。'}));const result=await f.input.acceptWav(U,wav());assert.equal(result.text,'明天下午3點到市立圖書館。');assert.equal(f.submitted[0].text,result.text);assert.equal(f.input.status().recent[0].text,result.text);assert.equal(result.normalization.corrections,1);
});


test('music receive gate blocks STT before charge and drops an already running late transcript',async()=>{
 const f=fixture();f.voice.canReceive=()=>false;await assert.rejects(f.input.acceptWav(U,wav()));assert.equal(f.calls.length,0);
 f.voice.canReceive=()=>true;f.c.voiceReceiveAutoReply=true;let release,entered;const ready=new Promise(r=>entered=r);f.setRecognizer(async()=>{entered();await new Promise(r=>release=r);return {text:'late music command'}});const pending=f.input.acceptWav(U,wav());await ready;f.voice.canReceive=()=>false;release();await assert.rejects(pending);assert.equal(f.submitted.length,0);
});
