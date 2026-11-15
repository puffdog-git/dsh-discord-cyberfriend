// Explicitly invoked read-only live test. Reads only this plugin's config, never another account store.
import { writeFile, mkdir } from 'node:fs/promises';
import { PySelfTransport } from '../src/transport/pyself.js';
import { sanitizeConfig } from '../src/config.js';
import { createConfigVault } from '../src/config-vault.js';
import { checkDiscordToken } from '../src/transport/tokenCheck.js';
import { resolveDataDir } from '../src/data-location.js';
import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 與插件相同的資料位置：新位置有設定就用新位置，否則用套件目錄內的舊位置。
const external = resolveDataDir().dir, legacy = fileURLToPath(new URL('../data/', import.meta.url));
const data = pathToFileURL((existsSync(join(external, 'config.json')) ? external : legacy) + sep);
let config;
try { config = sanitizeConfig(await createConfigVault({ file: new URL('config.json', data) }).read()); }
catch { console.error('請先在 Discord 賽博群友的設定儲存 User Token；此腳本不會讀取原插件憑證。'); process.exit(2); }
if (!config.userToken) { console.error('此測試插件尚未設定 User Token。'); process.exit(2); }
const report = { checkedAt: new Date().toISOString(), library: 'discord.py-self==2.1.0', observations: [], result: 'not_started' };
const started = Date.now();
const record = (event, detail = {}) => { const row = { elapsedMs: Date.now() - started, event, ...detail }; report.observations.push(row); console.log(JSON.stringify(row)); };
const transport = new PySelfTransport();
let stopping = false;
process.once('SIGINT', () => { stopping = true; });
try {
  const preflight = await checkDiscordToken(config.userToken, { kind: 'user' });
  record('preflight', { valid: preflight.valid, status: preflight.status });
  if (preflight.valid !== true) { report.result = 'preflight_not_valid'; }
  else {
    const result = await transport.connect({ ...config, userAutoReply: false, userReceiveOnly: true });
    if (!result.ok) { report.result = 'startup_failed'; record('startup_failed', { error: result.error }); }
    else {
      let readyAt = 0, state;
      while (!stopping && Date.now() - started < 115000) {
        const status = transport.getStatus();
        if (status.state !== state) { state = status.state; record('state', { state, libraryVersion: status.libraryVersion, lastError: status.lastError, gatewayHost: status.gatewayHost }); }
        if (status.ok && !readyAt) readyAt = Date.now();
        if (readyAt && !status.ok) { report.result = 'disconnected_after_ready'; break; }
        if (readyAt && Date.now() - readyAt >= 60000) { report.result = 'ready_for_60_seconds'; break; }
        if (status.state === 'error' || (status.state === 'disconnected' && !status.workerRunning)) { report.result = 'connection_failed'; break; }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (report.result === 'not_started') report.result = stopping ? 'cancelled' : 'timeout';
    }
    const postflight = await checkDiscordToken(config.userToken, { kind: 'user' });
    record('postflight', { valid: postflight.valid, status: postflight.status });
  }
} finally {
  await transport.disconnect();
  report.limitation = 'Read-only connection test; no messages, reactions, typing, presence changes or LLM calls.';
  await mkdir(data, { recursive: true });
  await writeFile(new URL('connection-verification.json', data), JSON.stringify(report, null, 2) + '\n');
}
console.log(`Result: ${report.result}`);
if (report.result !== 'ready_for_60_seconds') process.exitCode = 1;
