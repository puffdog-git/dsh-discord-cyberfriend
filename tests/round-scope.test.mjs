import test from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/ledger.js';
import { ReplyGate } from '../src/features/gate.js';
import { sanitizeConfig } from '../src/config.js';

const config=sanitizeConfig({othersDm_dmReplyEnabled:true,enabled:true,dryRun:false,cooldownSeconds:0,roundCapPerUser:5,roundResetMinutes:10});
const userScope={transport:'user',channelId:'user-dm'},botScope={transport:'bot',channelId:'bot-dm'};
function setup(){const ledger=new Ledger();ledger.configure(config);return ledger;}

test('five user-account replies cannot block Bot, another channel, or another user',()=>{
  const ledger=setup();
  for(let i=0;i<5;i++)ledger.record('dm',{userId:'owner',...userScope});
  assert.equal(ledger.roundsExceeded('owner',config,userScope),true);
  assert.equal(ledger.roundsExceeded('owner',config,botScope),false);
  assert.equal(ledger.roundsExceeded('owner',config,{...userScope,channelId:'guild-channel'}),false);
  assert.equal(ledger.roundsExceeded('another',config,userScope),false);
  ledger.record('dm',{userId:'owner',...botScope});
  assert.equal(ledger.roundsExceeded('owner',config,userScope),true);
  assert.equal(ledger.usedToday('dm'),6);
});

test('legacy mixed totals do not become a fabricated per-conversation cap',()=>{
  const ledger=setup();ledger.state.users.owner={rounds:5,lastAt:new Date().toISOString()};
  assert.equal(ledger.roundsExceeded('owner',config,botScope),false);
  const gate=new ReplyGate({config,ledger});
  const result=gate.check({id:'m',channelId:'bot-dm',transport:'bot',content:'hi',author:{id:'owner'},isDm:true},'dm',
    {selfId:'bot',transportEnabled:true,transport:'bot'});
  assert.equal(result.ok,true,result.reason);
});

test('conversation counts survive persistence and rollover; expiration and reset still work',()=>{
  let ledger=setup();for(let i=0;i<5;i++)ledger.record('dm',{userId:'owner',...botScope});
  const snapshot=JSON.parse(JSON.stringify(ledger.state));ledger=setup();ledger.state=snapshot;
  ledger.state.date='2000-01-01';ledger.rolloverIfNeeded();
  assert.equal(ledger.usedToday('dm'),0);assert.equal(ledger.roundsExceeded('owner',config,botScope),true);
  ledger.conversation(ledger.user('owner'),botScope).lastReplyAt=new Date(Date.now()-11*60000).toISOString();
  ledger.record('reaction',{userId:'owner'});
  assert.equal(ledger.roundsExceeded('owner',config,botScope),false);
  ledger.record('dm',{userId:'owner',...botScope});ledger.resetRounds('owner');
  assert.deepEqual(ledger.user('owner').conversations,{});assert.equal(ledger.usedToday('dm'),1);
});
