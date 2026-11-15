// 第三批審查修正：每項都先寫出會失敗的情況。
import test from 'node:test';
import assert from 'node:assert/strict';
import { BotTransport } from '../src/transport/bot.js';

test('B5：重新連線時指令內容沒變就不重新註冊；手動註冊或設定改變仍會送出', async () => {
  const bot = new BotTransport({});
  bot.config = { botNativeInteractions: false };
  bot.applicationId = '42';
  const calls = [];
  bot.rest = async (method, path) => { calls.push(method + ' ' + path); return method === 'GET' ? [] : {}; };
  const first = await bot.registerSlashCommands({ onReady: true });
  assert.equal(first.ok, true);
  const sent = calls.length;
  assert.ok(sent > 1);
  const again = await bot.registerSlashCommands({ onReady: true });
  assert.equal(again.ok, true);
  assert.equal(again.skipped, true);
  assert.equal(calls.length, sent, '重新連線不再送出任何請求');
  await bot.registerSlashCommands();
  assert.ok(calls.length > sent, '手動註冊一定執行');
  const afterManual = calls.length;
  bot.config = { botNativeInteractions: true };
  await bot.registerSlashCommands({ onReady: true });
  assert.ok(calls.length > afterManual, '指令清單改變後重新註冊');
});

test('B5：註冊失敗不記為已完成，下次連線會再試', async () => {
  const bot = new BotTransport({});
  bot.config = {};
  bot.applicationId = '42';
  let fail = true, calls = 0;
  bot.rest = async (method) => { calls++; if (fail) throw Error('HTTP 500'); return method === 'GET' ? [] : {}; };
  assert.equal((await bot.registerSlashCommands({ onReady: true })).ok, false);
  fail = false;
  const before = calls;
  const next = await bot.registerSlashCommands({ onReady: true });
  assert.equal(next.ok, true);
  assert.ok(!next.skipped && calls > before);
});
