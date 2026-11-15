/**
 * data/smoke.mjs — 不啟動 DSH 也能驗證插件本體是否可載入、apply 是否會爆。
 * 用假的 ctx 模擬 webServer / tools / effect，跑一輪 apply + dispose。
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// 測試資料留在這份副本的 data/，不碰使用者的正式資料目錄。
process.env.DSH_DISCORD_CYBERFRIEND_DATA ||= resolve(root, 'data');
const target = pathToFileURL(resolve(root, 'src/index.js')).href;

const registered = [];
const tools = [];
const disposers = [];

const ctx = {
  get(key) {
    if (key === 'tools') {
      return {
        register(definition) {
          tools.push(definition.name);
          return () => {};
        },
      };
    }
    if (key === 'llm') {
      return {
        listProviders: () => [{ provider: 'deepseek-account', displayName: 'DeepSeek' }],
        prepareCall: () => {
          throw new Error('smoke: 不呼叫模型');
        },
      };
    }
    if (key === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }) };
    return undefined;
  },
  webServer: {
    register(route) {
      registered.push(route.path);
      return () => {};
    },
  },
  effect(fn) {
    disposers.push(fn());
  },
};

const module = await import(target);
console.log('exports:', Object.keys(module).join(', '));
console.log('name:', module.name, '| inject:', JSON.stringify(module.inject));
console.log('Config:', module.Config ? '有 (schemastery 可用)' : '無 (退回純 JS 設定)');

await module.apply(ctx, { enabled: true, userEnabled: false, botEnabled: false, logEnabled: true, logLevel: 'debug' });

console.log('routes:', registered);
console.log('tools 數量:', tools.length, tools.slice(0, 5).join(', '), '…');
const hub = globalThis.__DSH_DISCORD_PYSELF_LAB__;
console.log('globalThis 服務:', hub ? Object.keys(hub).join(', ') : '(無)');
console.log('status:', JSON.stringify(hub?.status(), null, 2));
console.log('今日統計:', JSON.stringify(hub?.logs(3), null, 2));

for (const dispose of disposers) {
  try {
    await dispose();
  } catch (error) {
    console.error('dispose 失敗:', error.message);
  }
}
console.log('smoke OK');
process.exit(0);
