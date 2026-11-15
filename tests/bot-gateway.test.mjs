import test from 'node:test';
import assert from 'node:assert/strict';
import { BotTransport } from '../src/transport/bot.js';

class Socket {
  static instances=[];
  constructor(url){this.url=url;this.readyState=0;this.handlers={};this.sent=[];Socket.instances.push(this);}
  addEventListener(type, fn){(this.handlers[type]??=[]).push(fn);}
  emit(type, data={}){if(type==='open')this.readyState=1;if(type==='close')this.readyState=3;for(const fn of this.handlers[type]||[])fn(data);}
  packet(p){this.emit('message',{data:JSON.stringify(p)});}
  send(data){this.sent.push(JSON.parse(data));}
  close(code,reason){this.closed={code,reason};this.readyState=2;}
}
const fixture=()=>{Socket.instances=[];const events=[];const log=Object.fromEntries(['info','warn','error','debug'].map(k=>[k,(event,...rest)=>events.push({event,rest})]));const bot=new BotTransport({WebSocketImpl:Socket,random:()=>.5,log});bot.config={botToken:'mock-only'};return {bot,events};};
async function open(bot){const p=bot.openGateway();const ws=bot.ws;ws.emit('open');await p;return ws;}
const ready=(ws)=>ws.packet({op:0,t:'READY',s:42,d:{session_id:'session',resume_gateway_url:'wss://gateway-us-east1-b.discord.gg',user:{id:'bot',username:'test'},guilds:[]}});

test('late logout close and packets cannot touch replacement state, heartbeat or sequence',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const {bot}=fixture();const old=await open(bot);old.packet({op:10,d:{heartbeat_interval:1000}});ready(old);
 await bot.disconnect();bot.closing=false;const current=await open(bot);current.packet({op:10,d:{heartbeat_interval:1000}});ready(current);const timer=bot.heartbeatTimer;
 old.emit('close',{code:1000});old.packet({op:0,t:'READY',s:999,d:{session_id:'stale'}});
 assert.equal(bot.ws,current);assert.equal(bot.state,'connected');assert.equal(bot.seq,42);assert.equal(bot.heartbeatTimer,timer);assert.equal(bot.reconnectTimer,null);assert.equal(bot.disconnectCount,0);await bot.disconnect();
});

test('resume uses READY URL and seq; successful resume resets backoff',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const {bot}=fixture();const ws=await open(bot);ready(ws);ws.emit('close',{code:1006});assert.ok(bot.reconnectTimer);t.mock.timers.tick(2500);const next=bot.ws;assert.match(next.url,/gateway-us-east1-b.discord.gg/);assert.match(next.url,/v=10/);next.emit('open');next.packet({op:10,d:{heartbeat_interval:1000}});assert.equal(next.sent[0].op,6);assert.equal(next.sent[0].d.seq,42);next.packet({op:0,t:'RESUMED',s:43,d:{}});assert.equal(bot.reconnectAttempts,0);assert.equal(bot.state,'connected');await bot.disconnect();
});

test('heartbeat first jitter owns full subsequent interval; stop cancels first beat',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const {bot}=fixture();const ws=await open(bot);bot.startHeartbeat(1000);t.mock.timers.tick(500);assert.equal(ws.sent.length,1);await bot.handleGateway({op:11});t.mock.timers.tick(500);assert.equal(ws.sent.length,1);t.mock.timers.tick(500);assert.equal(ws.sent.length,2);bot.stopHeartbeat();bot.startHeartbeat(1000);bot.stopHeartbeat();t.mock.timers.tick(1000);assert.equal(ws.sent.length,2);await bot.disconnect();
});

test('missing heartbeat ACK retires socket and schedules recovery, server heartbeat tracks ACK',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const {bot}=fixture();const ws=await open(bot);bot.startHeartbeat(1000);t.mock.timers.tick(500);t.mock.timers.tick(1000);assert.equal(ws.closed.code,4000);assert.equal(bot.ws,null);assert.ok(bot.reconnectTimer);await bot.disconnect();
 const f=fixture();const next=await open(f.bot);await f.bot.handleGateway({op:1});assert.equal(next.sent[0].op,1);assert.equal(f.bot.awaitingAck,true);await f.bot.handleGateway({op:11});assert.equal(f.bot.awaitingAck,false);await f.bot.disconnect();
});

test('invalid session true preserves resume; false clears it and replaces socket',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});for(const resumable of [true,false]){const {bot}=fixture();const ws=await open(bot);ready(ws);await bot.handleGateway({op:9,d:resumable});assert.equal(bot.ws,null);assert.equal(bot.sessionId,resumable?'session':'');assert.equal(bot.seq,resumable?42:null);assert.equal(ws.closed.code,4000);t.mock.timers.tick(3000);const next=bot.ws;next.emit('open');next.packet({op:10,d:{heartbeat_interval:1000}});assert.equal(next.sent[0].op,resumable?6:2);await bot.disconnect();}
});

test('normal/expired closes start fresh; fatal intent/auth errors stop retrying',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});for(const code of [1000,1001,4007,4009,4004,4010,4011,4012,4013,4014]){const {bot}=fixture();const ws=await open(bot);ready(ws);ws.emit('close',{code});assert.equal(bot.lastDisconnect.code,code);assert.equal(bot.disconnectCount,1);if(code>=4010||code===4004){assert.equal(bot.state,'error');assert.equal(bot.reconnectTimer,null);}else{assert.equal(bot.sessionId,'');assert.ok(bot.reconnectTimer);}await bot.disconnect();}
});

test('server reconnect preserves session and handshake timeout cannot hang indefinitely',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const {bot}=fixture();const ws=await open(bot);ready(ws);await bot.handleGateway({op:7});assert.equal(ws.closed.code,4000);assert.equal(bot.sessionId,'session');await bot.disconnect();
 bot.closing=false;const pending=bot.openGateway();const rejected=assert.rejects(pending,/握手逾時/);t.mock.timers.tick(30000);await rejected;assert.ok(bot.reconnectTimer);await bot.disconnect();
});
