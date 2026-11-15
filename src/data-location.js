// 決定插件資料放在哪裡，並在第一次啟動時把舊位置（套件目錄內的 data/）複製過來。
//
// 資料放在套件目錄之外，是因為從插件市集或 npm 更新時，整個套件目錄會被換掉；
// 設定、加密的憑證、聊天歷史與會話綁定不能跟著消失。
//
// 位置的優先順序：
//   1. 環境變數 DSH_DISCORD_CYBERFRIEND_DATA（測試與隔離副本用；不做搬遷）
//   2. <DSH_HOME 或 ~/.dsh>/data/dsh-discord-cyberfriend
//
// 搬遷只複製、不刪除：舊的 data/ 原樣留著當備份，另外放一個說明檔。
// 複製先寫到暫存資料夾、核對後才改名成正式位置，中途失敗不會留下半套資料；
// 失敗時這次啟動繼續使用舊位置，下次啟動再試。
import { cp, mkdir, readdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

export const DATA_ENV = 'DSH_DISCORD_CYBERFRIEND_DATA';
export const DATA_FOLDER = 'dsh-discord-cyberfriend';
export const MIGRATION_MARKER = 'migrated-from.json';
export const LEGACY_NOTE = 'MOVED.txt';

const dshHome = (env, home) => env.DSH_HOME || join(home, '.dsh');

/** 套件之外的預設資料位置（不看環境變數覆寫）。 */
export function externalDataDir({ env = process.env, home = homedir() } = {}) {
  return join(dshHome(env, home), 'data', DATA_FOLDER);
}

/** 這次啟動預期使用的資料位置，以及是否由環境變數指定。 */
export function resolveDataDir({ env = process.env, home = homedir() } = {}) {
  const override = String(env[DATA_ENV] || '').trim();
  if (override) {
    if (!isAbsolute(override)) throw Error(DATA_ENV + ' 必須是絕對路徑');
    return { dir: resolve(override), override: true };
  }
  return { dir: externalDataDir({ env, home }), override: false };
}

/** 套件是否位於 node_modules 內（市集或 npm 安裝）；本機連結的來源目錄不算。 */
export function installedAsPackage(pluginRoot) {
  return resolve(pluginRoot).split(sep).includes('node_modules');
}

async function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else if (entry.isFile()) out.push({ path: rel, size: (await stat(join(dir, entry.name))).size });
  }
  return out;
}

const hasConfig = (dir) => existsSync(join(dir, 'config.json'));

/**
 * 準備資料目錄並回傳實際使用的位置。
 * 回傳 { dir, legacyDir, migrated, fallback, error }：
 *   migrated  這次啟動剛從舊位置複製過來
 *   fallback  搬遷失敗，這次仍使用舊位置
 */
export async function prepareDataDir({ pluginRoot, env = process.env, home = homedir(), now = Date.now } = {}) {
  const legacyDir = join(pluginRoot, 'data');
  const { dir, override } = resolveDataDir({ env, home });
  const result = { dir, legacyDir, migrated: false, fallback: false, error: '' };
  if (override || resolve(dir) === resolve(legacyDir) || hasConfig(dir) || !hasConfig(legacyDir)) {
    await mkdir(dir, { recursive: true });
    return result;
  }
  // 新位置還沒有設定、舊位置有：複製一次。
  const staging = dir + '.migrating-' + process.pid + '-' + now();
  try {
    const before = await listFiles(legacyDir);
    await mkdir(join(dir, '..'), { recursive: true });
    await cp(legacyDir, staging, { recursive: true, errorOnExist: true, force: false });
    const after = new Map((await listFiles(staging)).map((f) => [f.path, f.size]));
    // 執行中的插件不會同時寫入舊位置（搬遷在任何元件啟動之前），所以檔案清單與大小應完全一致。
    for (const file of before)
      if (after.get(file.path) !== file.size) throw Error('複製後的檔案不一致：' + file.path);
    await writeFile(
      join(staging, MIGRATION_MARKER),
      JSON.stringify({ from: legacyDir, at: new Date(now()).toISOString(), files: before.length }, null, 2),
    );
    // 新位置可能是先前建立的空資料夾；有內容就不覆蓋。
    if (existsSync(dir)) {
      if ((await readdir(dir)).length) throw Error('新的資料位置已有內容但沒有設定檔，未覆蓋');
      await rmdir(dir);
    }
    await rename(staging, dir);
    result.migrated = true;
    await writeFile(
      join(legacyDir, LEGACY_NOTE),
      [
        '這個資料夾的內容已複製到新的資料位置，插件現在使用新位置：',
        dir,
        '',
        '這裡的檔案是搬遷當時的備份，插件不再讀寫。確認新位置運作正常後可以自行刪除。',
        'This folder was copied to the location above and is no longer used. It is kept as a backup.',
        '',
      ].join('\n'),
    ).catch(() => {});
    return result;
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
    return { ...result, dir: legacyDir, fallback: true, error: String(error?.message || error) };
  }
}
