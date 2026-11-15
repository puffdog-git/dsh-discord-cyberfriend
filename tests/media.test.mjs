import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaUrl, mediaCandidates, mediaSources, prepareGif, extractFrames } from '../src/media.js';
import { callHostLlm, callCustomLlm, generateReply } from '../src/llm.js';
import { createResponder } from '../src/features/responder.js';
import { sanitizeConfig } from '../src/config.js';

const frame = {data:'AA==',mediaType:'image/jpeg',timeMs:100,width:1,height:1};
const message = {id:'incoming',channelId:'channel',author:{id:'owner'},content:'https://tenor.com/view/cat-gif-123'};
const extracted = {ok:true,frames:[frame],totalFrames:1,durationMs:0};
const quiet = {info(){},warn(){},error(){}};

test('media URLs deny private destinations, credentials, suffix tricks and non-HTTPS',()=>{
  for(const url of ['http://media.tenor.com/a.gif','https://127.0.0.1/a.gif','https://localhost/a.gif',
    'https://media.tenor.com.evil.test/a.gif','https://a@media.tenor.com/a.gif','https://media.tenor.com:123/a.gif'])
    assert.equal(mediaUrl(url),null);
  assert.ok(mediaUrl('https://cdn.discordapp.com/attachments/a.gif?ex=123&hm=abc'));
  assert.equal(mediaCandidates({content:'https://example.org/a.gif'}).length,0);
});
test('404 Discord links refresh once and only accept a signed URL for the exact same attachment',async()=>{
 const url='https://cdn.discordapp.com/attachments/111/222/a.gif';let refreshed=0;
 const r=await prepareGif({content:url},{},undefined,{fetcher:async u=>new Response(u.includes('hm=')?'gif':'missing',{status:u.includes('hm=')?200:404}),
  refreshUrls:async()=>{refreshed++;return {ok:true,items:[{original:url,refreshed:url+'?hm=signed'}]};},extract:async()=>extracted});
 assert.equal(r.images.length,1);assert.equal(refreshed,1);
 const denied=await prepareGif({content:'https://cdn.discordapp.com/attachments/333/444/b.gif'},{},undefined,{
  fetcher:async()=>new Response('',{status:404}),refreshUrls:async urls=>({ok:true,items:[{original:urls[0],refreshed:'https://cdn.discordapp.com/attachments/999/999/other.gif'}]})});
 assert.equal(denied.images.length,0);
});

test('share-page resolves actual image and bounds redirect targets before fetching',async()=>{
  const visited=[];
  const result=await prepareGif(message,{},undefined,{extract:async()=>extracted,fetcher:async url=>{
    visited.push(url);
    return url.includes('/view/')?new Response('<meta content="https://media.tenor.com/id/tenor.gif" property="og:image">',{headers:{'content-type':'text/html'}}):new Response('gif');
  }});
  assert.equal(result.images.length,1);assert.equal(visited.length,2);
  visited.length=0;
  const denied=await prepareGif(message,{},undefined,{fetcher:async url=>{visited.push(url);return new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}});}});
  assert.equal(denied.images.length,0);assert.equal(visited.length,1);
});

test('size limits and cancellation stop downloading; switch disables media work',async()=>{
  let calls=0;
  const dependencies={fetcher:async()=>{calls++;return new Response('x',{headers:{'content-length':String(13*1024*1024)}});}};
  const result=await prepareGif(message,{},undefined,dependencies);
  assert.equal(result.error,'MEDIA_TOO_LARGE');
  await prepareGif(message,{gifVisionEnabled:false},undefined,dependencies);assert.equal(calls,1);
  const controller=new AbortController();controller.abort();
  await prepareGif(message,{},controller.signal,dependencies);assert.equal(calls,1);
  await assert.rejects(extractFrames(Buffer.from('x'),{},controller.signal),/CANCELLED/);
});

