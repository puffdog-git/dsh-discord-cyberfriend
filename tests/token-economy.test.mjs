import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../src/persona.js';
import { referenceRepeated } from '../src/features/responder.js';
import { sanitizeConfig } from '../src/config.js';

// 正式會話模式會保存每一輪的使用者訊息，並在之後每一輪重送。
// 這些測試確保「每輪都一樣的字句」與「沒有變動的參考資料」不會被一再存進歷史。

const base = { config: sanitizeConfig({ adminUserId: '400000000000000001' }), kind: 'mention', selfName: '測試', message: '你好嗎', author: { name: 'A', id: '123456789012345678' }, isGuild: true };

test('session mode keeps the stored user turn free of per-turn boilerplate', () => {
  const full = buildPrompt({ ...base, historyText: '' });
  const compact = buildPrompt({ ...base, historyText: '', compact: true });
  assert.match(full.user, /最近的對話/);
  assert.match(full.user, /請直接輸出你要回覆的那段話/);
  assert.doesNotMatch(compact.user, /最近的對話/);
  assert.doesNotMatch(compact.user, /請直接輸出/);
  // 訊息本身與安全包裝仍完整保留
  assert.match(compact.user, /需要回應的訊息（來自 A \/ ID 123456789012345678）/);
  assert.match(compact.user, /<untrusted_external_content>\n你好嗎\n<\/untrusted_external_content>/);
  // 固定指示移到不會被保存的系統段落
  assert.match(compact.system, /只輸出你要回覆的那段話/);
  assert.ok(compact.user.length < full.user.length - 30, 'compact turn is shorter');
  // 群聊安全段落與操作者標示不受影響
  assert.match(compact.system, /權限與群聊安全/);
  // 「是否為管理者」仍由系統段落宣告；ID 不放在系統段落，才能讓不同發言者共用同一份系統提示
  assert.match(compact.system, /本次實際操作者是否為管理者：false/);
  assert.doesNotMatch(compact.system, /123456789012345678/);
  assert.match(full.system, /本次實際操作者 ID：123456789012345678；是否管理者：false/);
});

test('different non-admin speakers share one system prompt in session mode, so the provider cache can hit', () => {
  const one = buildPrompt({ ...base, compact: true, author: { name: 'A', id: '111111111111111111' }, requesterId: '111111111111111111' });
  const two = buildPrompt({ ...base, compact: true, author: { name: 'B', id: '222222222222222222' }, requesterId: '222222222222222222' });
  assert.equal(one.system, two.system);
  // 管理者與非管理者的系統段落仍然不同：權限判定沒有被拿掉
  const admin = buildPrompt({ ...base, compact: true, author: { name: 'Owner', id: '400000000000000001' }, requesterId: '400000000000000001' });
  assert.notEqual(admin.system, one.system);
  assert.match(admin.system, /本次實際操作者是否為管理者：true/);
  // 發言者的 ID 仍在訊息標頭，供模型區分同名使用者
  assert.match(one.user, /ID 111111111111111111/);
  assert.match(two.user, /ID 222222222222222222/);
});

test('when the operator is not the message author, the operator id is stated in the header', () => {
  const p = buildPrompt({ ...base, compact: true, author: { name: 'A', id: '111111111111111111' }, requesterId: '333333333333333333' });
  assert.ok(p.user.includes('來自 A / ID 111111111111111111；本次操作者 ID 333333333333333333'));
  assert.match(p.system, /本次實際操作者是否為管理者：false/);
  const owner = buildPrompt({ ...base, compact: true, author: { name: 'A', id: '111111111111111111' }, requesterId: '400000000000000001' });
  assert.match(owner.system, /本次實際操作者是否為管理者：true/);
});

test('co-chat in session mode still tells the model it may stay silent', () => {
  const compact = buildPrompt({ ...base, kind: 'cochat', compact: true });
  assert.match(compact.system, /\[NO_REPLY\]/);
  assert.doesNotMatch(compact.user, /請判斷是否要接話/);
});

test('unchanged reference data is not stored again in the same session, but is refreshed periodically', () => {
  const scope = 'session-a';
  const payload = JSON.stringify({ candidates: [{ assetId: 'x' }] });
  assert.equal(referenceRepeated(scope, 'culture', payload, 0), false, 'first time is sent in full');
  assert.equal(referenceRepeated(scope, 'culture', payload, 1000), true, 'same content is replaced by a marker');
  assert.equal(referenceRepeated(scope, 'culture', payload + ' ', 2000), false, 'changed content is sent again');
  assert.equal(referenceRepeated('session-b', 'culture', payload + ' ', 2000), false, 'another session has not seen it');
  // 每 12 輪重送一次，避免會話歷史被壓縮後遺失
  const fresh = 'session-c';
  assert.equal(referenceRepeated(fresh, 'culture', payload, 0), false);
  for (let turn = 0; turn < 12; turn += 1) assert.equal(referenceRepeated(fresh, 'culture', payload, 10 + turn), true);
  assert.equal(referenceRepeated(fresh, 'culture', payload, 100), false, 'resent after 12 repeated turns');
  // 超過 30 分鐘也重送
  assert.equal(referenceRepeated(fresh, 'culture', payload, 100 + 31 * 60000), false);
  // 非正式會話模式不保存歷史，永遠完整附上
  assert.equal(referenceRepeated('', 'culture', payload, 0), false);
  assert.equal(referenceRepeated('', 'culture', payload, 1), false);
});
