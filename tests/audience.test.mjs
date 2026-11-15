import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeConfig,audienceConfig,describeSchema} from '../src/config.js';
import {ReplyGate} from '../src/features/gate.js';
test('old settings migrate to four independent profiles and survive saving',()=>{
 const c=sanitizeConfig({adminUserId:'400000000000000001',dmReplyEnabled:false,cooldownSeconds:27,
  adminDm_dmReplyEnabled:true,othersGroup_followupEnabled:false});
 assert.equal(audienceConfig(c,c.adminUserId,true).dmReplyEnabled,true);
 assert.equal(audienceConfig(c,'other',true).dmReplyEnabled,false);
 assert.equal(audienceConfig(c,c.adminUserId,false).followupEnabled,true);
 assert.equal(audienceConfig(c,'other',false).followupEnabled,false);
 assert.equal(audienceConfig(c,'other',true).cooldownSeconds,27);
 assert.deepEqual(sanitizeConfig(JSON.parse(JSON.stringify(c))),c);
 assert.ok(audienceConfig(c,c.adminUserId,true).reactionControlUserIds.includes(c.adminUserId));
});
test('real gate applies private and group switches by immutable Discord ID',()=>{
 const c=sanitizeConfig({adminUserId:'400000000000000001',othersDm_dmReplyEnabled:false,othersGroup_mentionReplyEnabled:false,dryRun:false});
 const gate=new ReplyGate({config:c,ledger:{},log:{}});
 const m={channelId:'c',content:'hi',author:{id:c.adminUserId,name:'stranger'},isDm:true};
 assert.equal(gate.check(m,'dm',{selfId:'self',transportEnabled:true,transport:'bot'}).ok,true);
 assert.equal(gate.check({...m,author:{id:'stranger',name:'admin'}},'dm',{selfId:'self',transportEnabled:true}).ok,false);
 assert.equal(gate.check({...m,isDm:false,guildId:'g',author:{id:'stranger'}},'mention',{selfId:'self',transportEnabled:true}).ok,false);
});
test('UI exposes four pages with their own fields instead of ambiguous duplicate base switches',()=>{
 const s=describeSchema();
 for(const id of ['adminDm','adminGroup','othersDm','othersGroup']) {
  assert.ok(s.sections.some(x=>x.id===id));assert.ok(s.fields.filter(f=>f.section===id).length>=10);
 }
 assert.ok(!s.fields.some(f=>f.key==='dmReplyEnabled'));
 assert.ok(s.fields.some(f=>f.key==='adminUserId'));
});