test('real Python subprocess decodes GIF independently from Discord login',async()=>{
  const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
  const result=await extractFrames(gif,{});
  assert.equal(result.ok,true);assert.equal(result.frames[0].mediaType,'image/jpeg');
  await assert.rejects(extractFrames(Buffer.from('invalid'),{}),/DECODE_FAILED/);
});

for(const kind of ['user','bot'])test(`${kind}: GIF frames reach DSH attachment service and actual model request`,async()=>{
  let request,saved,sent;
  const llm={listProviders:()=>[{id:'fixture'}],prepareCall:async config=>({config,inputModalities:['text','image'],
    async *stream(req){request=req;yield {type:'text-delta',text:'圖片是測試畫格'};yield {type:'finish',reason:{kind:'stop'}};}})};
  const attachments={saveImages:async images=>{saved=images;return images.map((_,i)=>({attachmentId:`sha256:${i}`,mediaType:'image/jpeg',width:1,height:1}));}};
  const config=sanitizeConfig({dryRun:false,minReplyDelaySeconds:0,maxReplyDelaySeconds:0,userContextBootstrap:false,userSimulateTyping:false});
  const responder=createResponder({ctx:{get:k=>({llm,attachments}[k])},getConfig:()=>config,
    history:{contextText:()=>'',record(){}},ledger:{record(){}},log:quiet,semaphore:{run:f=>f()},
    prepareMedia:async()=>({images:[frame],totalFrames:5,durationMs:500})});
  const result=await responder.respond(message,'dm',{kind,selfId:'self',sendMessage:async(c,o)=>{sent=o;return {ok:true,messageId:'reply'};}});
  assert.equal(result.ok,true);assert.equal(saved.length,1);assert.ok(saved[0].data instanceof Uint8Array);
  assert.equal(request.messages.at(-1).content.filter(x=>x.type==='image').length,1);
  assert.match(JSON.stringify(request.messages),/100 ms/);assert.ok(sent.content || sent.embed?.description);
});

test('attachments and custom emoji IDs load original CDN images, not names alone',()=>{
  const sources=mediaSources({content:'<:cat:123456789012345678> <a:wave:123456789012345679>',
    attachments:[{name:'photo.png',url:'https://cdn.discordapp.com/attachments/a/photo.png',contentType:'image/png'}]});
  assert.equal(sources.length,3);assert.match(sources[1].urls[0],/emojis\/123456789012345678\.png/);
  assert.match(sources[2].urls[0],/emojis\/123456789012345679\.gif/);
  assert.equal(mediaSources({content:'<:cat:123456789012345678>'},{emojiVisionEnabled:false}).length,0);
});

test('KLIPY preview falls back to the CDN if the public share page refuses access',async()=>{
  const result=await prepareGif({content:'https://klipy.com/gifs/cat',embedDetails:[{type:'gifv',url:'https://klipy.com/gifs/cat',imageUrl:'https://static.klipy.com/cat.gif'}]}, {},undefined,
    {fetcher:async url=>url.includes('/gifs/')?new Response('',{status:403}):new Response('image'),extract:async()=>extracted});
  assert.equal(result.images.length,1);assert.equal(result.error,undefined);
});

test('ModLens wraps the same text model; native mode leaves the route unchanged',async()=>{
  for(const visionMode of ['auto','native','modlens']) {
    const calls=[];let request;
    const llm={listProviders:()=>[{id:'deepseek-account'},{id:'modlens-deepseek-account'}],
      listModels:async()=>[{id:'deepseek-flash',inputModalities:['text','image']}],
      prepareCall:async config=>{calls.push(config.provider);return {config,inputModalities:config.provider.startsWith('modlens-')?['text','image']:['text'],
        async *stream(req){request=req;yield {type:'text-delta',text:'vision'};}};}};
    const attachments={saveImages:async()=>[{attachmentId:'fixture'}]};
    const result=await callHostLlm({get:k=>({llm,attachments}[k])},{provider:'deepseek-account',model:'deepseek-flash'},
      {images:[frame],user:'picture',visionMode});
    assert.equal(result.imagesSent,visionMode==='native'?0:1);
    assert.equal(result.model,'deepseek-flash');
    assert.equal(result.provider,visionMode==='native'?'deepseek-account':'modlens-deepseek-account');
    assert.ok(request);
  }
});

