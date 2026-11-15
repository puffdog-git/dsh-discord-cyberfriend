// Isolated Discord input -> mock model reply -> TTS -> actual Opus encoding ->
// intercepted Discord playback. Never connects to Discord or changes settings.
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DiscordVoice} from '../src/voice.js';
import {sanitizeConfig} from '../src/config.js';
import {HistoryStore} from '../src/history.js';
import {createResponder} from '../src/features/responder.js';

export async function simulateVoiceFlow({baseUrl,input='你來了！',reply='收到，我在這裡。',speechInstruction='',fetchImpl,output}={}){
 if(!baseUrl)throw Error('請提供目前 DSH 的網址（--base）');
 const root=await mkdtemp(join(tmpdir(),'dsh-discord-simulation-'));
 const guildId='100000000000001',channelId='100000000000002';
 const config=sanitizeConfig({enabled:true,dryRun:false,botEnabled:true,voiceEnabled:true,voiceAllowedChannelIds:[channelId],voiceTtsBaseUrl:baseUrl,voiceTtsAdapter:'auto',voiceMaxSpeechSeconds:60});
 const steps=['模擬 Discord 收到文字'];
 let delivered,voiceJob,modelSawInput=false,textDelivered=false;
 const quiet={info(){},debug(){},warn(){},error(){}};
 const transport={ready:true,selfId:'100000000000003',selfName:'Simulation',kind:'bot',epoch:1,watches:()=>true,sendMessage:async(_channel,body)=>{textDelivered=!!body.content;steps.push('文字發送由 Discord 替身攔截');return {ok:true,messageId:'100000000000004'};}};
 const adapter={connected:false,async join(){this.connected=true;},async leave(){this.connected=false;return {ok:true};},async stop(){},async play(path,{signal,durationMs}){
  if(signal.aborted)throw signal.reason;
  const data=await readFile(path);
  if(data.subarray(0,4).toString()!=='OggS')throw Error('模擬發送端沒有收到 Ogg Opus');
  if(output)await writeFile(output,data);
  delivered={bytes:data.length,durationMs};steps.push('Discord 模擬播放端取得 Opus（未對外發送）');return {ok:true};
 }};
 const voice=new DiscordVoice({ctx:{webServer:{getOrigin:()=>baseUrl}},getConfig:()=>config,getManager:()=>({byKind:{bot:transport}}),file:join(root,'usage.json'),adapterFactory:()=>adapter});
 if(fetchImpl)voice.tts.fetch=fetchImpl;
 try{
  await voice.init();await voice.tts.refresh();
  if(!voice.status().tts?.ready)throw Error(voice.status().tts?.unavailableReason||'TTS 未就緒');
  await voice.join({kind:'bot',guildId,channelId});
  const responder=createResponder({ctx:{},getConfig:()=>config,history:new HistoryStore({config}),ledger:{record(){}},log:quiet,semaphore:{run:fn=>fn()},
   conversationConfig:c=>({...c,replyEngine:'dsh',historyEnabled:false,gifEnabled:false,stickerAutoSendEnabled:false,minReplyDelaySeconds:0,maxReplyDelaySeconds:0,botEmbedReplies:false}),
   sessionBridge:{run:async(_message,_transport,_cfg,options)=>{modelSawInput=options.user.includes(input);if(!modelSawInput)throw Error('回覆管線沒有把輸入交給模型');steps.push('正式回覆流程呼叫模型替身（不呼叫 LLM）');return {ok:true,text:reply,provider:'simulation',model:'fixture'};}},
   onTextDelivered:async(_message,_transport,text)=>{steps.push('文字與語氣提示交給外部 TTS');voiceJob=voice.speak({kind:'bot',text,speechInstruction});},
  });
  const message={id:'100000000000005',guildId,channelId,isDm:false,simulated:true,author:{id:'100000000000006',name:'Simulation user'},content:input,ts:new Date().toISOString()};
  const response=await responder.respond(message,'mention',transport);
  if(!response.ok||!voiceJob)throw Error(response.error||'模擬回覆沒有進入語音管線');
  const result=await voiceJob.done;if(!result.ok)throw Error(result.error);
  return {ok:true,input,reply:response.text,speechInstruction,adapter:voice.status().tts.adapter,delivered,steps,modelSawInput,textDeliveredToMock:textDelivered,llmCalled:false,discordConnected:false,discordSent:false};
 }finally{await voice.dispose();await Promise.allSettled([...voice.work]);await voice.saves;await rm(root,{recursive:true,force:true});}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
 try{console.log(JSON.stringify(await simulateVoiceFlow({baseUrl:args.base,input:args.input,reply:args.reply,speechInstruction:args.mood,output:args.output}),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
