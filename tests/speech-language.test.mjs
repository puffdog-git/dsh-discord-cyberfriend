import test from 'node:test';
import assert from 'node:assert/strict';
import {createJapaneseSpeech,validJapaneseSpeech} from '../src/speech-language.js';
import {buildPrompt,processModelOutput} from '../src/persona.js';
import {DiscordTts} from '../src/tts-adapters.js';
const source='歡迎回來，今天也辛苦了。',ja='おかえりなさい。今日もお疲れさまでした。',cfg={voiceSpokenLanguage:'ja'},tag=JSON.stringify({emotion:'happy',intensity:.4,pace:'normal',spokenText:ja});
test('truncated public replies discard model-supplied Japanese so omitted text cannot be spoken',()=>{
 const reply=processModelOutput(source.repeat(10)+'<speech_meta>'+tag+'</speech_meta>',{}, {maxChars:20});assert.equal(reply.spokenText,undefined);assert.ok(reply.text.length<source.repeat(10).length)
});
test('bilingual reply keeps public Chinese separate from Japanese audio and produces both in one model generation',()=>{
 const prompt=buildPrompt({config:{voiceEnabled:true,voiceAutoSpeak:true,voiceSpokenLanguage:'ja',voiceEmotionMode:'off'},kind:'dm',message:'我回來了'});assert.match(prompt.system,/spokenText/);assert.match(prompt.system,/繁體中文/);const reply=processModelOutput(source+'<speech_meta>'+tag+'</speech_meta>');assert.equal(reply.text,source);assert.equal(reply.spokenText,ja);assert.equal(reply.speech.emotion,'happy');assert.ok(!reply.text.includes('spokenText'));
})
test('model-supplied Japanese avoids another call, while missing or edited content translates once and caches by scope',async()=>{
 let calls=0;const translate=createJapaneseSpeech({generate:async(_ctx,_cfg,r)=>{calls++;assert.equal(JSON.parse(r.user).sourceText,source);return {ok:true,text:JSON.stringify({translation:ja})}}});
 assert.equal((await translate.prepare(source,cfg,null,{provided:ja})).origin,'reply-model');assert.equal(calls,0);assert.equal((await translate.prepare(source,cfg,null,{scope:'a'})).origin,'translation');assert.equal((await translate.prepare(source,cfg,null,{scope:'a'})).cacheHit,true);assert.equal(calls,1);await translate.prepare(source,cfg,null,{scope:'b'});assert.equal(calls,2);
})
test('invalid translation, cancellation and model token budget failure never send Chinese as Japanese',async()=>{
 assert.equal(validJapaneseSpeech(source),false);await assert.rejects(createJapaneseSpeech().prepare(source,{...cfg,voiceJapaneseFallback:false}),/略過/);
 for(const result of [{ok:true,text:'not json'},{ok:true,text:'{"translation":"這還是中文"}'},{ok:false,code:'TOKEN_BUDGET'}])await assert.rejects(createJapaneseSpeech({generate:async()=>result}).prepare(source,cfg),/日文|翻譯|預算/);
 const c=new AbortController();c.abort();await assert.rejects(createJapaneseSpeech({generate:()=>assert.fail()}).prepare(source,cfg,c.signal));
})
test('HTTP adapter delivers source Chinese plus provided Japanese to our API; traditional interfaces receive only actual spoken text',async()=>{
 let body;const t=new DiscordTts({ctx:{webServer:{getOrigin:()=> 'http://127.0.0.1:12345'}},getConfig:()=>({voiceTtsAdapter:'dsh-tts'}),fetchImpl:async(url,o)=>{if(url.endsWith('/config'))return Response.json({ok:true,config:{chain:[{provider:'edge',voice:'ja-JP-NanamiNeural'}],roles:{}}});body=JSON.parse(o.body);return Response.json({ok:true,mime:'audio/wav',audioBase64:Buffer.from('audio').toString('base64')})},mergeAudio:async()=>assert.fail()});await t.synthesize({text:ja,sourceText:source,spokenLanguage:'ja'});assert.equal(body.text,source);assert.equal(body.spokenText,ja);assert.equal(body.spokenLanguage,'ja');
 let received;const service={capabilities:()=>({provider:'other',engine:{ready:true}}),synthesize:async r=>{received=r;return {data:Buffer.from('audio')}}},old=new DiscordTts({ctx:{get:k=>k==='speechSynthesis'?service:null},getConfig:()=>({})});await old.synthesize({text:ja,sourceText:source,spokenLanguage:'ja',sessionId:'private'});assert.equal(received.text,ja);assert.equal(received.sourceText,undefined);assert.equal(received.spokenLanguage,undefined);assert.equal(received.sessionId,undefined);
})
test('our context-aware service receives separate source and language metadata without imposing this extension on other plugins',async()=>{
 let received;const service={capabilities:()=>({provider:'own',extensions:{contextRouting:true,expression:true},engine:{ready:true}}),synthesize:async r=>{received=r;return {data:Buffer.from('audio')}}},adapter=new DiscordTts({ctx:{get:k=>k==='speechSynthesis'?service:null},getConfig:()=>({})});await adapter.synthesize({text:ja,sourceText:source,spokenLanguage:'ja',sessionId:'s',speechDirection:{emotion:'sad',intensity:.4,pace:'slow'}});assert.equal(received.sourceText,source);assert.equal(received.spokenLanguage,'ja');assert.equal(received.sessionId,'s');assert.equal(received.speechDirection.emotion,'sad');
})
