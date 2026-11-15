import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { SECRET_KEYS } from './config.js';
const SCHEMA = 'dsh.discord.protected-config';
export function dpapi(bytes, decrypt = false) {
  return new Promise((resolve, reject) => {
    const action = decrypt ? 'Unprotect' : 'Protect';
    const script =
      "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[System.Security.Cryptography.ProtectedData]::" +
      action +
      '($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))';
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let output = '',
      finished = false;
    const end = (e, v) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      e ? reject(e) : resolve(v);
    };
    const timer = setTimeout(() => {
      p.kill();
      end(Error('憑證加密服務逾時'));
    }, 10000);
    p.stdout.on('data', (b) => {
      output += b;
      if (output.length > 2 * 1024 * 1024) {
        p.kill();
        end(Error('憑證加密回應過大'));
      }
    });
    p.stdin.on('error', () => {});
    p.on('error', () => end(Error('無法啟動憑證加密服務')));
    p.on('close', (code) =>
      end(code === 0 ? null : Error('無法存取此作業系統使用者的加密憑證'), Buffer.from(output, 'base64')),
    );
    p.stdin.end(Buffer.from(bytes).toString('base64'));
  });
}
export function createConfigVault({
  file,
  platform = process.platform,
  protect = (b) => dpapi(b),
  unprotect = (b) => dpapi(b, true),
  credentials,
} = {}) {
  let queue = Promise.resolve();
  async function read() {
    let v;
    try {
      v = JSON.parse(await readFile(file, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return {};
      throw Error('設定檔無法讀取；已停止載入，避免覆寫現有憑證');
    }
    if (v.schema !== SCHEMA) return v;
    if (v.version !== 1 || !v.config || !v.protected) throw Error('不支援的加密設定版本');
    let secrets;
    if (v.protected.scheme === 'dpapi-current-user')
      secrets = JSON.parse((await unprotect(Buffer.from(v.protected.data, 'base64'))).toString('utf8'));
    else if (v.protected.scheme === 'host-credentials') {
      if (!credentials?.resolve) throw Error('需要原宿主的安全憑證服務');
      secrets = {};
      for (const key of SECRET_KEYS) {
        const ref = v.protected.refs?.[key];
        if (ref) {
          const value = await credentials.resolve(ref);
          if (typeof value !== 'string') throw Error('安全憑證槽無法讀取');
          secrets[key] = value;
        }
      }
    } else throw Error('不支援的憑證保護方式');
    return {
      ...v.config,
      ...Object.fromEntries(SECRET_KEYS.map((k) => [k, typeof secrets[k] === 'string' ? secrets[k] : ''])),
    };
  }
  function save(config) {
    const snapshot = structuredClone(config);
    const task = queue
      .catch(() => {})
      .then(async () => {
        const safe = { ...snapshot },
          secrets = {};
        for (const key of SECRET_KEYS) {
          secrets[key] = typeof safe[key] === 'string' ? safe[key] : '';
          delete safe[key];
        }
        let protectedValue;
        if (platform === 'win32')
          protectedValue = {
            scheme: 'dpapi-current-user',
            data: Buffer.from(await protect(Buffer.from(JSON.stringify(secrets)))).toString('base64'),
          };
        else {
          if (!credentials?.set || !credentials?.resolve) throw Error('需要宿主安全憑證庫；不會退回明文保存');
          const refs = {};
          for (const key of SECRET_KEYS) {
            if (!secrets[key]) continue;
            const ref = 'DSH_DISCORD_' + key.toUpperCase() + '_' + randomUUID().replaceAll('-', '');
            await credentials.set(ref, secrets[key]);
            refs[key] = ref;
          }
          protectedValue = { scheme: 'host-credentials', refs };
        }
        await mkdir(dirname(file), { recursive: true });
        const tmp = file + '.' + randomUUID() + '.tmp';
        try {
          await writeFile(
            tmp,
            JSON.stringify({ schema: SCHEMA, version: 1, config: safe, protected: protectedValue }, null, 2) +
              '\n',
            { encoding: 'utf8', mode: 0o600, flag: 'wx' },
          );
          await rename(tmp, file);
        } finally {
          await unlink(tmp).catch(() => {});
        }
      });
    queue = task;
    return task;
  }
  return { read, save };
}
