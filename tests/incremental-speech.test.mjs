import test from 'node:test';import assert from 'node:assert/strict';
import {IncrementalReply,SpeechTextQueue}from'../src/incremental-speech.js';
import {callHostLlm}from'../src/llm.js';
import {createResponder}from'../src/features/responder.js';
import {HistoryStore}from'../src/history.js';
import {sanitizeConfig}from'../src/config.js';
test('only complete filtered sentences are emitted, including a final unpunctuated tail',()=>{
 const parts=[],cancel=[];let ended=false;
 const reply=new IncrementalReply({config:{antiAiFlavor:false,stripMarkdown:true},begin:()=>({push:x=>parts.push(x),end:()=>ended=true,cancel:x=>cancel.push(x)})});
 reply.push('你好');assert.deepEqual(parts,[]);reply.push('。今天過得');assert.deepEqual(parts,['你好。']);reply.push('如何');reply.finish('你好。今天過得如何');assert.deepEqual(parts,['你好。','今天過得如何']);assert.equal(ended,true);assert.deepEqual(cancel,[]);
});
test('known sensitive text split at a sentence boundary is held until it can be redacted',()=>{
 const parts=[],reply=new IncrementalReply({config:{groupProtectedData:'機密。地址',antiAiFlavor:false},begin:()=>({push:x=>parts.push(x),end(){},cancel(){}})});
 reply.push('機密。');assert.deepEqual(parts,[]);reply.push('地址。');assert.equal(parts.length,1);assert.ok(!parts[0].includes('機密'));assert.ok(parts[0].includes('已隱藏'));
});
test('control tags before speech fall back, while a retry after speech cancels without duplicate audio',()=>{
 let starts=0,cancels=0;const begin=()=>{starts++;return {push(){},cancel(){cancels++},end(){}}};
 const blocked=new IncrementalReply({config:{},begin});blocked.push('[SPEECH: hidden]你好。');assert.equal(starts,0);assert.equal(blocked.claimed,false);
 const partial=new IncrementalReply({config:{},begin});partial.push('先說一句。');partial.cancel('模型重試');partial.push('新的回答。');assert.equal(starts,1);assert.equal(cancels,1);assert.equal(partial.claimed,true);
});
test('text queue is bounded and abort wakes a blocked consumer without accepting late text',async()=>{
 const controller=new AbortController(),queue=new SpeechTextQueue(controller.signal),iterator=queue[Symbol.asyncIterator]();const pending=iterator.next();controller.abort();await assert.rejects(pending,/取消/);assert.throws(()=>queue.push('late'),/取消/);
 const bounded=new SpeechTextQueue();for(let n=0;n<16;n++)bounded.push('test');assert.throws(()=>bounded.push('overflow'),/上限/);bounded.end();
});
test('real host LLM reader forwards text deltas before the model completes, ignoring reasoning',async()=>{
 const deltas=[];let release,started;const first=new Promise(r=>started=r),gate=new Promise(r=>release=r),ctx={llm:{prepareCall:async()=>({config:{},stream:async function*(){yield {type:'reasoning-delta',text:'hidden'};yield {type:'text-delta',text:'第一句。'};started();await gate;yield {type:'text-delta',text:'第二句。'};yield {type:'finish',reason:{kind:'stop'}};}})}};
 const pending=callHostLlm(ctx,{provider:'fixture',model:'test'},{user:'你好',onTextDelta:text=>deltas.push(text)});await first;assert.deepEqual(deltas,['第一句。']);release();const result=await pending;assert.equal(result.text,'第一句。第二句。');assert.deepEqual(deltas,['第一句。','第二句。']);
});

test('actual responder emits cleaned early speech and marks final delivery to prevent a second reading',async()=>{
 const config=sanitizeConfig({enabled:true,dryRun:false,replyEngine:'direct',llmMode:'subscriptions',subscriptionProvider:'fixture',subscriptionModel:'test',voiceIncrementalReplies:true,historyEnabled:false,botEmbedReplies:false,minReplyDelaySeconds:0,maxReplyDelaySeconds:0,gifEnabled:false,stickerAutoSendEnabled:false,autoReactionEnabled:false,antiAiFlavor:false});
 const parts=[],sent=[],metadata=[];let release,first;const gate=new Promise(r=>release=r),began=new Promise(r=>first=r);const llm={listProviders:()=>[{id:'fixture'}],prepareCall:async()=>({config:{},stream:async function*(){yield {type:'text-delta',text:'第一句。'};first();await gate;yield {type:'text-delta',text:'第二句。'};yield {type:'finish',reason:{kind:'stop'}};}})};
 const responder=createResponder({ctx:{get:n=>n==='llm'?llm:null},getConfig:()=>config,history:new HistoryStore({config}),ledger:{record(){}},log:{info(){},warn(){},error(){}},semaphore:{run:fn=>fn()},beginSpeech:()=>({push:text=>parts.push(text),end(){},cancel(){},reference(){}}),onTextDelivered:(_m,_t,_text,meta)=>metadata.push(meta)});
 const transport={kind:'bot',selfId:'1560000000000000001',sendMessage:async(_channel,options)=>{sent.push(options.content);return {ok:true,messageId:'1560000000000000010'}}};
 const pending=responder.respond({id:'voice-fixture',voiceInput:true,guildId:'400000000000000004',channelId:'400000000000000008',author:{id:'400000000000000001'},content:'你好',attachments:[],stickers:[]},'mention',transport);await began;assert.deepEqual(parts,['第一句。']);assert.deepEqual(sent,[]);release();assert.equal((await pending).ok,true);assert.deepEqual(parts,['第一句。','第二句。']);assert.deepEqual(sent,['第一句。第二句。']);assert.equal(metadata[0].earlySpeech,true);
});
