// 完整程式審查（2026-11-14）找到的問題，各有一個能重現的測試。
import test from 'node:test';
import assert from 'node:assert/strict';
import { BotTransport } from '../src/transport/bot.js';
import { TransportManager as Transports } from '../src/transports.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('B1：Gateway 事件的處理函式回傳非 Promise 或拋錯時，不會讓整個事件處理失敗', async () => {
  const unhandled = []; const onUnhandled = error => unhandled.push(error); process.on('unhandledRejection', onUnhandled);
  try {
    for (const t of ['INTERACTION_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE', 'MESSAGE_REACTION_ADD']) {
      const d = { id: 'm1', channel_id: 'c1', user_id: 'u1', message_id: 'm1', emoji: { name: '👍' }, author: { id: 'u1' } };
      // 同步回傳 undefined（例如集中分派器沒有回傳值）。
      const sync = new BotTransport({ onInteraction: () => undefined, onMessageChange: () => undefined, onReaction: () => undefined }); sync.config = {};
      await assert.doesNotReject(sync.handleGateway({ op: 0, t, d }), t + ' 同步');
      // 非同步失敗。
      const failing = new BotTransport({ onInteraction: async () => { throw Error('boom'); }, onMessageChange: async () => { throw Error('boom'); }, onReaction: async () => { throw Error('boom'); } }); failing.config = {};
      await assert.doesNotReject(failing.handleGateway({ op: 0, t, d }), t + ' 非同步');
    }
    await tick(); await tick();
    assert.equal(unhandled.length, 0, '非同步錯誤都有人接');
  } finally { process.off('unhandledRejection', onUnhandled); }
});

test('TR1：互動分派回傳處理函式的 Promise，非同步錯誤會被記錄而不是遺失', async () => {
  const warnings = [];
  const transports = Object.create(Transports.prototype);
  transports.log = { warn: (event, message, detail) => warnings.push({ event, detail }), error() {} };
  transports.byKind = { bot: {} };
  transports.handlers = { onInteraction: async () => { throw Error('handler failed'); } };
  const result = transports.dispatchInteraction({ id: 'i1' });
  assert.ok(result && typeof result.then === 'function', '回傳 Promise');
  await assert.doesNotReject(result);
  assert.equal(warnings.length, 1); assert.equal(warnings[0].event, 'transport.interaction'); assert.equal(warnings[0].detail.error, 'handler failed');
  transports.handlers = { onInteraction: () => 'ok' };
  assert.equal(await transports.dispatchInteraction({ id: 'i2' }), 'ok');
});

import { ReplyGate } from '../src/features/gate.js';
import { RateWindow, KeyedRateWindow } from '../src/util.js';
import { createReactionEngine } from '../src/features/reactions.js';
import { replyTemperature } from '../src/features/responder.js';
import { readFileSync, readdirSync } from 'node:fs';

test('G1：儲存無關設定不會把每小時回覆上限的累計清零；上限改變時只調整上限', () => {
  const gate = new ReplyGate({ config: { maxRepliesPerHour: 3 }, ledger: {}, log: {} });
  gate.configure({ maxRepliesPerHour: 3 });
  for (let i = 0; i < 3; i++) assert.equal(gate.hourly.mention.tryPass(), true);
  assert.equal(gate.hourly.mention.tryPass(), false);
  gate.configure({ maxRepliesPerHour: 3, personaName: '改了別的設定' });
  assert.equal(gate.hourly.mention.tryPass(), false, '存檔後仍維持已用完的狀態');
  gate.configure({ maxRepliesPerHour: 5 });
  assert.equal(gate.hourly.mention.snapshot().used, 3);
  assert.equal(gate.hourly.mention.tryPass(), true, '提高上限後可繼續');
  gate.configure({ maxRepliesPerHour: 100 });
  assert.equal(gate.hourly.cochat.snapshot().limit, 30, '閒聊上限仍封頂 30');
  gate.reset();
  assert.equal(gate.hourly.mention.snapshot().used, 0, '明確重設才清零');
});

