// 由 client-src/ 產生 client.js。
//
//   node scripts/build-client.mjs          重新產生 client.js
//   node scripts/build-client.mjs --check  只檢查 client.js 是否與來源一致（不寫檔）
//
// client-src/ 內的檔案依檔名排序後串接在同一個 factory 閉包內，彼此直接共用
// 宣告（h、api、Icon、各面板元件…），因此不需要 import／export，也不需要打包工具。
// 樣式寫在 client-src/styles.css，建置時嵌入為字串。
// 請修改 client-src/，不要直接修改 client.js。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'client-src');
const target = path.join(root, 'client.js');

const HEAD = `/**
 * client.js — dsh-discord-cyberfriend 前端（建置產物）
 * 由 scripts/build-client.mjs 從 client-src/ 產生；請修改 client-src/ 後重新建置。
 */
window.__ModuleLoader__.load({
  id: 'dsh-discord-cyberfriend',
  factory: (require) => {
`;
const TAIL = `
    return { name: 'dsh-discord-cyberfriend', inject: ['slots'], apply, DiscordHubPanel };
  },
});
`;

const files = fs.readdirSync(srcDir).filter((name) => name.endsWith('.js')).sort();
const cssPath = path.join(srcDir, 'styles.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : null;

let body = '';
if (css !== null) body += `// ---- styles.css\nconst CSS = ${JSON.stringify(css)};\n`;
for (const name of files) {
  body += `// ---- ${name}\n${fs.readFileSync(path.join(srcDir, name), 'utf8').trimEnd()}\n`;
}
const output = HEAD + body + TAIL;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== output) {
    console.error('client.js 與 client-src/ 不一致；請執行 node scripts/build-client.mjs');
    process.exit(1);
  }
  console.log('client.js 與 client-src/ 一致');
} else {
  fs.writeFileSync(target, output);
  console.log(`client.js 已產生（${files.length} 個來源檔，${output.length} 字元）`);
}
