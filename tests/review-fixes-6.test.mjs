import test from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/ledger.js';
import { ReplyGate } from '../src/features/gate.js';
import { sanitizeConfig } from '../src/config.js';

const config = sanitizeConfig({ othersDm_dmReplyEnabled: true, enabled: true, dryRun: false, cooldownSeconds: 60 });
function gate() {
  const ledger = new Ledger();
  ledger.configure(config);
  const g = new ReplyGate({ config, ledger });
  g.configure(config);
  return g;
}
const dm = (transport, channelId, author = 'friend') => [
  { id: 'm', channelId, transport, content: 'hi', author: { id: author }, isDm: true },
  'dm',
  { selfId: transport === 'bot' ? 'bot-id' : 'user-id', transportEnabled: true, transport },
];

test('private-message cooldown is counted separately for each of our accounts', () => {
  const g = gate();
  assert.equal(g.check(...dm('user', 'user-dm')).ok, true);
  // 同一個人接著私訊另一個帳號：不受前一個帳號的冷卻影響。
  const other = g.check(...dm('bot', 'bot-dm'));
  assert.equal(other.ok, true, other.reason);
  // 各帳號自己的冷卻仍然有效。
  assert.match(g.check(...dm('user', 'user-dm')).reason, /冷卻中/);
  assert.match(g.check(...dm('bot', 'bot-dm')).reason, /冷卻中/);
  // 另一個人不受影響。
  assert.equal(g.check(...dm('user', 'user-dm-2', 'someone-else')).ok, true);
});

test('mention cooldown in servers stays shared between our accounts', () => {
  const g = gate();
  const mention = (transport) => [
    { id: 'm', channelId: 'room', guildId: 'guild', transport, content: 'hi', author: { id: 'friend' } },
    'mention',
    { selfId: transport, transportEnabled: true, transport },
  ];
  assert.equal(g.check(...mention('user')).ok, true);
  assert.match(g.check(...mention('bot')).reason, /冷卻中/);
});

test('private-message hourly limit is counted separately for each of our accounts and survives a settings save', () => {
  const hourly = sanitizeConfig({ othersDm_dmReplyEnabled: true, enabled: true, dryRun: false, cooldownSeconds: 0, maxRepliesPerHour: 1 });
  const ledger = new Ledger();
  ledger.configure(hourly);
  const g = new ReplyGate({ config: hourly, ledger });
  g.configure(hourly);
  assert.equal(g.check(...dm('user', 'user-dm', 'a')).ok, true);
  // 使用者帳號的額度用完，不影響機器人的私訊額度。
  const bot = g.check(...dm('bot', 'bot-dm', 'b'));
  assert.equal(bot.ok, true, bot.reason);
  assert.match(g.check(...dm('user', 'user-dm-2', 'c')).reason, /每小時/);
  assert.match(g.check(...dm('bot', 'bot-dm-2', 'c')).reason, /每小時/);
  // 存檔會重新套用設定：已用的額度不能被清掉，調高上限後才放行。
  g.configure(hourly);
  assert.match(g.check(...dm('user', 'user-dm-2', 'c')).reason, /每小時/);
  g.configure({ ...hourly, maxRepliesPerHour: 2 });
  assert.equal(g.check(...dm('user', 'user-dm-2', 'c')).ok, true);
  assert.match(g.check(...dm('user', 'user-dm-3', 'd')).reason, /每小時/);
});