test('U1：對話控制的頻率限制依「帳號＋頻道＋使用者」各自計算，一個人用完不影響其他人', () => {
  const window = new KeyedRateWindow(2, 60000, 3);
  assert.equal(window.tryPass('a'), true); assert.equal(window.tryPass('a'), true); assert.equal(window.tryPass('a'), false);
  assert.equal(window.tryPass('b'), true, '另一個鍵不受影響');
  for (const key of ['c', 'd', 'e']) window.tryPass(key);
  assert.ok(window.size <= 3, '鍵數有上限');
  const gate = new ReplyGate({ config: {}, ledger: {}, log: {} });
  const context = who => ({ selfId: 'self', transportEnabled: true, transport: 'bot', effectiveConfig: { dryRun: false, enabled: true, botEnabled: true, mentionReplyEnabled: true, dmReplyEnabled: true } });
  gate.check = () => ({ ok: true });
  const message = id => ({ channelId: 'c', author: { id }, isDm: true });
  for (let i = 0; i < 8; i++) assert.equal(gate.control(message('spammer'), context()).ok, true);
  assert.equal(gate.control(message('spammer'), context()).ok, false);
  assert.equal(gate.control(message('someone-else'), context()).ok, true);
  assert.ok(new RateWindow(1, 1000).tryPass());
});

test('RX1：觸發表情比對忽略變體選擇符（U+FE0F）', async () => {
  for (const [configured, received] of [['❓', '❓️'], ['❤️', '❤'], ['🤖', '🤖']]) {
    let responded = 0;
    const engine = createReactionEngine({ getConfig: () => ({ reactionCommandEnabled: true, reactionCommandTriggerEmojis: [configured], botEnabled: true }),
      responder: { respond: async () => { responded++; return { ok: true, messageId: 'answer' }; } }, gate: { check: () => ({ ok: true }) }, log: { error() {} } });
    const result = await engine.handleReaction({ channelId: 'c', messageId: 'm', emoji: received, userId: 'actor' },
      { kind: 'bot', selfId: 'self', getMessages: async () => ({ ok: true, messages: [{ id: 'm', channelId: 'c', content: 'question', author: { id: 'original' } }] }) });
    assert.equal(result.ok, true, configured + ' / ' + received); assert.equal(responded, 1);
  }
});

test('R2：隨機度設為 0 時，所有模型呼叫路徑都使用 0 而不是預設值', () => {
  assert.equal(replyTemperature({ temperature: 0 }), 0);
  assert.equal(replyTemperature({ temperature: '0.3' }), 0.3);
  assert.equal(replyTemperature({}), 0.8);
  assert.equal(replyTemperature({ temperature: 'x' }), 0.8);
  const responder = readFileSync(new URL('../src/features/responder.js', import.meta.url), 'utf8');
  assert.doesNotMatch(responder, /Number\(config\.temperature\) \|\| 0\.8/);
});

test('VM1：重播語音訊息時引用原訊息', () => {
  const source = readFileSync(new URL('../src/voice-messages.js', import.meta.url), 'utf8');
  const replay = source.slice(source.indexOf('async replay('), source.indexOf('close(){'));
  assert.match(replay.replace(/\s+/g, ''), /replyToMessageId:message\.id/);
  assert.doesNotMatch(replay, /replyTo:message\.id/);
});

import { MemberNames } from '../src/member-names.js';
import { addressedTo } from '../src/features/message-policy.js';

