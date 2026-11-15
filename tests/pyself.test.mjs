import {authenticatedTestContext} from './http-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PySelfTransport } from '../src/transport/pyself.js';
import { DEFAULTS, describeSchema, publicConfig, sanitizeConfig } from '../src/config.js';
import { createApiHandler } from '../src/api.js';
import { createToolDefinitions } from '../src/tools.js';
import { TransportManager } from '../src/transports.js';
import { createResponder } from '../src/features/responder.js';

const quiet = { info() {}, warn() {}, error() {}, debug() {} };
const worker = fileURLToPath(new URL('./fixture_worker.py', import.meta.url));
const channelId = '1560000000000000004', selfId = '1560000000000000003';
const freshId = offset => String((BigInt(Date.now() - 1420070400000) << 22n) + BigInt(offset));
async function until(fn) { for (let n=0;n<100;n++) { if(fn()) return; await new Promise(r=>setTimeout(r,50)); } assert.fail('condition timed out'); }
async function startFixture(t, config = {}, onMessage) {
  const transport = new PySelfTransport({ worker, log: quiet, onMessage });
  t.after(() => transport.disconnect());
  const result = await transport.connect(sanitizeConfig({othersDm_dmReplyEnabled:true, userToken: 'fixture-only', ...config }));
  assert.equal(result.ok, true); await until(() => transport.ready);
  return transport;
}

test('new plugin defaults isolate credentials and disable automated sends', () => {
  assert.equal(DEFAULTS.userToken, ''); assert.equal(DEFAULTS.botToken, '');
  assert.equal(DEFAULTS.userAutoStart, false); assert.equal(DEFAULTS.userReceiveOnly, true);
  assert.equal(DEFAULTS.userAutoReply, false); assert.equal(DEFAULTS.dryRun, true);
  const keys = describeSchema().fields.map(f=>f.key);
  assert.ok(keys.includes('userToken')); assert.ok(keys.includes('userPythonExecutable'));
  assert.ok(!keys.some(k=>k.startsWith('userBrowser')));
  const exposed = publicConfig(sanitizeConfig({othersDm_dmReplyEnabled:true, userToken: 'fixture-secret' }));
  assert.equal(exposed.userToken, ''); assert.equal(exposed.userToken__set, true);
});

test('tool names and manager use the isolated namespace and Python transport', () => {
  const manager = new TransportManager({}); assert.ok(manager.byKind.user instanceof PySelfTransport);
  const definitions = createToolDefinitions({});
  assert.equal(definitions.length, 20);
  assert.ok(definitions.every(d=>d.name.startsWith('discord_cyberfriend_')));
  assert.ok(definitions.some(d=>d.name === 'discord_cyberfriend_config'));
  assert.equal(new Set(definitions.map(d=>d.name)).size, definitions.length);
});

test('missing token does not start Python or read another plugin credential', async () => {
  const transport = new PySelfTransport({ spawnProcess: () => assert.fail('unexpected process') });
  const result = await transport.connect({}); assert.equal(result.ok, false); assert.match(result.error, /User Token/);
});

test('DNS failures are reported as curl errors rather than Gateway authentication failures', () => {
  const transport = new PySelfTransport({ log: quiet });
  transport.event({ event: 'gateway_connect', host: 'gateway.discord.gg' });
  transport.event({ event: 'error', code: 'CurlError', curlCode: 6 });
  assert.equal(transport.lastError.closeCode, undefined);
  assert.equal(transport.lastError.curlCode, 6);
  assert.match(transport.message, /DNS/);
  assert.match(transport.message, /gateway.discord.gg/);
  assert.ok(!transport.message.includes('4004'));
});

test('API forwards user token to Python and persists only in lab config', async () => {
  let saved;
  const handler = createApiHandler({ctx:authenticatedTestContext, getConfig: () => ({}), getLogger: () => quiet,
    setConfig: patch => { saved = patch; }, getManager: () => ({ configure() {},
      start: async (kind, config) => { assert.equal(kind, 'user'); assert.equal(config.userToken, 'fixture-token'); return { ok: true, pending: true }; },
      status: () => ({ user: { state: 'connecting' } }),
    }) });
  const req = Readable.from([Buffer.from('{"transport":"user","token":"fixture-token"}')]);
  req.method = 'POST'; req.url = '/api/discord-cyberfriend/login'; req.headers={'content-type':'application/json'};
  let body; await handler(req, { setHeader() {}, end(value) { body = JSON.parse(value); } });
  assert.equal(body.pending, true); assert.deepEqual(saved, { userToken: 'fixture-token' });
  assert.ok(!JSON.stringify(body).includes('fixture-token'));
});

test('real Python process and installed library initialize without Discord network access', async t => {
  const seen = [];
  const transport = await startFixture(t, {}, m=>seen.push(m));
  assert.equal(transport.getStatus().libraryVersion, '2.1.0');
  await until(()=>transport.receivedCount > 0); assert.equal(seen.length, 1);assert.equal(seen[0].memoryOnly,true);
  assert.equal((await transport.sendMessage(channelId, { content: 'blocked' })).ok, false);
  // Defense in depth: even a direct RPC cannot bypass receive-only mode.
  const direct = await transport.rpc('send', { channelId, options: { content: 'blocked' } });
  assert.equal(direct.ok, false);assert.equal(direct.code,'PermissionError');assert.match(direct.error,/僅觀察/);
  assert.deepEqual((await transport.getMessages(channelId)).messages, []);
  await transport.disconnect(); assert.equal(transport.process, null); assert.equal(transport.ready, false);
});

