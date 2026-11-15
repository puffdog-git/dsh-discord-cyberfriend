import { processModelOutput } from './persona.js';
import { redactSensitive } from './security.js';

// A bounded text inbox between model events and the single voice playback job.
export class SpeechTextQueue {
  constructor(signal) {
    this.rows = [];
    this.closed = false;
    this.signal = signal;
    this.abort = () => this.fail(Error('增量語音已取消'));
    signal?.addEventListener('abort', this.abort, { once: true });
    if (signal?.aborted) this.abort();
  }
  push(text) {
    if (this.closed) throw this.error || Error('文字串流已結束');
    if (this.rows.length >= 16) throw Error('增量語音等待段數超過上限');
    this.rows.push(text);
    this.wake?.();
  }
  end() {
    this.closed = true;
    this.wake?.();
    this.signal?.removeEventListener('abort', this.abort);
  }
  fail(error) {
    this.error = error;
    this.rows = [];
    this.end();
  }
  async *[Symbol.asyncIterator]() {
    try {
      while (true) {
        if (this.error) throw this.error;
        if (this.rows.length) {
          yield this.rows.shift();
          continue;
        }
        if (this.closed) return;
        await new Promise((r) => (this.wake = r));
        this.wake = null;
      }
    } finally {
      this.end();
    }
  }
}

// Only complete, cleaned sentences cross the boundary. Control tags, code and
// later rewrites stop this attempt; already audible output is never retried.
export class IncrementalReply {
  constructor({ config, begin, signal, maxChars = 1500, onReason = () => {} }) {
    Object.assign(this, { config, begin, signal, maxChars, onReason });
    this.raw = '';
    this.sent = '';
    this.offset = 0;
    this.disabled = false;
  }
  push(delta) {
    if (this.disabled || this.signal?.aborted) return;
    this.raw += String(delta || '');
    if (this.raw.length > 6000) return this.cancel('增量回覆超過文字上限');
    this.flush(false);
  }
  flush(final) {
    if (this.disabled) return;
    const rest = this.raw.slice(this.offset),
      match = final ? rest.length : [...rest.matchAll(/[。！？!?\n]|\.(?=\s)/g)].at(-1)?.index + 1;
    if (!match) return;
    const end = this.offset + match,
      prefix = this.raw.slice(0, end);
    if (/[\[\]<>`]|https?:\/\//i.test(prefix)) return this.cancel('控制標記、連結或程式碼改用完整回覆');
    // Do not release a prefix that is only the beginning of a protected value.
    const secrets = [
      this.config.userToken,
      this.config.botToken,
      this.config.customLlmApiKey,
      this.config.gifApiKey,
      ...String(this.config.groupProtectedData || '').split('\n'),
    ].filter((s) => typeof s === 'string' && s.length >= 2);
    if (
      !final &&
      secrets.some((secret) => {
        for (let n = 1; n < secret.length; n++) if (prefix.endsWith(secret.slice(0, n))) return true;
        return false;
      })
    )
      return;
    const clean = redactSensitive(
      processModelOutput(prefix, this.config, { maxChars: this.maxChars }).text,
      this.config,
      { privateData: true },
    ).text;
    if (clean.length > this.maxChars || !clean.startsWith(this.sent))
      return this.cancel('輸出被改寫，停止增量語音');
    const next = clean.slice(this.sent.length).trim();
    this.offset = end;
    if (!next) return;
    try {
      this.handle ||= this.begin();
      if (!this.handle) {
        this.disabled = true;
        return;
      }
      this.handle.push(next);
      this.sent = clean;
    } catch {
      this.cancel('增量語音未能繼續；不重播已開始的回覆');
    }
  }
  finish(finalText) {
    if (this.disabled) return;
    if (this.raw && this.raw.trim() && this.offset < this.raw.length) this.flush(true);
    if (this.disabled) return;
    if (this.handle && String(finalText).trim() !== this.sent.trim())
      return this.cancel('最終正文與增量語音不同，停止剩餘語音');
    this.handle?.end();
  }
  cancel(reason) {
    this.disabled = true;
    this.reason = reason;
    this.handle?.cancel(reason);
    this.onReason(reason);
  }
  get claimed() {
    return !!this.handle;
  }
}
