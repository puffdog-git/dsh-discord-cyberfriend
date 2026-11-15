import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DiaryAgent} from '../src/diary-agent.js';
const input={args:{title:'角色稱呼',content:'管理者希望稱呼採用既定的角色名字，並維持同一工作區的人格。',tags:['discord-diary'],fact_key:'test-fact'},exec:{agent:{session:{header:{cwd:'C:/workspace'}}},signal:new AbortController().signal},evidenceIds:['real-message'],cwd:'C:/workspace',sessionId:'source-session'};
test('meow adapter uses the public scoped tool, confines project scope, and requires an actual ID',async()=>{
 let request;const ctx={get:n=>n==='tools'?{get:name=>name==='memory_remember'?{execute:async(args,exec)=>{request={args,agent:exec.agent};return {ok:true,id:'actual-uuid'}}}:null}:null};const writer=new DiaryAgent({ctx,getConfig:()=>({})});
 const receipt=await writer.writers.get('meow')(input);assert.equal(receipt.status,'stored');assert.equal(request.args.project,'discord-diary');assert.equal(request.args.level,'fact');assert.equal(request.agent,input.exec.agent);assert.equal(request.args.content,input.args.content);assert.equal(writer.connectors().find(c=>c.id==='meow').available,true);
 ctx.get=()=>({get:()=>({execute:async()=>({ok:true})})});assert.equal((await writer.writers.get('meow')(input)).status,'unverified');
 ctx.get=()=>({get:()=>undefined});await assert.rejects(writer.writers.get('meow')(input),/未註冊/);assert.equal(writer.connectors().find(c=>c.id==='meow').available,false);
});
test('universal handoff preserves evidence, deduplicates re-export, and cannot claim external ingestion',async()=>{
 const root=await mkdtemp(join(tmpdir(),'discord-memory-handoff-'));const writer=new DiaryAgent({ctx:{get:()=>undefined},getConfig:()=>({})});try{const request={...input,sourcePath:join(root,'diary.md')},a=await writer.writers.get('files')(request),b=await writer.writers.get('files')(request);assert.equal(a.status,'exported');assert.deepEqual(a.ids,[]);assert.equal(a.path,b.path);const rows=(await readFile(a.path,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(rows.length,1);assert.deepEqual(rows[0].evidenceIds,input.evidenceIds);assert.equal(rows[0].sessionId,input.sessionId);assert.equal(rows[0].schema,'dsh.discord.memory-candidate');await assert.rejects(writer.writers.get('files')({...input,sourcePath:'relative.md'}),/完整路徑/)}finally{await rm(root,{recursive:true,force:true})}
});
