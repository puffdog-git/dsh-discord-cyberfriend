/**
 * src/util.js — 共用小工具（零依賴）
 */

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** 在 [min,max] 秒之間取一個毫秒延遲。 */
export function jitterMs(minSeconds, maxSeconds) {
  const min = Math.max(0, Number(minSeconds) || 0);
  const max = Math.max(min, Number(maxSeconds) || min);
  return Math.round((min + Math.random() * (max - min)) * 1000);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function nowIso() {
  return new Date().toISOString();
}

export function truncate(text, max = 120) {
  const value = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

export function parseJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** 把 Markdown 標記清掉，讓一般 Discord 訊息看起來自然。 */
export function stripMarkdown(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '・')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 ($2)')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const AI_FLAVOR_PATTERNS = [
  /^(好的|當然|沒問題)[，,、:：]\s*/,
  /^作為(一個|一名)?\s*(AI|人工智能|語言模型|助理)[^。\n]{0,20}[，,。]\s*/i,
  /^(希望|希望這)(對|能對)(你|您)有(所)?幫助[。!！]?/,
  /(希望|希望這)(對|能對)(你|您)有(所)?幫助[。!！]?$/,
  /如果你(還)?有(任何)?(其他)?(問題|需要)[^。\n]{0,20}(隨時|歡迎)[^。\n]{0,10}[。!！]?/,
  /^(以下是|這是一份|下面是)[^。\n]{0,12}(：|:)/,
  /我(只)?是一個(AI|人工智能|語言模型)[^。\n]{0,20}[。]?/i,
];

/** 移除常見的 AI 腔與客服話術。 */
export function stripAiFlavor(text) {
  let out = String(text ?? '');
  for (const pattern of AI_FLAVOR_PATTERNS) out = out.replace(pattern, '');
  return out.replace(/^\s*[-–—]\s*$/gm, '').trim();
}

/** SHA-1 風格的短雜湊（僅用於去重與日誌 id，不是安全性用途）。 */
export function shortHash(text) {
  let hash = 0;
  const value = String(text ?? '');
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function uniqueBy(list, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** 簡單的併發限制器：同時最多 n 個工作。 */
export class Semaphore {
  constructor(limit = 1) {
    this.limit = Math.max(1, limit);
    this.active = 0;
    this.waking = 0;
    this.queue = [];
  }

  get pending() {
    return this.queue.length;
  }

  /** 調整上限後立即生效：調高時喚醒等待中的工作，調低時讓進行中的自然結束。 */
  setLimit(limit) {
    this.limit = Math.max(1, Number(limit) || 1);
    while (this.active + this.waking < this.limit && this.queue.length) {
      this.waking += 1;
      this.queue.shift()();
    }
  }

  async run(task) {
    if (this.active + this.waking >= this.limit) {
      await new Promise((resolve) => this.queue.push(resolve));
      this.waking -= 1;
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      if (this.active + this.waking < this.limit && this.queue.length) {
        this.waking += 1;
        this.queue.shift()();
      }
    }
  }
}

/** 每個 key 各自冷卻的節流器。 */
export class Cooldown {
  constructor(defaultMs = 0, maxKeys = 5000) {
    this.defaultMs = defaultMs;
    this.maxKeys = maxKeys;
    this.map = new Map();
  }

  get size() {
    return this.map.size;
  }

  /** 回傳 true 表示可以通過（並記錄時間）；false 表示還在冷卻。 */
  tryPass(key, ms = this.defaultMs) {
    const now = Date.now();
    const last = this.map.get(key) || 0;
    if (now - last < ms) return false;
    // 重新插入讓最近使用的排在最後；超過上限時淘汰最久沒通過的鍵（它們的冷卻早已結束或最接近結束）。
    this.map.delete(key);
    this.map.set(key, now);
    while (this.map.size > this.maxKeys) this.map.delete(this.map.keys().next().value);
    return true;
  }

  remaining(key, ms = this.defaultMs) {
    const last = this.map.get(key) || 0;
    return Math.max(0, ms - (Date.now() - last));
  }

  reset(key) {
    if (key === undefined) this.map.clear();
    else this.map.delete(key);
  }
}

/**
 * 合併存檔：已有寫入在進行時，後來的 save() 共用「下一次」寫入（寫入當下才取最新狀態）。
 * 呼叫者拿到的 Promise 在「呼叫之後才開始的寫入」完成後才解決，所以「先落地再執行」的保證不變；
 * 寫入失敗只讓等待那一次的人收到錯誤。
 */
export class CoalescedWriter {
  constructor(write) {
    this.write = write;
    this.active = null;
    this.queued = null;
  }

  start() {
    const task = Promise.resolve().then(() => this.write());
    this.active = task;
    const clear = () => {
      if (this.active === task) this.active = null;
    };
    task.then(clear, clear);
    return task;
  }

  save() {
    if (this.queued) return this.queued;
    if (!this.active) return this.start();
    const queued = this.active
      .catch(() => {})
      .then(() => {
        this.queued = null;
        return this.start();
      });
    this.queued = queued;
    return queued;
  }

  async flush() {
    while (this.queued || this.active) await (this.queued || this.active).catch(() => {});
  }
}

/** 固定時間窗的次數限制器（例如每小時 N 次）。 */
/** 依鍵各自計數的滑動視窗限制器；鍵數有上限，最久沒用的先淘汰。 */
export class KeyedRateWindow {
  constructor(limit, windowMs, maxKeys = 2000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
    this.hits = new Map();
  }

  get size() {
    return this.hits.size;
  }

  tryPass(key) {
    const id = String(key ?? ''),
      now = Date.now();
    const recent = (this.hits.get(id) || []).filter((time) => now - time < this.windowMs);
    this.hits.delete(id);
    if (recent.length >= this.limit) {
      this.hits.set(id, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(id, recent);
    while (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value);
    return true;
  }
}

export class RateWindow {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = [];
  }

  tryPass() {
    const now = Date.now();
    this.hits = this.hits.filter((time) => now - time < this.windowMs);
    if (this.hits.length >= this.limit) return false;
    this.hits.push(now);
    return true;
  }

  setLimit(limit) {
    this.limit = Math.max(1, Number(limit) || 1);
  }

  snapshot() {
    const now = Date.now();
    this.hits = this.hits.filter((time) => now - time < this.windowMs);
    return { used: this.hits.length, limit: this.limit, windowMs: this.windowMs };
  }
}

/** 把多行文字正規化，避免 LLM 吐出一堆空白。 */
export function tidyText(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
