import test from 'node:test';
import assert from 'node:assert/strict';
import {DISCORD_SKILLS,createDiscordSkillProvider,registerDiscordSkills} from '../src/skills.js';

const control=()=>({signal:new AbortController().signal,invalidate(){}});
test('packaged Discord skills advertise and load all five bodies from their own resource roots',async()=>{
  const provider=createDiscordSkillProvider(control());
  const catalog=await provider.list();
  assert.equal(catalog.complete,true);
  assert.deepEqual(catalog.candidates.map(c=>c.name),DISCORD_SKILLS);
  for(const c of catalog.candidates){
    assert.equal(c.provider,'dsh-discord');assert.equal(c.source,'bundled');assert.equal(c.rank,600);
    assert.deepEqual(c.invocation,{modelInvocable:true,userInvocable:true});
    const loaded=await provider.get(c);assert.equal(loaded.name,c.name);
    assert.ok(loaded.content.length>200);assert.ok(!loaded.content.startsWith('---'));
    assert.ok(loaded.resourceBase.path.endsWith('/skills/'+c.name+'/'));
  }
});
test('provider refuses unknown names and foreign providers without filesystem access',async()=>{
  let reads=0;const provider=createDiscordSkillProvider(control(),{read:async()=>{reads++;throw Error('unexpected read')}});
  assert.equal(await provider.get({provider:'dsh-discord',name:'../private'}),undefined);
  assert.equal(await provider.get({provider:'filesystem',name:DISCORD_SKILLS[0]}),undefined);
  assert.equal(reads,0);
});
test('missing entrypoint is isolated and a stale selected entry invalidates the host catalog',async()=>{
  let missing=false,invalidated=0;
  const {readFile}=await import('node:fs/promises');
  const provider=createDiscordSkillProvider({invalidate(){invalidated++;}},{read:async(url,options)=>{
    if(missing&&url.href.includes(DISCORD_SKILLS[0]))throw Object.assign(Error('gone'),{code:'ENOENT'});
    return readFile(url,options);
  }});
  const old=(await provider.list()).candidates[0];missing=true;
  const next=await provider.list();assert.equal(next.complete,true);assert.equal(next.candidates.length,4);
  assert.equal(await provider.get(old),undefined);assert.equal(invalidated,1);
});
test('temporary read failures stay incomplete and retry rather than disappearing into a cached empty catalog',async()=>{
  let fail=true;const {readFile}=await import('node:fs/promises');
  const provider=createDiscordSkillProvider(control(),{read:async(url,options)=>{
    if(fail)throw Object.assign(Error('locked'),{code:'EBUSY'});return readFile(url,options);
  }});
  assert.equal((await provider.list()).complete,false);
  fail=false;assert.equal((await provider.list()).candidates.length,5);
});
test('cancelled lookups and provider disposal reject instead of returning skill bodies',async()=>{
  const lifecycle=new AbortController(),request=new AbortController();
  const provider=createDiscordSkillProvider({signal:lifecycle.signal,invalidate(){}});
  const c=(await provider.list()).candidates[0];request.abort(Error('request stopped'));
  await assert.rejects(provider.get(c,{signal:request.signal}),/request stopped/);
  lifecycle.abort(Error('provider removed'));await assert.rejects(provider.list(),/provider removed/);
});
test('registration borrows optional host registry through the injected context',()=>{
  let calls=0;registerDiscordSkills({inject(names,apply){
    assert.deepEqual(names,['skills']);apply({skills:{registerProvider(factory){calls++;assert.equal(factory(control()).name,'dsh-discord')}}});
  }});
  assert.equal(calls,1);assert.doesNotThrow(()=>registerDiscordSkills({}));
});
