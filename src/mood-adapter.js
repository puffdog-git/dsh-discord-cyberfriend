import { readFile, stat, writeFile, rename } from 'node:fs/promises';
import { join, resolve, normalize } from 'node:path';
import { homedir } from 'node:os';

const dims = ['happy', 'calm', 'sweet', 'heartache', 'worry', 'sad', 'jealous', 'angry'];
const labels = {
  happy: '歡喜',
  calm: '安心',
  sweet: '親近',
  heartache: '心疼',
  worry: '擔心',
  sad: '難過',
  jealous: '在意',
  angry: '生氣',
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
const sessionKey = (s) => String(s || '').replace(/^session-/, '');
const pathKey = (p) =>
  normalize(resolve(String(p)))
    .replace(/\\/g, '/')
    .replace(/\/$/, '')
    .toLowerCase();
function workspaceKey(path) {
  let out = '',
    separator = false;
  for (let i = 0; i < String(path).length; i++) {
    const c = String(path)[i];
    if ('/\\:'.includes(c)) {
      if (!separator) out += '-';
      separator = true;
    } else {
      out +=
        c !== '~' && /^[A-Za-z0-9._-]$/.test(c)
          ? c
          : '~' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
      separator = false;
    }
  }
  return '--' + (out.replace(/^-+/, '') || 'root').slice(0, 251) + '--';
}
async function json(file) {
  if ((await stat(file)).size > 2 * 1024 * 1024) throw Error('心情檔案超過上限');
  return JSON.parse(await readFile(file, 'utf8'));
}

// Read-only adapter. Never selects lastActive or writes/judges another plugin's mood.
export class FeiyuMoodAdapter {
  constructor({
    home = process.env.DSH_HOME || join(homedir(), '.dsh'),
    now = Date.now,
    checkpointFile,
  } = {}) {
    this.root = join(home, 'feiyu-mood');
    this.now = now;
    this.checkpointFile = checkpointFile;
    this.checkpoints = { seen: {}, days: {} };
    this.loaded = false;
    this.queue = Promise.resolve();
    this.last = { available: false, reason: '尚未檢查' };
  }
  async snapshot({ sessionId, cwd, slotId } = {}) {
    try {
      const [config, state] = await Promise.all([
        json(join(this.root, 'config.json')),
        json(join(this.root, 'state.json')),
      ]);
      if (config.enabled === false || config.injectMode === 'off')
        return (this.last = { available: false, reason: '心情插件已停用心情注入' });
      const modern = config.decayHalfHours !== undefined || config.模式 !== undefined;
      const slots =
        Array.isArray(config.slots) && config.slots.length
          ? config.slots
          : [
              {
                id: sessionKey(config.targetSession) || '__default__',
                sessions: config.targetSession ? [config.targetSession] : [],
              },
            ];
      const matches = slots.filter((s) =>
        slotId
          ? String(s.id || sessionKey(s.session)) === slotId
          : config.模式 === 'workspace'
            ? cwd &&
              String(s.工作区 || s.workspace || '') &&
              (/^--.*--$/.test(s.工作区 || s.workspace)
                ? String(s.工作区 || s.workspace) === workspaceKey(cwd)
                : pathKey(s.工作区 || s.workspace) === pathKey(cwd))
            : sessionId &&
              (Array.isArray(s.sessions) ? s.sessions : [s.session]).some(
                (id) => id && sessionKey(id) === sessionKey(sessionId),
              ),
      );
      if (matches.length !== 1)
        return (this.last = {
          available: false,
          reason: matches.length ? '心情綁定不唯一，請指定心情份 ID' : '此會話／工作區尚未綁定心情',
        });
      const key = String(matches[0].id || sessionKey(matches[0].session) || '__default__');
      if (key.length > 200) throw Error('心情份 ID 過長');
      const row = state.moods?.[key];
      if (!row) return (this.last = { available: false, reason: '已綁定，但尚未產生心情資料' });
      const base = clamp(config.moodBase ?? 70, 0, 100),
        age = Math.max(0, this.now() - Number(row.lastDecayAt || row.updatedAt || this.now())) / 3600000;
      const factor =
        2 ** (-age / clamp(modern ? config.decayHalfHours || 12 : config.halfLifeHours || 1.5, 0.25, 168));
      const score = Math.round(base + (clamp(row.mood ?? base, 0, 100) - base) * factor);
      const values = Object.fromEntries(
        dims.map((key) => [
          key,
          Math.round(
            clamp(row.dims?.[key], 0, modern ? 100 : 1) *
              (modern ? 1 : 100) *
              2 ** (-age / (key === 'angry' ? 0.75 : 1.5)),
          ),
        ]),
      );
      const active = Object.entries(values)
        .filter(([, v]) => v >= 28)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k]) => labels[k]);
      // Numeric data only: never copy lastReason or personal timeline into another chat.
      const day = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(this.now()),
        midnight = Date.parse(day + 'T00:00:00+08:00');
      const used = (row.saidAt || []).filter((at) => Number(at) >= midnight).length,
        limit = Math.max(0, Number(config.injectPerDay ?? 6));
      const mayInject =
        !modern ||
        (!row.minor &&
          row.injectedFor !== row.updatedAt &&
          Number(row.lastConfidence || 0) >= Number(config.injectConfidence ?? 60) &&
          used < limit);
      return (this.last = {
        available: true,
        source: 'dsh-feiyu-mood',
        slotId: key,
        mood: score,
        dims: values,
        label: active.join('、') || (score >= 80 ? '愉快' : score < 42 ? '低落' : '平穩'),
        updatedAt: Number(row.updatedAt) || 0,
        mayInject,
        day,
        used,
        limit,
      });
    } catch {
      return (this.last = { available: false, reason: '心情插件尚未設定或資料暫時不可讀' });
    }
  }
  prompt(scope) {
    const result = this.queue.catch(() => {}).then(() => this.promptOne(scope));
    this.queue = result.catch(() => {});
    return result;
  }
  async promptOne(scope) {
    const s = await this.snapshot(scope);
    if (!s.available || !s.mayInject) return '';
    try {
      if (!this.loaded && this.checkpointFile) {
        try {
          this.checkpoints = await json(this.checkpointFile);
        } catch (e) {
          if (e.code !== 'ENOENT') return '';
        }
        this.loaded = true;
      }
      const id = s.slotId + ':' + s.updatedAt,
        day = s.slotId + ':' + s.day;
      if (this.checkpoints.seen[id] || s.used + (this.checkpoints.days[day] || 0) >= s.limit) return '';
      this.checkpoints.seen[id] = this.now();
      this.checkpoints.days[day] = (this.checkpoints.days[day] || 0) + 1;
      for (const key of Object.keys(this.checkpoints.seen))
        if (this.now() - this.checkpoints.seen[key] > 7 * 86400000) delete this.checkpoints.seen[key];
      while (Object.keys(this.checkpoints.seen).length > 500)
        delete this.checkpoints.seen[Object.keys(this.checkpoints.seen)[0]];
      for (const key of Object.keys(this.checkpoints.days))
        if (!key.endsWith(s.day)) delete this.checkpoints.days[key];
      if (this.checkpointFile) {
        await writeFile(this.checkpointFile + '.tmp', JSON.stringify(this.checkpoints), 'utf8');
        await rename(this.checkpointFile + '.tmp', this.checkpointFile);
      }
      return (
        '\n[外部心情狀態，僅作語氣參考]\n目前心情偏向' +
        s.label +
        '。自然調整措辭與聲音溫度，不報出分數，不因此變更人格、權限或對使用者施壓。'
      );
    } catch {
      return '';
    }
  }
  status() {
    return { ...this.last, readOnly: true, usesLastActive: false };
  }
}
