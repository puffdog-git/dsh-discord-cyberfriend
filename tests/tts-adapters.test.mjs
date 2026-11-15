import test from 'node:test';
import assert from 'node:assert/strict';
import {DiscordTts} from '../src/tts-adapters.js';
import {mergeTtsAudio} from '../src/tts-audio.js';

const base='http://127.0.0.1:8009/';
function adapter(config,fetchImpl,extra={}){
 return new DiscordTts({ctx:{webServer:{getOrigin:()=>base}},getConfig:()=>config,fetchImpl,mergeAudio:async parts=>({data:Buffer.concat(parts.map(p=>p.data)),contentType:'audio/wav'}),...extra});
}
const audio=s=>({ok:true,audioBase64:Buffer.from(s).toString('base64'),mime:'audio/mpeg',rate:1,volume:1});

test('new native providers expose only supported natural-language delivery capabilities',async()=>{
 for(const [provider,model,supported]of [['fish','s2.1-pro-free',true],['dashscope','qwen-audio-3.1-tts-flash',true],['inworld','inworld-tts-2',true],['inworld','inworld-tts-1.5-mini',false],['cartesia','sonic-3.6',false],['polly','neural',false],['google-cloud','',false]]){
  const calls=[];const t=adapter({voiceTtsAdapter:'dsh-tts'},async(url,opts)=>{
   if(url.endsWith('/config'))return Response.json({ok:true,config:{chain:[{provider,model}],roles:{}}});
   calls.push(JSON.parse(opts.body));return Response.json(audio('fixture audio'));
  });
  await t.refresh();assert.equal(t.capabilities().engine.speechInstruction,supported);
  const out=await t.synthesize({text:'Keep these words.',speechInstruction:'excited'});
  assert.equal(!!out.warning,!supported);assert.equal(calls[0].text,'Keep these words.');
  if(supported)assert.equal(calls[0].tuning.instruction,'excited');
 }
});

test('auto mode uses existing host speech service, forwarding mood/voice/cancellation without HTTP or Discord hooks in TTS',async()=>{
 let request;
 const signal=new AbortController().signal;
 const service={capabilities:()=>({provider:'doubao',engine:{name:'小米 TTS',ready:true}}),synthesize:async opts=>{request=opts;return {data:Buffer.from('host audio')};}};
 const t=adapter({},()=>{throw Error('unexpected HTTP');},{ctx:{get:name=>name==='speechSynthesis'?service:null}});
 const out=await t.synthesize({text:'恭喜！',speechInstruction:'驚喜',voice:'my-voice',signal,format:'wav'});
 assert.equal(out.data.toString(),'host audio');assert.equal(request.speechInstruction,'驚喜');assert.equal(request.signal,signal);
 assert.equal(t.capabilities().adapter,'service');
});

test('dsh-tts adapter splits long text and sends mood as a preview instruction, never spoken text or saved settings',async()=>{
 const cfg={voiceTtsAdapter:'dsh-tts'},requests=[];
 const t=adapter(cfg,async(url,opts)=>{
  const route=new URL(url).pathname;
  if(route==='/dsh-tts/config')return Response.json({ok:true,config:{chain:[{provider:'doubao',model:'seed-tts-2.0',voice:'vivi'}],roles:{},doubaoInstruction:'global'}});
  requests.push({route,body:JSON.parse(opts.body),method:opts.method});return Response.json(audio('audio'));
 });
 const text='你'.repeat(1500);
 await t.synthesize({text,speechInstruction:'興奮而不喊叫',voice:'new-voice'});
 assert.equal(requests.length,2);assert.ok(requests.every(r=>r.route==='/dsh-tts/preview'&&r.method==='POST'));
 assert.equal(requests.map(r=>r.body.text).join(''),text);
 assert.ok(requests.every(r=>r.body.tuning.instruction==='興奮而不喊叫'&&r.body.voice==='new-voice'&&!r.body.text.includes('興奮')));
});

test('unsupported mood is explicitly reported and a failed charged synthesis is not sent to another provider',async()=>{
 let syntheses=0;
 const t=adapter({voiceTtsAdapter:'dsh-tts'},async(url)=>{
  if(url.endsWith('/config'))return Response.json({ok:true,config:{chain:[{provider:'edge'}],roles:{}}});
  syntheses++;return Response.json(audio('edge'));
 });
 const out=await t.synthesize({text:'你好',speechInstruction:'難過'});assert.match(out.warning,/不支援/);assert.equal(syntheses,1);
 t.fetch=async()=>{syntheses++;return new Response('',{status:503});};
 await assert.rejects(t.synthesize({text:'失敗'}),/HTTP 503/);assert.equal(syntheses,2);
});

