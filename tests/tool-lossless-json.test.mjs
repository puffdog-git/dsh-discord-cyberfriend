import test from 'node:test';
import assert from 'node:assert/strict';
import { HubLogger } from '../src/logger.js';
import { losslessJson } from '../src/tools.js';

// 宿主的檢查：轉成 JSON 再轉回來必須與原值完全相同（undefined 鍵會不見，所以不相等）。
const isLossless = (value) => {
  try {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(value)), value);
    return true;
  } catch {
    return false;
  }
};

test('沒有細節的日誌不帶 data 鍵', () => {
  const logger = new HubLogger({ toFile: false });
  const entry = logger.info('login', '已登入');
  assert.equal('data' in entry, false);
  assert.ok(isLossless(logger.recent(10)));
});

test('細節裡值為 undefined 的鍵會被拿掉', () => {
  const logger = new HubLogger({ toFile: false });
  const entry = logger.info('reply', '已回覆', { channelId: '1', reason: undefined, nested: { a: undefined, b: 2 } });
  assert.deepEqual(entry.data, { channelId: '1', nested: { b: 2 } });
  assert.ok(isLossless(logger.recent(10)));
});

test('losslessJson 整理 undefined、NaN 與 BigInt', () => {
  const out = losslessJson({ ok: true, a: undefined, n: NaN, big: 5n, list: [1, undefined] });
  assert.deepEqual(out, { ok: true, n: null, big: '5', list: [1, null] });
  assert.ok(isLossless(out));
  assert.equal(losslessJson(undefined), null);
});
