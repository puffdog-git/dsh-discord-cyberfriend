// 音樂／翻唱播放時不朗讀文字回覆（voiceMusicMuteSpeechEnabled）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscordVoice } from '../src/voice.js';
import { DEFAULTS, sanitizeConfig } from '../src/config.js';

function setup(cfg = {}) {
  const config = { voiceAutoSpeak: true, voiceMusicMuteSpeechEnabled: true, userAutoReply: true, ...cfg };
  const v = Object.create(DiscordVoice.prototype);
  const spoken = [];
  v.getConfig = () => config;
  v.sessions = new Map(
    ['user', 'bot'].map((kind) => [kind, { kind, guildId: 'g', channelId: 'room', textChannelId: 'text', queue: [], current: null, music: null }]),
  );
  v.log = { warn() {} };
  const realSpeak = v.speak;
  v.speak = function (args) {
    // 只記錄有沒有走到真正的排入；被音樂擋下的會在更前面就回傳 skipped。
    const s = this.sessions.get(args.kind);
    if (args.automatic && this.speechMutedByMusic(args.kind)) return { ok: true, skipped: true, reason: 'music' };
    spoken.push(args.text);
    return { ok: true, queued: true, session: s };
  };
  return { v, config, spoken, realSpeak };
}
const message = { guildId: 'g', channelId: 'text' };

test('設定：預設關閉', () => {
  assert.equal(DEFAULTS.voiceMusicMuteSpeechEnabled, false);
  assert.equal(sanitizeConfig({ voiceMusicMuteSpeechEnabled: true }).voiceMusicMuteSpeechEnabled, true);
});

test('音樂、翻唱、壓低音樂、被打斷等著接續的音樂：都不朗讀；播完就恢復', async () => {
  const { v, spoken } = setup();
  const s = v.sessions.get('user');
  const cases = [
    () => (s.current = { type: 'music' }),
    () => ((s.current = { type: 'speech' }), (s.music = { type: 'music' })),
    () => ((s.current = { type: 'speech' }), (s.queue = [{ type: 'music', offset: 0 }])),
  ];
  for (const arrange of cases) {
    s.current = null;
    s.music = null;
    s.queue = [];
    arrange();
    assert.equal(v.speechMutedByMusic('user'), true);
    assert.equal(v.expectsSpeech(message, { kind: 'user' }), false);
    await v.autoSpeak(message, { kind: 'user' }, '這句不該唸', {});
  }
  assert.deepEqual(spoken, []);
  s.current = null;
  s.music = null;
  s.queue = [];
  assert.equal(v.speechMutedByMusic('user'), false);
  assert.equal(v.expectsSpeech(message, { kind: 'user' }), true);
  await v.autoSpeak(message, { kind: 'user' }, '這句要唸', {});
  assert.deepEqual(spoken, ['這句要唸']);
});

test('同一個語音房裡另一個插件帳號在播音樂也算；別的語音房不算', () => {
  const { v } = setup();
  v.sessions.get('bot').current = { type: 'music' };
  assert.equal(v.speechMutedByMusic('user'), true);
  v.sessions.get('bot').channelId = 'other-room';
  assert.equal(v.speechMutedByMusic('user'), false);
  assert.equal(v.speechMutedByMusic('nobody'), false);
});

test('開關關著：音樂播放中照常朗讀（維持原本的行為）', async () => {
  const { v, spoken } = setup({ voiceMusicMuteSpeechEnabled: false });
  v.sessions.get('user').current = { type: 'music' };
  assert.equal(v.speechMutedByMusic('user'), false);
  assert.equal(v.expectsSpeech(message, { kind: 'user' }), true);
  await v.autoSpeak(message, { kind: 'user' }, '照常唸', {});
  assert.deepEqual(spoken, ['照常唸']);
});

test('真正的 speak：自動朗讀被擋下、回報原因；手動朗讀不受影響（不在這裡被擋）', () => {
  const { v, realSpeak } = setup();
  v.session = (kind) => v.sessions.get(kind);
  v.sessions.get('user').current = { type: 'music' };
  const result = realSpeak.call(v, { kind: 'user', text: 'x', automatic: true, sourceChannelId: 'text' });
  assert.deepEqual(result, { ok: true, skipped: true, reason: 'music' });
  // 手動（automatic 不是 true）會繼續往下走到 TTS 檢查，這裡用「外部 TTS 尚未就緒」當作沒有被音樂擋下的證據。
  v.status = () => ({ tts: { ready: false } });
  assert.throws(() => realSpeak.call(v, { kind: 'user', text: 'x', sourceChannelId: 'text' }), /TTS/);
});