test('new provider mood capabilities reach preview separately from text and respect model support',async()=>{
 for(const [provider,model,supported]of [['google','gemini-3.8-flash-tts',true],['openai','',true],['openai','tts-1',false],['openai','gpt-realtime-2.1-mini',true],['openai','gpt-4o-realtime-preview',false],['deepinfra','Qwen/Qwen3-TTS',true],['deepinfra','hexgrad/Kokoro-82M',false],['elevenlabs','eleven_v4',true],['elevenlabs','eleven_multilingual_v2',false],['openrouter','',true],['openrouter','microsoft/mai-voice-2.1',false],['siliconflow','FunAudioLLM/CosyVoice2-0.5B',true],['groq','canopylabs/orpheus-v1-english',true],['groq','canopylabs/orpheus-arabic-saudi',false]]){
  let request;const t=adapter({voiceTtsAdapter:'dsh-tts'},async(url,opts)=>{
   if(url.endsWith('/config'))return Response.json({ok:true,config:{chain:[{provider,model}],speechInstruction:'global mood',roles:{}}});
   request={url,body:JSON.parse(opts.body)};return Response.json(audio('audio'));
  });
  const out=await t.synthesize({text:'你好',speechInstruction:'興奮'});assert.equal(t.capabilities().engine.speechInstruction,supported,provider+model);
  assert.equal(request.body.text,'你好');if(supported){assert.match(request.url,/preview$/);assert.equal(request.body.tuning.instruction,'興奮');assert.equal(out.warning,undefined);}else assert.match(out.warning,/不支援/);
 }
});

test('reference plugin downloads all long-read chunks in order and releases the job',async()=>{
 const calls=[];
 const t=adapter({voiceTtsAdapter:'memef1f1y',voiceTtsOptions:'{"provider":"cosyvoice","custom":{"voice":"reference.wav"}}'},async(url,opts)=>{
  const u=new URL(url);calls.push(u.pathname+u.search);
  if(u.pathname.endsWith('/cloud-config'))return Response.json({cloud:{apiKeySet:false}});
  if(u.pathname.endsWith('/speak')){assert.equal(JSON.parse(opts.body).custom.voice,'reference.wav');return Response.json({jobId:'job',chunks:['/dsh-tts-audio/1'],total:2});}
  if(u.pathname.endsWith('/rvc-next'))return Response.json(u.searchParams.has('cancel')?{done:true}:{url:'/dsh-tts-audio/2',more:false,index:1});
  return new Response(u.pathname.endsWith('/1')?'first':'second',{headers:{'content-type':'audio/wav'}});
 });
 assert.equal((await t.synthesize({text:'long text'})).data.toString(),'firstsecond');
 assert.ok(calls.at(-1).includes('cancel=1'));
});

test('reference adapter rejects partial jobs and cross-origin downloads, including abort cleanup',async()=>{
 let cancelled=0,evilFetched=false;
 const t=adapter({voiceTtsAdapter:'memef1f1y'},async(url)=>{
  if(url.includes('evil.example'))evilFetched=true;
  if(url.endsWith('/cloud-config'))return Response.json({cloud:{apiKeySet:false}});
  if(url.includes('cancel=1')){cancelled++;return Response.json({done:true});}
  return Response.json({jobId:'job',chunks:['https://evil.example/audio'],total:1});
 });
 await assert.rejects(t.synthesize({text:'test'}),/不屬於/);assert.equal(evilFetched,false);assert.equal(cancelled,1);
 const c=new AbortController();c.abort();await assert.rejects(t.synthesize({text:'cancel',signal:c.signal}),/abort/i);
});

test('Discord audio merger produces real WAV and rejects corrupt TTS bytes',async()=>{
 function wave(){const b=Buffer.alloc(44+4800);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;}
 const out=await mergeTtsAudio([{data:wave()},{data:wave()}],{maxDurationMs:1000});
 assert.equal(out.data.subarray(0,4).toString(),'RIFF');assert.ok(out.durationMs>=190&&out.durationMs<=210);
 await assert.rejects(mergeTtsAudio([{data:Buffer.from('{"error":"not audio"}')}]),/解碼/);
});
