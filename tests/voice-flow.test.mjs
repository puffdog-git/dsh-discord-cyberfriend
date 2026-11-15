import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateVoiceFlow} from '../scripts/simulate-tts.mjs';

test('simulated Discord input sends reply and mood to TTS, converts audio and intercepts final playback',async()=>{
 const audio=Buffer.alloc(44+24000);audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(24000,24);audio.writeUInt32LE(48000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(audio.length-44,40);
 const bodies=[];
 const result=await simulateVoiceFlow({baseUrl:'http://127.0.0.1:19999',input:'終於成功了！',reply:'太好了！真的替你開心。',speechInstruction:'驚喜，帶笑意，不要喊叫',fetchImpl:async(url,opts)=>{
  if(url.endsWith('/config'))return Response.json({ok:true,config:{chain:[{provider:'doubao',model:'seed-tts-2.0',voice:'Vivi'}],roles:{}}});
  assert.ok(url.endsWith('/preview'));bodies.push(JSON.parse(opts.body));return Response.json({ok:true,mime:'audio/wav',audioBase64:audio.toString('base64'),rate:1,volume:1});
 }});
 assert.equal(bodies.length,1);assert.equal(bodies[0].text,'太好了！真的替你開心。');assert.equal(bodies[0].tuning.instruction,'驚喜，帶笑意，不要喊叫');
 assert.equal(result.modelSawInput,true);assert.equal(result.textDeliveredToMock,true);assert.equal(result.discordConnected,false);assert.equal(result.discordSent,false);assert.ok(result.delivered.bytes>64);assert.ok(result.delivered.durationMs>=450);
});