test('new DM -> responder -> host model -> production Python send -> confirmation', async t => {
  const config = sanitizeConfig({othersDm_dmReplyEnabled:true, userEnabled: true, userToken: 'fixture-only', userReceiveOnly: false, userAutoReply: true,
    dryRun: false, replyQuote: true, minReplyDelaySeconds: 0, maxReplyDelaySeconds: 0 });
  let received, completion, callCount = 0;
  const records = [];
  const llm = { listProviders: () => [{ provider: 'fixture' }], prepareCall: async options => ({ config: options,
    async *stream(request) { callCount++; assert.match(JSON.stringify(request.messages), /fixture question/);
      yield { type: 'text-delta', text: 'fixture AI response' }; yield { type: 'finish', reason: { kind: 'stop' } }; } }) };
  const responder = createResponder({ ctx: { get: name=>name==='llm'?llm:undefined }, getConfig: ()=>config,
    history: { contextText: ()=>'', record: m=>records.push(m) }, ledger: { record() {} },
    log: quiet, semaphore: { run: fn=>fn() } });
  const transport = await startFixture(t, config, message => {
    received = message; completion = responder.respond(message, 'dm', transport);
  });
  await until(()=>completion); const result = await completion;
  assert.equal(result.ok, true); assert.equal(callCount, 1); assert.equal(received.isDm, true);
  assert.equal(records.at(-1).selfAuthored, true);
  const history = await transport.getMessages(channelId);
  assert.deepEqual(history.messages.map(m=>m.content), ['fixture AI response']);
  transport.configure({ ...config, userAutoReply: false });
  const stopped = await transport.sendMessage(channelId, { content: 'late', autoReply: true });
  assert.equal(stopped.ok, false);
  const pythonStopped = await transport.rpc('send', { channelId, options: { content: 'late', autoReply: true } });
  assert.equal(pythonStopped.ok, false);
});

test('missing quoted message fails without falling back to an unquoted send', async t => {
  const transport = await startFixture(t, { userReceiveOnly: false });
  const result = await transport.sendMessage(channelId, { content: 'quote', replyToMessageId: '1' });
  assert.equal(result.ok, false);
  assert.equal((await transport.getMessages(channelId)).messages.length, 0);
});

test('authentication failure is observable without leaking exception details', async t => {
  const transport = new PySelfTransport({ worker, log: quiet }); t.after(()=>transport.disconnect());
  const result = await transport.connect({ userToken: 'fixture-rejected' }); assert.equal(result.ok, true);
  await until(()=>transport.state === 'error');
  assert.match(transport.message, /LoginFailure/);
  assert.ok(!JSON.stringify(transport.getStatus()).includes('secret_should_never_appear'));
});

test('concurrent login launches one worker and never puts token in process arguments', async t => {
  let launches = 0;
  const transport = new PySelfTransport({ worker, log: quiet, spawnProcess: (exe, args, options) => {
    launches++; assert.ok(!JSON.stringify(args).includes('fixture-only'));
    assert.equal(options.windowsHide, true); assert.equal(options.env, undefined);
    return spawn(exe, args, options);
  } });
  t.after(()=>transport.disconnect());
  const results = await Promise.all([transport.connect({ userToken: 'fixture-only' }), transport.connect({ userToken: 'fixture-only' })]);
  assert.ok(results.every(r=>r.ok)); assert.equal(launches, 1);
});

test('replaced session cancels a reply produced for an earlier connection', async t => {
  const transport = await startFixture(t, { userReceiveOnly: false, userAutoReply: true });
  const result = await transport.sendMessage(channelId, { content: 'old result', autoReply: true,
    expectedSelfId: selfId, sessionEpoch: transport.epoch - 1 });
  assert.equal(result.ok, false); assert.match(result.error, /工作階段/);
  assert.equal((await transport.getMessages(channelId)).messages.length, 0);
});

test('self, historical and duplicate inputs are ignored; unwatched guild inputs are archival only', () => {
  const received = [];
  const transport = new PySelfTransport({ onMessage: m=>received.push(m) });
  transport.config = { userReceiveOnly: false, userAutoReply: true, userWatchDms: true, userChannelIds: ['111111111111111111'] };
  transport.process = {}; transport.selfId = selfId; transport.state = 'connected'; transport.liveSince = Date.now()-1;
  const packet = (id, extra={}) => ({ event: 'message', message: { id, channelId, isDm: true,
    author: { id: '1560000000000000005', name: 'fixture' }, content: 'test', ...extra } });
  const first = packet(freshId(1)); transport.event(first); transport.event(first);
  transport.event(packet(freshId(2), { author: { id: selfId } }));
  transport.event(packet('100000000000000000'));
  transport.event(packet(freshId(3), { isDm: false, guildId: '222222222222222222' }));
  assert.equal(received.length, 2);
  assert.equal(received[0].memoryOnly, undefined);
  assert.equal(received[1].memoryOnly, true);
});
