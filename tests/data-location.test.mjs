import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DATA_ENV,
  LEGACY_NOTE,
  MIGRATION_MARKER,
  externalDataDir,
  installedAsPackage,
  prepareDataDir,
  resolveDataDir,
} from '../src/data-location.js';
import { pythonExecutable } from '../src/transport/pyself.js';

async function sandbox(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cyberfriend-data-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pluginRoot = path.join(root, 'plugin'),
    home = path.join(root, 'home');
  await fs.mkdir(pluginRoot, { recursive: true });
  return { root, pluginRoot, home, legacy: path.join(pluginRoot, 'data'), env: {} };
}
async function seedLegacy(legacy) {
  await fs.mkdir(path.join(legacy, 'logs'), { recursive: true });
  await fs.writeFile(path.join(legacy, 'config.json'), '{"dryRun":true}');
  await fs.writeFile(path.join(legacy, 'history.json'), '{"channels":{}}');
  await fs.writeFile(path.join(legacy, 'logs', 'a.jsonl'), 'line\n');
}

test('default location is outside the package and follows DSH_HOME', () => {
  const home = path.join(os.tmpdir(), 'h');
  assert.equal(externalDataDir({ env: {}, home }), path.join(home, '.dsh', 'data', 'dsh-discord-cyberfriend'));
  const custom = path.join(os.tmpdir(), 'custom-home');
  assert.equal(
    externalDataDir({ env: { DSH_HOME: custom }, home }),
    path.join(custom, 'data', 'dsh-discord-cyberfriend'),
  );
  assert.throws(() => resolveDataDir({ env: { [DATA_ENV]: 'relative/path' }, home }), /絕對路徑/);
});

test('fresh install creates the external folder and leaves the package untouched', async (t) => {
  const s = await sandbox(t);
  const r = await prepareDataDir({ pluginRoot: s.pluginRoot, env: s.env, home: s.home });
  assert.equal(r.dir, externalDataDir({ env: s.env, home: s.home }));
  assert.equal(r.migrated, false);
  assert.equal(r.fallback, false);
  assert.ok(existsSync(r.dir));
  assert.ok(!existsSync(s.legacy));
});

test('legacy data is copied once, originals are kept and later starts use the new folder', async (t) => {
  const s = await sandbox(t);
  await seedLegacy(s.legacy);
  const r = await prepareDataDir({ pluginRoot: s.pluginRoot, env: s.env, home: s.home });
  assert.equal(r.migrated, true);
  assert.equal(await fs.readFile(path.join(r.dir, 'config.json'), 'utf8'), '{"dryRun":true}');
  assert.equal(await fs.readFile(path.join(r.dir, 'logs', 'a.jsonl'), 'utf8'), 'line\n');
  assert.equal(JSON.parse(await fs.readFile(path.join(r.dir, MIGRATION_MARKER), 'utf8')).files, 3);
  // 舊資料原封不動，只多一個說明檔。
  assert.equal(await fs.readFile(path.join(s.legacy, 'config.json'), 'utf8'), '{"dryRun":true}');
  assert.ok(existsSync(path.join(s.legacy, LEGACY_NOTE)));
  // 新位置之後的變更不會被舊資料蓋回去。
  await fs.writeFile(path.join(r.dir, 'config.json'), '{"dryRun":false}');
  const again = await prepareDataDir({ pluginRoot: s.pluginRoot, env: s.env, home: s.home });
  assert.equal(again.migrated, false);
  assert.equal(again.dir, r.dir);
  assert.equal(await fs.readFile(path.join(r.dir, 'config.json'), 'utf8'), '{"dryRun":false}');
  assert.deepEqual(
    (await fs.readdir(path.dirname(r.dir))).filter((n) => n.includes('migrating')),
    [],
  );
});

test('an existing non-empty target without config is never overwritten; this start keeps the legacy folder', async (t) => {
  const s = await sandbox(t);
  await seedLegacy(s.legacy);
  const target = externalDataDir({ env: s.env, home: s.home });
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'something-else.txt'), 'keep me');
  const r = await prepareDataDir({ pluginRoot: s.pluginRoot, env: s.env, home: s.home });
  assert.equal(r.fallback, true);
  assert.equal(r.dir, s.legacy);
  assert.match(r.error, /未覆蓋/);
  assert.equal(await fs.readFile(path.join(target, 'something-else.txt'), 'utf8'), 'keep me');
  assert.ok(!existsSync(path.join(target, 'config.json')));
  assert.deepEqual(
    (await fs.readdir(path.dirname(target))).filter((n) => n.includes('migrating')),
    [],
  );
});

test('an empty pre-created target is replaced by the migrated data', async (t) => {
  const s = await sandbox(t);
  await seedLegacy(s.legacy);
  await fs.mkdir(externalDataDir({ env: s.env, home: s.home }), { recursive: true });
  const r = await prepareDataDir({ pluginRoot: s.pluginRoot, env: s.env, home: s.home });
  assert.equal(r.migrated, true);
  assert.ok(existsSync(path.join(r.dir, 'history.json')));
});

test('environment override is used as-is and never migrates', async (t) => {
  const s = await sandbox(t);
  await seedLegacy(s.legacy);
  const override = path.join(s.root, 'isolated');
  const r = await prepareDataDir({ pluginRoot: s.pluginRoot, env: { [DATA_ENV]: override }, home: s.home });
  assert.equal(r.dir, override);
  assert.equal(r.migrated, false);
  assert.deepEqual(await fs.readdir(override), []);
  assert.ok(!existsSync(path.join(s.legacy, LEGACY_NOTE)));
});

test('package installs are detected by a node_modules path segment only', () => {
  assert.equal(installedAsPackage(path.join('C:', 'p', 'node_modules', '.pnpm', 'x', 'node_modules', 'dsh-discord-cyberfriend')), true);
  assert.equal(installedAsPackage(path.join('C:', 'plugins', 'dsh-discord-cyberfriend')), false);
  assert.equal(installedAsPackage(path.join('C:', 'my_node_modules_backup', 'dsh-discord-cyberfriend')), false);
});

test('explicit Python path still wins and a missing one is reported', () => {
  assert.equal(pythonExecutable({ userPythonExecutable: process.execPath }), process.execPath);
  assert.throws(() => pythonExecutable({ userPythonExecutable: path.join(os.tmpdir(), 'no-such-python.exe') }), /找不到 Python/);
});
