import test from 'node:test';
import assert from 'node:assert/strict';
import { threadCandidate, shouldCreateThread } from '../src/features/thread-policy.js';
const message = content => ({ guildId:'guild',content });
test('short mentions and media stay inline; long discussions are candidates, existing threads never are',()=>{
  for(const text of ['<@123> hi','<@123> 看看這張圖','https://klipy.com/gifs/cat']) assert.equal(threadCandidate(message(text)),false);
  assert.equal(threadCandidate(message('請詳細分析這個架構')),true);
  assert.equal(threadCandidate({...message('請詳細分析這個架構'),isThread:true}),false);
});
test('only an exact positive model decision creates a thread; failure and inline stay inline',async()=>{
  for(const output of ['THREAD','INLINE','不確定','']) {
    const llm={listProviders:()=>[{id:'fixture'}],prepareCall:async config=>({config,async *stream(){yield {type:'text-delta',text:output};}})};
    assert.equal(await shouldCreateThread({llm},{llmMode:'subscriptions'},message('請詳細分析這個架構')),output==='THREAD');
  }
});
