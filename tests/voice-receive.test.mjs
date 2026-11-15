import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import prism from 'prism-media';
import {attachVoiceReceiver} from '../src/voice-receive.js';
test('real Opus decoding keeps speakers isolated, ignores non-allowlisted speakers and signals voiced interruption once',async()=>{
 const speaking=new EventEmitter(),streams=new Map();let subscriptions=0,interruptions=0,done;const result=new Promise(r=>done=r),connection={receiver:{speaking,subscribe:id=>{subscriptions++;const stream=new PassThrough({objectMode:true});streams.set(id,stream);return stream}}};
 const stop=attachVoiceReceiver(connection,{EndBehaviorType:{AfterSilence:1}},{allowed:id=>id==='allowed',onSpeech:()=>interruptions++,onAudio:(id,pcm)=>done({id,pcm})});
 try{speaking.emit('start','not-allowed');assert.equal(subscriptions,0);speaking.emit('start','allowed');const encoder=new prism.opus.Encoder({rate:48000,channels:2,frameSize:960});encoder.on('data',b=>streams.get('allowed').write(b));const finished=new Promise((resolve,reject)=>{encoder.on('end',()=>{streams.get('allowed').end();resolve()});encoder.on('error',reject)});const pcm=Buffer.alloc(48000*2*2*.6);for(let at=0;at<pcm.length;at+=4){const sample=Math.round(Math.sin(at/4/48000*Math.PI*2*440)*4000);pcm.writeInt16LE(sample,at);pcm.writeInt16LE(sample,at+2)}encoder.end(pcm);await finished;const audio=await result;assert.equal(audio.id,'allowed');assert.ok(audio.pcm.length>=48000);assert.equal(interruptions,1)}finally{stop();assert.equal(speaking.listenerCount('start'),0)}
});