test('text-only DSH model never silently pretends to receive frames',async()=>{
  let request;
  const llm={prepareCall:async config=>({config,inputModalities:['text'],async *stream(req){request=req;yield {type:'text-delta',text:'只有文字'};}})};
  const result=await callHostLlm({llm},{provider:'fixture'},{user:'gif',images:[frame]});
  assert.equal(result.imagesSent,0);assert.equal(result.visionWarning,'MODEL_IMAGE_INPUT_UNAVAILABLE');
  assert.match(JSON.stringify(request.messages),/沒有提供任何畫格/);
});

test('custom OpenAI-compatible request carries real image_url parts',async()=>{
  const original=globalThis.fetch;let body;
  try {
    globalThis.fetch=async(url,req)=>{body=JSON.parse(req.body);return new Response(JSON.stringify({choices:[{message:{content:'image'}}]}));};
    const result=await callCustomLlm({customLlmApiKey:'fixture',customLlmApiBase:'https://fixture.invalid',customLlmModel:'vision'},
      {user:'gif',images:[frame]});
    assert.equal(result.imagesSent,1);assert.equal(body.messages[0].content.at(-1).image_url.url,'data:image/jpeg;base64,AA==');
  } finally {globalThis.fetch=original;}
});

test('image calls reserve reasoning budget without increasing text-only calls',async()=>{
  const seen=[];
  const llm={listProviders:()=>[{id:'fixture'}],prepareCall:async config=>{seen.push(config.maxTokens);return {config,
    async *stream(){yield {type:'text-delta',text:'test'};}};}};
  for(const images of [[],[frame]])await generateReply({llm},{llmMode:'subscriptions',mediaReplyTokens:1600},
    {user:'test',images,maxTokens:240});
  assert.deepEqual(seen,[240,1600]);
});
test('native guild stickers join the same image/GIF pipeline with separate gates; Lottie uses bounded JSON rendering',()=>{const stickers=[{id:'123456789012345678',name:'靜態',formatType:1},{id:'123456789012345679',name:'動畫',formatType:2},{id:'123456789012345680',name:'GIF',formatType:4},{id:'123456789012345681',name:'Lottie',formatType:3}];const all=mediaSources({stickers});assert.equal(all.length,3);assert.ok(all.some(x=>x.urls[0].endsWith('123456789012345680.gif')));assert.ok(all.some(x=>x.label==='伺服器貼圖 動畫'));assert.equal(mediaSources({stickers},{stickerUnderstandEnabled:false}).length,0);assert.equal(mediaSources({stickers},{gifVisionEnabled:false}).length,1);assert.equal(mediaSources({stickers},{imageVisionEnabled:false}).length,3);assert.ok(mediaSources({stickers:[stickers[3]]})[0].urls[0].endsWith('.json'));assert.equal(mediaSources({stickers:[stickers[3]]},{gifVisionEnabled:false}).length,0);});
test('native animated sticker image bytes are actually extracted and passed as visual frames',async()=>{const urls=[];const result=await prepareGif({content:'',stickers:[{id:'123456789012345679',name:'開心動畫',formatType:2}]},{},undefined,{fetcher:async u=>{urls.push(u);return new Response('fixture-png',{headers:{'content-type':'image/png'}})},extract:async()=>({...extracted,totalFrames:2,frames:[frame,{...frame,timeMs:200}]})});assert.equal(result.images.length,2);assert.ok(urls[0].includes('/stickers/123456789012345679.png'));});

