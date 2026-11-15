import test from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/ledger.js';
import { ReplyGate } from '../src/features/gate.js';
import { sanitizeConfig, describeSchema } from '../src/config.js';

const ADMIN = '100000000000000001';
// 把四個對象的冷卻與連續輪數都關掉，只留下三個總量上限，才看得出是哪一個在擋。
const quiet = Object.fromEntries(
  ['adminDm', 'adminGroup', 'othersDm', 'othersGroup'].flatMap((a) => [
    [a + '_cooldownSeconds', 0],
    [a + '_roundCapPerUser', 0],
    [a + '_dmReplyEnabled', true],
    [a + '_mentionReplyEnabled', true],
  ]),
);
function setup(extra = {}) {
  const config = sanitizeConfig({ enabled: true, dryRun: false, adminUserId: ADMIN, ...quiet, ...extra });
  const ledger = new Ledger();
  ledger.configure(config);
  const gate = new ReplyGate({ config, ledger });
  gate.configure(config);
  return { gate, ledger, config };
}
const mention = (author, id = 'm') => [
  { id, channelId: 'room', guildId: 'guild', transport: 'bot', content: 'hi', author: { id: author } },
  'mention',
  { selfId: 'bot-id', transportEnabled: true, transport: 'bot' },
];
const dm = (author) => [
  { id: 'd', channelId: 'dm-' + author, transport: 'bot', content: 'hi', author: { id: author }, isDm: true },
  'dm',
  { selfId: 'bot-id', transportEnabled: true, transport: 'bot' },
];

test('the hourly limit applies to other users in total, and never blocks the admin', () => {
  const { gate } = setup({ maxRepliesPerHour: 2 });
  assert.equal(gate.check(...mention('friend-a')).ok, true);
  assert.equal(gate.check(...mention('friend-b')).ok, true);
  assert.match(gate.check(...mention('friend-c')).reason, /每小時回覆數已達上限/);
  for (let i = 0; i < 5; i += 1) {
    const result = gate.check(...mention(ADMIN, 'admin-' + i));
    assert.equal(result.ok, true, result.reason);
  }
  assert.equal(gate.check(...dm(ADMIN)).ok, true);
});

test('admin replies do not use up the hourly allowance of other users', () => {
  const { gate } = setup({ maxRepliesPerHour: 2 });
  for (let i = 0; i < 6; i += 1) assert.equal(gate.check(...mention(ADMIN, 'admin-' + i)).ok, true);
  assert.equal(gate.check(...mention('friend-a')).ok, true);
  assert.equal(gate.check(...mention('friend-b')).ok, true);
  assert.equal(gate.check(...mention('friend-c')).ok, false);
});

test('daily limits: admin replies are counted separately and are never refused', () => {
  const { gate, ledger } = setup({ maxDailyMentionReplies: 2, maxDailyDmReplies: 1, maxRepliesPerHour: 200 });
  for (let i = 0; i < 4; i += 1) {
    assert.equal(gate.check(...mention(ADMIN, 'a' + i)).ok, true);
    ledger.record('mention', { userId: ADMIN, transport: 'bot', channelId: 'room' });
  }
  ledger.record('dm', { userId: ADMIN, transport: 'bot', channelId: 'dm' });
  assert.deepEqual(
    { mention: ledger.getDailyStats().mentionReplies, dm: ledger.getDailyStats().dmReplies, admin: ledger.getDailyStats().adminReplies },
    { mention: 0, dm: 0, admin: 5 },
  );
  // 其他人：兩次 @ 之後被每日上限擋下；管理者照常。
  for (const friend of ['friend-a', 'friend-b']) {
    assert.equal(gate.check(...mention(friend)).ok, true);
    ledger.record('mention', { userId: friend, transport: 'bot', channelId: 'room' });
  }
  assert.match(gate.check(...mention('friend-c')).reason, /已達今日.*上限 \(2\)/);
  assert.equal(gate.check(...mention(ADMIN, 'later')).ok, true);
  ledger.record('dm', { userId: 'friend-a', transport: 'bot', channelId: 'dm' });
  assert.match(gate.check(...dm('friend-b')).reason, /已達今日.*上限 \(1\)/);
  assert.equal(gate.check(...dm(ADMIN)).ok, true);
  assert.equal(ledger.getDailyStats().mentionReplies, 2);
});

test('without an admin configured nobody is exempt, and chime-ins keep their own limits', () => {
  const { gate, ledger } = setup({ adminUserId: '', maxDailyMentionReplies: 1 });
  ledger.record('mention', { userId: ADMIN, transport: 'bot', channelId: 'room' });
  assert.equal(ledger.getDailyStats().mentionReplies, 1);
  assert.equal(gate.check(...mention(ADMIN)).ok, false);
  const withAdmin = setup({ maxDailyCoChats: 1, adminGroup_coChatEnabled: true, othersGroup_coChatEnabled: true });
  withAdmin.ledger.record('cochat', { userId: ADMIN });
  assert.equal(withAdmin.ledger.getDailyStats().coChats, 1, '閒聊插話照舊計數');
  const chime = withAdmin.gate.check({ id: 'c', channelId: 'room', guildId: 'guild', transport: 'bot', content: 'hi', author: { id: ADMIN } }, 'cochat', {
    selfId: 'bot-id',
    transportEnabled: true,
    transport: 'bot',
  });
  assert.equal(chime.ok, false, '管理者的訊息也不會讓閒聊插話超過上限');
});

test('the settings say these three limits are for other users and that the admin is exempt', () => {
  const fields = Object.fromEntries(describeSchema().fields.map((field) => [field.key, field]));
  for (const key of ['maxRepliesPerHour', 'maxDailyMentionReplies', 'maxDailyDmReplies']) {
    assert.match(fields[key].label, /^其他使用者：/, key);
    assert.match(fields[key].help, /管理者.*不受.*限制/, key);
    assert.match(fields[key].help, /不佔用額度/, key);
  }
});
