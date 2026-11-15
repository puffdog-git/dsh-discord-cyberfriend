import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describeSchema, FIELDS, DEFAULTS, sanitizeConfig } from '../src/config.js';

const dirOf = (rel) => fileURLToPath(new URL(rel, import.meta.url));

async function codeFiles(dir, skip = () => false) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + entry.name;
    if (entry.isDirectory()) out.push(...(await codeFiles(path, skip)));
    else if (/\.(js|py)$/.test(path) && !skip(path)) out.push(path);
  }
  return out;
}
const readAll = async (files) => (await Promise.all(files.map((p) => readFile(p, 'utf8')))).join('\n');

// 只由介面使用、後端不需要讀取的設定。新增項目前請確認它真的沒有後端行為。
const UI_ONLY_KEYS = new Set(['statusRefreshSeconds']);

test('each visible setting is read by backend code; audience fields resolve to their shared base key', async () => {
  // 後端來源（不含欄位定義檔本身，也不含介面）。介面裡出現同名字串不算「有掛勾」。
  const backend = await readAll([
    ...(await codeFiles(dirOf('../src'), (p) => p.endsWith('/config.js'))),
    ...(await codeFiles(dirOf('../bridge'))),
  ]);
  const client = await readAll(await codeFiles(dirOf('../client-src')));
  const schema = describeSchema();
  assert.equal(new Set(schema.fields.map((f) => f.key)).size, schema.fields.length);

  const unhooked = [];
  for (const f of schema.fields) {
    const raw = FIELDS.find((x) => x.key === f.key);
    const key = raw.audienceBaseKey || f.key;
    const used = UI_ONLY_KEYS.has(key) ? client.includes(key) : new RegExp(`\\b${key}\\b`).test(backend);
    if (!used) unhooked.push(f.key);
    for (const c of f.enabledWhen) {
      assert.ok(schema.fields.some((x) => x.key === c.key), f.key + ' has missing gate ' + c.key);
      assert.ok(c.values.length && c.reason);
    }
  }
  assert.deepEqual(unhooked, [], 'settings shown in the UI but never read by the backend');

  for (const s of schema.sections) {
    const hasPanel = new RegExp(`section\\s*===\\s*'${s.id}'`).test(client);
    assert.ok(s.readOnly ? hasPanel : schema.fields.some((f) => f.section === s.id), s.id + ' is an empty settings page');
  }
});

test('all visible nonsecret settings survive the backend sanitizer with their valid defaults', () => {
  const sanitized = sanitizeConfig({ ...DEFAULTS });
  for (const f of describeSchema().fields) if (!f.secret) assert.deepEqual(sanitized[f.key], DEFAULTS[f.key], f.key);
});

test('client.js is built from client-src', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, [dirOf('../scripts/build-client.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
