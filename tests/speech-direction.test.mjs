import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildPrompt,processModelOutput} from '../src/persona.js';
import {resolveDirection,directionForEngine,validDirection,extractSpeechMetadata} from '../src/speech-direction.js';
import {DiscordTts} from '../src/tts-adapters.js';
import {createResponder} from '../src/features/responder.js';
import {sanitizeConfig} from '../src/config.js';
import {UserReview} from '../src/user-review.js';
const emotion=(e,intensity=.7)=>({emotion:e,intensity,pace:'normal'}),tag=e=>'<speech_meta>'+JSON.stringify(emotion(e))+'</speech_meta>';

test('context directions are requested in the same generation, hidden from text, and malformed/missing metadata becomes neutral',()=>{
 const prompt=buildPrompt({config:{voiceEnabled:true,voiceAutoSpeak:true,voiceEmotionMode:'context'},kind:'dm',historyText:'家裡遇到令人難過的事',message:'可以陪我嗎'});assert.match(prompt.system,/目前對話上下文/);assert.match(prompt.user,/令人難過/);
 assert.equal(processModelOutput('我會陪你。'+tag('sad')).text,'我會陪你。');assert.equal(processModelOutput('我會陪你。'+tag('sad')).speech.emotion,'sad');
 for(const raw of ['正文<speech_meta>{bad}</speech_meta>','正文<speech_meta>{bad','正文'+tag('sad')+tag('happy'),'正文']){const parsed=processModelOutput(raw);assert.ok(!parsed.text.includes('speech_meta'));assert.equal(resolveDirection({},parsed.speech).direction.emotion,'neutral')}
 assert.equal(validDirection({emotion:'sad',intensity:2,pace:'slow'}),null);assert.equal(validDirection({emotion:'inject text',intensity:.5,pace:'normal'}),null);
})
test('manual direction outranks fixed/model emotion, off preserves TTS defaults, and invalid decisions do not become spoken words',()=>{
 assert.equal(resolveDirection({voiceSpeechInstruction:'固定低聲'},emotion('excited')).instruction,'固定低聲');assert.equal(resolveDirection({voiceSpeechInstruction:'fixed'},emotion('sad'),'本次耳語').instruction,'本次耳語');
 assert.equal(resolveDirection({voiceEmotionMode:'fixed',voiceFixedEmotion:'calm',voiceEmotionIntensity:.2},emotion('angry')).direction.emotion,'calm');assert.equal(resolveDirection({voiceEmotionMode:'off'},emotion('sad')).direction,undefined);
 assert.equal(resolveDirection({},{}).direction.emotion,'neutral');
})
test('fixed-emotion engines receive documented native fields; unsupported models keep text unchanged and report degradation',()=>{
 const sad=emotion('sad',.8);assert.equal(directionForEngine(sad,{provider:'minimax'}).options.emotion,'sad');assert.equal(directionForEngine(sad,{provider:'azure'}).options.styleDegree,1.6);
 const index=directionForEngine(sad,{provider:'local-tts',cfg:{localTtsFamily:'index2.5',providerOptions:'{"local-tts":{"native":{"emo_text":"old","use_emo_text":true}}}'}});assert.deepEqual(index.options.native.emo_vector,[0,0,.8,0,0,0,0,0]);assert.equal(index.options.native.emo_text,undefined);
 assert.match(directionForEngine(sad,{provider:'cartesia',text:'這是中文。'}).warning,/英文/);assert.equal(directionForEngine(sad,{provider:'cartesia',text:'I am here.'}).options.emotion,'sad');assert.match(directionForEngine(sad,{provider:'edge'}).warning,/沒有/);
 assert.match(directionForEngine(sad,{provider:'local-tts',cfg:{localTtsFamily:'index2',localTtsEmotionAsset:'existing'}}).warning,/保留/);
})
test('Discord adapter applies native mood once per reply, preserves reference and endpoint options, and does not save it globally',async()=>{
 const requests=[],config={voiceTtsAdapter:'dsh-tts'};let probes=0;
 const t=new DiscordTts({ctx:{webServer:{getOrigin:()=> 'http://127.0.0.1:12345'}},getConfig:()=>config,mergeAudio:async parts=>({data:Buffer.concat(parts.map(p=>p.data))}),fetchImpl:async(url,opts)=>{if(url.endsWith('/config')){probes++;return Response.json({ok:true,config:{chain:[{provider:'local-tts',model:'index',baseUrl:'http://127.0.0.1:9997',referenceAsset:'ref',options:'{"native":{"seed":42}}'}],localTtsFamily:'index2.5',speechInstruction:'old defaults',roles:{}}})}requests.push({url,body:JSON.parse(opts.body)});return Response.json({ok:true,audioBase64:Buffer.from('fixture').toString('base64'),mime:'audio/wav',rate:1,volume:1})}});
 await t.synthesize({text:'我會陪你。'.repeat(200),speechDirection:emotion('sad')});assert.ok(requests.length>1);assert.ok(requests.every(r=>r.url.endsWith('/preview')));for(const r of requests){assert.equal(r.body.tuning.referenceAsset,'ref');assert.equal(JSON.parse(r.body.tuning.options).native.seed,42);assert.equal(JSON.parse(r.body.tuning.options).native.emo_vector[2],.7);assert.equal(r.body.tuning.instruction,'');assert.ok(!r.body.text.includes('sad'))}assert.equal(probes,1);assert.deepEqual(config,{voiceTtsAdapter:'dsh-tts'});
})
test('generic external services receive only the public instruction contract, with supported enum negotiation',async()=>{
 let request;const service={capabilities:()=>({provider:'external:fixture',engine:{ready:true,speechInstruction:true,instructions:[{id:'sad',name:'sad'}]}}),synthesize:async r=>{request=r;return {data:Buffer.from('audio')}}},t=new DiscordTts({ctx:{get:k=>k==='speechSynthesis'?service:null},getConfig:()=>({}),mergeAudio:async()=>{}});
 await t.synthesize({text:'words',speechDirection:emotion('sad'),sessionId:'private-scope',format:'wav'});assert.equal(request.speechInstruction,'sad');assert.equal(request.speechDirection,undefined);assert.equal(request.sessionId,undefined);assert.equal(request.text,'words');
})
test('same reply text can carry different contextual directions; unsent drafts never trigger voice delivery',async()=>{
 for(const [context,mood,review]of [['慶祝成功','excited',false],['家人過世','calm',false],['慶祝成功','excited',true]]){
  const delivered=[],drafts=[],messages=[],cfg=sanitizeConfig({othersDm_dmReplyEnabled:true,voiceEnabled:true,voiceAutoSpeak:true,dryRun:false,replyEngine:'direct',llmMode:'auto',minReplyDelaySeconds:0,maxReplyDelaySeconds:0,othersDm_replyDeliveryMode:review?'review':'auto',replyDeliveryMode:review?'review':'auto'}),source={id:'1560000000000000012',channelId:'1560000000000000011',content:'可以陪我嗎',isDm:true,author:{id:'1560000000000000015'},attachments:[],stickers:[]};
  const llm={listProviders:()=>[{provider:'fixture'}],prepareCall:async options=>{messages.push(options);return {async *stream(){yield {type:'text-delta',text:'我會陪你。'+tag(mood)};yield {type:'finish',reason:{kind:'stop'}}}}}},r=createResponder({ctx:{get:k=>k==='llm'?llm:null},getConfig:()=>cfg,history:{contextText:()=>context,record(){}},ledger:{record(){}},log:{info(){},warn(){},error(){}},semaphore:{run:fn=>fn()},onTextDelivered:async(_m,_t,text,meta)=>delivered.push({text,meta}),stageDraft:async d=>{drafts.push(d);return {ok:true,draft:true}}}),transport={kind:'user',selfId:'self',selfName:'self',sendMessage:async(_id,opts)=>{assert.ok(!opts.content.includes('speech_meta'));return {ok:true,messageId:'sent'}}};
  const result=await r.respond(source,'dm',transport);assert.equal(result.ok,true);assert.equal(messages.length,1);if(review){assert.equal(delivered.length,0);assert.equal(drafts[0].speech.emotion,mood)}else{assert.equal(delivered[0].text,'我會陪你。');assert.equal(delivered[0].meta.speech.emotion,mood)}
 }
})
test('review metadata is private and edited approval invalidates old model direction without speaking before send',async()=>{
 const root=await mkdtemp(join(tmpdir(),'review-mood-')),source={id:'s',channelId:'c',content:'q',author:{id:'u'}},events=[],cfg={enabled:true,userEnabled:true},transport={ready:true,selfId:'account',getMessage:async()=>({ok:true,message:source}),sendMessage:async(_c,o)=>{assert.equal(o.speech,undefined);return {ok:true,messageId:'sent'}}},review=new UserReview({file:join(root,'review.json'),getConfig:()=>cfg,getTransport:()=>transport,onSent:async(r,_result,o)=>events.push({content:o.content,direction:o.content===r.speechOriginal?r.speech:null})});
 try{const {draftId}=await review.stage({message:source,transport,kind:'dm',replyOptions:{content:'舊正文'},speech:emotion('sad')});assert.equal(events.length,0);const row=review.rows.get(draftId);await review.approve(draftId,{version:row.version,content:'太好了，成功了！'});assert.equal(events[0].direction,null);assert.equal(events[0].content,'太好了，成功了！')}finally{await rm(root,{recursive:true,force:true})}
})
