import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FFMPEG} from '../src/voice-audio.js';
import {extractVideoFrames,isVideo} from '../src/video-frames.js';
import {mediaSources} from '../src/media.js';
test('video attachments are opt-in and continue to obey the existing CDN host fence',()=>{
 const m={attachments:[{url:'https://cdn.discordapp.com/attachments/123/456/clip.mp4',name:'clip.mp4',contentType:'video/mp4'}]};assert.equal(mediaSources(m,{}).length,0);assert.equal(mediaSources(m,{videoVisionEnabled:true}).length,1);assert.equal(mediaSources({attachments:[{...m.attachments[0],url:'http://127.0.0.1/private.mp4'}]},{videoVisionEnabled:true}).length,0)
});
test('real MP4 extraction samples bounded JPEG frames including the beginning and end',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'video-fixture-'));try{const file=join(dir,'sample.mp4');await new Promise((resolve,reject)=>{const child=spawn(FFMPEG,['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=160x120:d=1','-c:v','libx264','-pix_fmt','yuv420p',file],{windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('close',c=>c?reject(Error('fixture generation failed')):resolve())});const bytes=await readFile(file);assert.equal(isVideo(bytes),true);const result=await extractVideoFrames(bytes,{gifFrameCount:4});assert.equal(result.frames.length,4);assert.equal(result.sampled,true);assert.equal(result.frames[0].timeMs,0);assert.ok(result.frames.at(-1).timeMs>=900);assert.ok(result.frames.every(f=>Buffer.from(f.data,'base64').subarray(0,2).toString('hex')==='ffd8'));await assert.rejects(extractVideoFrames(bytes,{},AbortSignal.abort()))}finally{await rm(dir,{recursive:true,force:true})}
});
