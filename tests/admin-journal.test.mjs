import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AdminJournal} from '../src/admin-journal.js';
test('all admin ingress is durable before reply gates, retries busy sessions across restart, ignores others',async()=>{
 const root=await mkdtemp(join(tmpdir(),'admin-journal-')),file=join(root,'inbox.json');let busy=true,calls=0;
 const deps={file,getConfig:()=>({enabled:true,adminUserId:'owner'}),bridge:{identity:()=> 'bot:1:2',archive:async()=>{calls++;if(busy)throw Error('busy');return {sessionId:'session-test'};}}};
 const msg={id:'3',author:{id:'owner'},content:'no mention'},transport={kind:'bot',selfId:'1'};
 try{
  const journal=new AdminJournal(deps);await journal.init();
  await journal.capture(msg,transport,async()=>{assert.equal(Object.keys(JSON.parse(await readFile(file))).length,1);return null;});
  assert.equal(calls,1);assert.equal(Object.keys(journal.pending).length,1);
  const restarted=new AdminJournal(deps);await restarted.init();busy=false;await restarted.drain();
  assert.equal(Object.keys(JSON.parse(await readFile(file))).length,0);
  await restarted.capture({...msg,author:{id:'other'}},transport,async()=>null);assert.equal(calls,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
