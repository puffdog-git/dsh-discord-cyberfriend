import test from 'node:test';
import assert from 'node:assert/strict';
import {FollowupWindow} from '../src/features/followup.js';
test('followup windows are bounded by transport, session, channel, expiry and switch',()=>{
 const w=new FollowupWindow(),m={guildId:'g',channelId:'c'},t={kind:'bot',epoch:1},c={followupEnabled:true,followupSeconds:180};
 w.remember(m,t,c);assert.equal(w.active(m,t,c),true);
 for(const other of [{...t,kind:'user'},{...t,epoch:2}])assert.equal(w.active(m,other,c),false);
 assert.equal(w.active({...m,channelId:'other'},t,c),false);assert.equal(w.active(m,t,{...c,followupEnabled:false}),false);
 w.remember(m,t,{...c,followupSeconds:-1});assert.equal(w.active(m,t,c),false);
});
test('only a positive topical decision continues conversation',async()=>{
 for(const text of ['YES','NO','maybe','']){
 const llm={listProviders:()=>[{id:'fixture'}],prepareCall:async config=>({config,async *stream(){yield {type:'text-delta',text};}})};
 assert.equal(await new FollowupWindow().relevant({llm},{llmMode:'subscriptions'},{content:'那怎麼做？'},'previous topic'),text==='YES');
 }
});
test('same partner can address AI across topics; another person or explicit target is still classified',async()=>{
 const w=new FollowupWindow(),t={kind:'bot',epoch:1,selfId:'ai'},c={followupEnabled:true,followupSeconds:180};
 const m={guildId:'g',channelId:'c',author:{id:'partner'},content:'你洗澡了嗎'};
 w.remember(m,t,c);
 const d=await w.decide({},c,m,'AI：晚餐吃了嗎？',t);
 assert.equal(d.relevant,true);assert.equal(d.reason,'SAME_SPEAKER_ADDRESSES_AI');
 const llm={listProviders:()=>[{id:'fixture'}],prepareCall:async config=>({config,async *stream(){yield {type:'text-delta',text:'NO'};}})};
 assert.equal((await w.decide({llm},{...c,llmMode:'subscriptions'},{...m,author:{id:'other'}},'',t)).relevant,false);
 assert.equal((await w.decide({llm},{...c,llmMode:'subscriptions'},{...m,mentions:[{id:'someone-else'}]},'',t)).relevant,false);
});
