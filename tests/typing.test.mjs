import test from 'node:test';
import assert from 'node:assert/strict';
import { createResponder } from '../src/features/responder.js';
import { sanitizeConfig } from '../src/config.js';

for (const outcome of ['sent', 'no_reply', 'model_error', 'send_error', 'dry_run', 'typing_off']) {
  test(`typing lifecycle: ${outcome}`, async () => {
    const events = [];
    const config = sanitizeConfig({othersDm_dmReplyEnabled:true, dryRun: outcome === 'dry_run', userSimulateTyping: outcome !== 'typing_off',
      minReplyDelaySeconds: 0, maxReplyDelaySeconds: 0 });
    const llm = { listProviders: () => [{provider:'fixture'}], prepareCall: async config => ({config, async *stream() {
      events.push('model');
      if (outcome === 'model_error') { yield {type:'finish',reason:{kind:'error'}}; return; }
      yield {type:'text-delta',text:outcome==='no_reply'?'[NO_REPLY]':'hello'};
      yield {type:'finish',reason:{kind:'stop'}};
    }}) };
    const responder = createResponder({ctx:{get:name=>name==='llm'?llm:undefined},getConfig:()=>config,
      history:{contextText:()=>'',record(){}},ledger:{record(){}},log:{info(){},warn(){},error(){}},semaphore:{run:fn=>fn()}});
    const transport = {kind:'user',selfId:'self',selfName:'self',epoch:1,
      async startTyping(){events.push('typing_start');return {ok:true,typingId:'lease'};},
      async stopTyping(){events.push('typing_stop');return {ok:true};},
      async sendMessage(){events.push('send');return outcome==='send_error'?{ok:false,error:'fixture'}:{ok:true,messageId:'sent'};}};
    await responder.respond({id:'incoming',channelId:'channel',content:'question',isDm:true,author:{id:'other'}},'dm',transport);
    if (outcome==='dry_run'||outcome==='typing_off') assert.ok(!events.some(e=>e.startsWith('typing')));
    else {
      assert.equal(events[0],'typing_start');
      assert.equal(events.filter(e=>e==='typing_stop').length,1);
      if(events.includes('send')) assert.ok(events.indexOf('typing_stop')<events.indexOf('send'));
      else assert.equal(events.at(-1),'typing_stop');
    }
    assert.equal(events.includes('send'), ['sent','send_error','typing_off'].includes(outcome));
  });
}