test('MN1：名稱沒有變化的訊息不會重新掃描整個聊天快取；真的改名才掃', () => {
  let scans = 0, dirty = 0;
  const entries = [{ guildId: 'g1', author: { id: '400000000000000001', name: 'Old', username: 'user', displayName: 'Global', guildNickname: 'Old' } }];
  const channels = { values() { scans++; return [entries].values(); } };
  const names = new MemberNames({ getConfig: () => ({ memberNameUpdatesEnabled: true }), history: { channels, markDirty() { dirty++; } }, lookupTimeoutMs: 5 });
  const transport = { kind: 'user', selfId: '400000000000000007' };
  const message = nick => ({ guildId: '400000000000000004', author: { id: '400000000000000001', username: 'user', displayName: 'Global', guildNickname: nick } });
  names.observe(message('Old'), transport);
  const first = scans;
  for (let i = 0; i < 50; i++) names.observe(message('Old'), transport);
  assert.equal(scans, first, '同名訊息不再掃描');
  names.observe(message('New'), transport);
  assert.equal(scans, first + 1, '改名時掃描一次');
  assert.equal(names.author(transport, '400000000000000001', '400000000000000004').name, 'New');
  // 明確的成員更新事件維持原行為。
  names.update({ userId: '400000000000000001', guildId: '400000000000000004', guildNickname: 'New' }, transport);
  assert.equal(scans, first + 2);
});

test('PS1：判斷「是否在回覆我」可直接用 Set，不必每則訊息把已送出 ID 展開成陣列', () => {
  const sent = new Set(['m1', 'm2']);
  assert.equal(addressedTo({ replyTo: 'm2', mentions: [] }, 'self', sent), addressedTo({ replyTo: 'm2', mentions: [] }, 'self', ['m1', 'm2']));
  assert.equal(Boolean(addressedTo({ replyTo: 'm2', mentions: [] }, 'self', sent)), true);
  assert.equal(Boolean(addressedTo({ replyTo: 'zzz', mentions: [] }, 'self', sent)), false);
  const source = readFileSync(new URL('../src/transport/pyself.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /addressedTo\([^)]*\[\.\.\.this\.sentIds\]/);
});

import { buildPrompt } from '../src/persona.js';
import { createResponder } from '../src/features/responder.js';
import { DiscordVoice } from '../src/voice.js';
import { sanitizeConfig } from '../src/config.js';

test('SD1：語音提示段落只在這則回覆實際會被朗讀時才加入提示詞', async () => {
  const voiceConfig = { voiceEnabled: true, voiceAutoSpeak: true, voiceEmotionMode: 'context' };
  assert.match(buildPrompt({ config: voiceConfig, kind: 'dm', message: '嗨' }).system, /內部語音資料/, '未指定時維持原行為');
  assert.match(buildPrompt({ config: voiceConfig, kind: 'dm', message: '嗨', speech: true }).system, /內部語音資料/);
  assert.doesNotMatch(buildPrompt({ config: voiceConfig, kind: 'dm', message: '嗨', speech: false }).system, /內部語音資料|speech_meta/);

  // 語音模組的判斷與自動朗讀的條件一致：同帳號、同伺服器、綁定的文字頻道。
  const expects = DiscordVoice.prototype.expectsSpeech;
  const voice = { getConfig: () => ({ voiceAutoSpeak: true }), sessions: new Map([['bot', { guildId: 'g', textChannelId: 'text' }]]) };
  assert.equal(expects.call(voice, { guildId: 'g', channelId: 'text' }, { kind: 'bot' }), true);
  assert.equal(expects.call(voice, { guildId: 'g', channelId: 'other' }, { kind: 'bot' }), false);
  assert.equal(expects.call(voice, { guildId: 'g', channelId: 'text' }, { kind: 'user' }), false);
  assert.equal(expects.call(voice, { guildId: 'g', channelId: 'text', simulated: true }, { kind: 'bot' }), false);
  assert.equal(expects.call(voice, { channelId: 'text' }, { kind: 'bot' }), false);
  assert.equal(expects.call({ ...voice, getConfig: () => ({ voiceAutoSpeak: false }) }, { guildId: 'g', channelId: 'text' }, { kind: 'bot' }), false);

  // 實際回覆流程：沒有綁定語音房的文字頻道不帶語音段落，會朗讀時才帶。
  const config = sanitizeConfig({ enabled: true, dryRun: false, replyEngine: 'dsh', minReplyDelaySeconds: 0, maxReplyDelaySeconds: 0, gifEnabled: false, voiceEnabled: true, voiceAutoSpeak: true, voiceEmotionMode: 'context' });
  for (const spoken of [false, true]) {
    let system = '';
    const transport = { kind: 'bot', ready: true, selfId: 'bot', selfName: 'AI', sendMessage: async () => ({ ok: true, messageId: 'reply' }) };
    const responder = createResponder({ getConfig: () => config, history: { find: () => null, record() {}, contextText: () => '' }, ledger: { record() {} },
      log: { info() {}, debug() {}, warn() {}, error() {} }, semaphore: { run: f => f() }, prepareMedia: async () => ({ images: [] }),
      sessionBridge: { run: async (m, t, c, o) => { system = o.system; return { ok: true, text: '好的。', sessionId: 'session' }; } }, speechExpected: () => spoken });
    const result = await responder.respond({ id: 'm1', channelId: 'c1', guildId: 'g', content: '<@bot> 嗨', author: { id: 'u1', name: '甲' }, mentions: [{ id: 'bot' }], stickers: [], embedDetails: [] }, 'mention', transport);
    assert.equal(result.ok, true);
    assert.equal(/內部語音資料/.test(system), spoken, spoken ? '會朗讀時帶語音段落' : '不會朗讀時不帶');
  }
});

test('R1：貼圖／GIF 找不到而改用純文字重問時，正式會話仍使用精簡提示（不重複存入固定字句）', async () => {
  const config = sanitizeConfig({ enabled: true, dryRun: false, replyEngine: 'dsh', minReplyDelaySeconds: 0, maxReplyDelaySeconds: 0, gifEnabled: false, stickerAutoSendEnabled: true });
  const calls = [];
  const transport = { kind: 'bot', ready: true, selfId: 'bot', selfName: 'AI', sendMessage: async () => ({ ok: true, messageId: 'reply' }), searchStickers: async () => ({ ok: true, stickers: [] }), getStickers: async () => ({ ok: true, stickers: [] }) };
  const responder = createResponder({ getConfig: () => config, history: { find: () => null, record() {}, contextText: () => '' }, ledger: { record() {} },
    log: { info() {}, debug() {}, warn() {}, error() {} }, semaphore: { run: f => f() }, prepareMedia: async () => ({ images: [] }),
    sessionBridge: { run: async (m, t, c, o) => { calls.push(o); return { ok: true, text: calls.length === 1 ? '[STICKER: 不存在的貼圖]' : '改用文字回答。', sessionId: 'session' }; } } });
  const result = await responder.respond({ id: 'm1', channelId: 'c1', guildId: 'g', content: '<@bot> 嗨', author: { id: 'u1', name: '甲' }, mentions: [{ id: 'bot' }], stickers: [], embedDetails: [] }, 'mention', transport);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2, '第一次只有找不到的貼圖，所以重問一次');
  const full = buildPrompt({ config, kind: 'mention', selfName: 'AI', historyText: '', message: '<@bot> 嗨', author: { id: 'u1', name: '甲' }, isGuild: true });
  const compact = buildPrompt({ compact: true, config, kind: 'mention', selfName: 'AI', historyText: '', message: '<@bot> 嗨', author: { id: 'u1', name: '甲' }, isGuild: true });
  assert.ok(compact.user.length < full.user.length, '精簡提示確實較短');
  assert.ok(calls[1].user.length <= calls[0].user.length + 5, '重問的使用者訊息不比第一次長（同為精簡格式）');
});

import { resolveApiKey } from '../src/llm.js';

test('LLM1：自訂 API 只使用明確填寫的金鑰，或名稱與目的主機相符的環境變數；不把別家金鑰送出去', async () => {
  const names = ['DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY', 'SILICONFLOW_API_KEY', 'MOONSHOT_API_KEY'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    process.env.OPENAI_API_KEY = 'openai-only-test-value';
    assert.equal(await resolveApiKey({ customLlmApiBase: 'https://api.deepseek.com' }), '', 'OpenAI 的金鑰不送到 DeepSeek');
    assert.equal(await resolveApiKey({}), '', '預設網址是 DeepSeek，同樣不使用');
    assert.equal(await resolveApiKey({ customLlmApiBase: 'https://api.openai.com/v1' }), 'openai-only-test-value');
    assert.equal(await resolveApiKey({ customLlmApiBase: 'https://openai.com.attacker.example/v1' }), '', '只比對主機名稱結尾');
    assert.equal(await resolveApiKey({ customLlmApiBase: 'not a url' }), '');
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-value';
    assert.equal(await resolveApiKey({ customLlmApiBase: 'https://api.deepseek.com' }), 'deepseek-test-value');
    assert.equal(await resolveApiKey({ customLlmApiBase: 'https://api.deepseek.com', customLlmApiKey: ' explicit ' }), 'explicit', '明確填寫的優先');
    assert.equal(await resolveApiKey({ customLlmApiBase: 'https://example.internal/v1', customLlmApiKey: 'explicit' }), 'explicit');
    assert.equal(await resolveApiKey({ customLlmApiBase: 'https://example.internal/v1' }), '', '其他主機必須明確填寫金鑰');
    const source = readFileSync(new URL('../src/llm.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.credentials\.yaml/, '不再讀取宿主憑證檔猜金鑰');
  } finally {
    for (const name of names) if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
  }
});

test('VO1／VI1：「收句後至首音」延遲在語音輸入、播放與控制台三處使用同一組欄位', () => {
  const src = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
  const input = src('src/voice-input.js'), voice = src('src/voice.js'), panel = src('client-src/34-voice.js');
  // 語音輸入交給回覆流程的時間點，就是播放端用來計算的那個欄位。
  assert.match(input.replace(/\s+/g, ''), /voiceTiming:\{inputReadyAt:controller\.inputReadyAt,sttMs\}/);
  assert.doesNotMatch(input + voice, /inputStartedAt/, '不再參照從未設定的欄位');
  assert.match(voice.replace(/\s+/g, ''), /this\.now\(\)-j\.voiceTiming\.inputReadyAt/);
  // 回報給控制台的鍵與介面讀取的鍵一致。
  assert.match(panel, /lastResult\.inputReadyToFirstAudioMs/);
  assert.match(voice.replace(/\s+/g, ''), /inputReadyToFirstAudioMs:j\.inputReadyToFirstAudioMs/);
  assert.doesNotMatch(voice.replace(/\s+/g, ''), /inputToFirstAudioMs:j\.inputToFirstAudioMs/);
});

import { MediaCulture } from '../src/media-culture.js';
import { mkdtemp, rm, readFile as readFileAsync } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('MC1：每則訊息不再複製整個去重集合；去重紀錄在存檔時才寫出，重啟後仍有效', async () => {
  const root = await mkdtemp(join(tmpdir(), 'culture-review-'));
  try {
    const deps = { file: join(root, 'culture.json'), getConfig: () => ({ enabled: true, mediaPerceptionCacheEnabled: true }), memoryOutput: { recordSource: async () => {} }, getSelfIds: () => ['bot'] };
    const culture = new MediaCulture(deps); await culture.init();
    const before = culture.data.seen;
    for (let i = 0; i < 20; i++) await culture.observe({ id: 'm' + i, channelId: 'c', guildId: 'g', author: { id: 'member' }, content: '純文字 ' + i }, { kind: 'bot', selfId: 'bot' }, { recent: () => [], find: () => null });
    assert.equal(culture.data.seen, before, '觀察訊息時不重建陣列');
    assert.equal(culture.seen.size, 20);
    await culture.save();
    const stored = JSON.parse(await readFileAsync(deps.file, 'utf8'));
    assert.equal(stored.seen.length, 20);
    const reloaded = new MediaCulture(deps); await reloaded.init();
    assert.ok(reloaded.seen.has('c:m7'), '重新載入後仍記得已看過的訊息');
  } finally { await rm(root, { recursive: true, force: true }); }
});
