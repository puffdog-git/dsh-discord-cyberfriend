import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CoalescedWriter } from './util.js';
const meters = new WeakMap();
export const registerTokenBudget = (ctx, budget) => {
  meters.set(ctx, budget);
  return () => meters.delete(ctx);
};
export const tokenBudgetFor = (ctx) => ctx && meters.get(ctx);
export const estimateTokens = (text) =>
  Math.max(1, Math.ceil(Buffer.byteLength(String(text || ''), 'utf8') / 3));
export function normalizeUsage(value) {
  if (!value || typeof value !== 'object') return null;
  const input = value.inputTokens ?? value.input_tokens ?? value.prompt_tokens,
    output = value.outputTokens ?? value.output_tokens ?? value.completion_tokens,
    total = value.totalTokens ?? value.total_tokens;
  if (!Number.isFinite(total) && (!Number.isFinite(input) || !Number.isFinite(output))) return null;
  return {
    inputTokens: Number.isFinite(input) ? Math.max(0, input) : 0,
    outputTokens: Number.isFinite(output) ? Math.max(0, output) : 0,
    totalTokens: Math.max(
      0,
      Number.isFinite(total) ? total : 0,
      (Number.isFinite(input) ? Math.max(0, input) : 0) + (Number.isFinite(output) ? Math.max(0, output) : 0),
    ),
    source: 'reported',
  };
}
export function eventUsage(events) {
  const turns = events
    .filter((e) => e.type === 'turn/end')
    .map((e) => normalizeUsage(e.data?.usage))
    .filter(Boolean);
  const rows = turns.length
    ? turns
    : events
        .filter((e) => e.type === 'assistant/message')
        .map((e) => normalizeUsage(e.data?.usage || e.data?.message?.usage || e.data?.metrics?.usage))
        .filter(Boolean);
  return rows.length
    ? {
        inputTokens: rows.reduce((n, r) => n + r.inputTokens, 0),
        outputTokens: rows.reduce((n, r) => n + r.outputTokens, 0),
        totalTokens: rows.reduce((n, r) => n + r.totalTokens, 0),
        source: 'reported',
      }
    : null;
}
/**
 * 會話事件的增量索引：位元組數（等同 JSON.stringify(全部事件) 的長度）與已見的使用者訊息來源 ID。
 * 每次只讀「上次之後新增」的事件；序號倒退（會話被重置）、沒有序號、每 20 次或超過五分鐘時完整重算，
 * 避免會話被宿主壓縮後長期高估。
 */
const sessionIndexes = new WeakMap();
export function sessionEventIndex(session) {
  const seq = session?.seq,
    numbered = typeof seq === 'number',
    now = Date.now();
  let row = sessionIndexes.get(session),
    events;
  if (!row || !numbered || seq < row.seq || row.uses >= 20 || now - row.at > 300000) {
    row = { seq: 0, sum: 0, count: 0, ids: new Set(), hasSystemMessage: false, uses: 0, at: now, bytes: 2 };
    events = session?.snapshotEvents?.() || [];
  } else events = seq > row.seq ? session.snapshotEvents(row.seq) || [] : [];
  for (const event of events) {
    let text = 'null';
    try {
      text = JSON.stringify(event) ?? 'null';
    } catch {}
    row.sum += Buffer.byteLength(text, 'utf8');
    row.count++;
    if (event?.type === 'user/message' && event.data?.id) row.ids.add(event.data.id);
    if (event?.type === 'system/message') row.hasSystemMessage = true;
    if (!row.firstMessageType && ['user/message', 'system/message', 'assistant/message'].includes(event?.type))
      row.firstMessageType = event.type;
  }
  row.seq = numbered ? seq : 0;
  row.uses++;
  row.bytes = 2 + row.sum + Math.max(0, row.count - 1);
  if (session && typeof session === 'object') sessionIndexes.set(session, row);
  return row;
}
export class TokenBudget {
  constructor({ file, getConfig, now = () => Date.now() }) {
    Object.assign(this, { file, getConfig, now });
    this.data = {
      version: 1,
      startedAt: new Date(this.now()).toISOString(),
      days: {},
      months: {},
      calls: [],
      pending: {},
    };
    this.queue = Promise.resolve();
  }
  periods() {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(this.now()));
    return { day: date, month: date.slice(0, 7) };
  }
  async init() {
    try {
      this.data = JSON.parse(await readFile(this.file, 'utf8'));
      this.data.startedAt ||= new Date(this.now()).toISOString();
      for (const r of Object.values(this.data.pending || {}))
        this.charge({
          ...r,
          inputTokens: r.reserved,
          outputTokens: 0,
          totalTokens: r.reserved,
          source: 'estimated',
          status: 'interrupted',
        });
      this.data.pending = {};
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  status() {
    const { day, month } = this.periods(),
      c = this.getConfig(),
      pending = Object.values(this.data.pending);
    return {
      day,
      month,
      startedAt: this.data.startedAt,
      timeZone: 'Asia/Taipei',
      today: this.data.days[day] || { totalTokens: 0, reportedTokens: 0, estimatedTokens: 0, calls: 0 },
      thisMonth: this.data.months[month] || {
        totalTokens: 0,
        reportedTokens: 0,
        estimatedTokens: 0,
        calls: 0,
      },
      reserved: pending.reduce((n, r) => n + r.reserved, 0),
      dailyLimit: c.tokenDailyLimit || 0,
      monthlyLimit: c.tokenMonthlyLimit || 0,
      mode: c.tokenBudgetMode || 'warn',
      enabled: !!c.tokenBudgetEnabled,
      calls: this.data.calls.slice(-60).reverse(),
      note: '涵蓋可觀測的插件模型呼叫。未回報 usage、失敗或中斷以估算列帳；外部插件內部二次呼叫可能未完整回報，非供應商帳單。',
    };
  }
  /* 連續的存檔合併成一次寫入（見 util.js CoalescedWriter）；等待者仍在自己呼叫之後才開始的寫入完成後返回。 */
  async save() {
    this.writer ||= new CoalescedWriter(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file + '.tmp', JSON.stringify(this.data) + '\n');
      await rename(this.file + '.tmp', this.file);
    });
    return (this.queue = this.writer.save());
  }
  charge(row) {
    for (const [bucket, key] of [
      [this.data.days, row.day],
      [this.data.months, row.month],
    ]) {
      const v = (bucket[key] ||= { totalTokens: 0, reportedTokens: 0, estimatedTokens: 0, calls: 0 });
      v.totalTokens += row.totalTokens;
      v[row.source === 'reported' ? 'reportedTokens' : 'estimatedTokens'] += row.totalTokens;
      v.calls++;
      if (row.scope) {
        v.scopes ||= {};
        const key =
          !['__proto__', 'constructor', 'prototype'].includes(row.scope) &&
          (Object.hasOwn(v.scopes, row.scope) || Object.keys(v.scopes).length < 200)
            ? row.scope
            : 'other';
        const scoped = (v.scopes[key] ||= { totalTokens: 0, translationTokens: 0, calls: 0 });
        scoped.totalTokens += row.totalTokens;
        scoped.calls++;
        if (row.category === 'speech-translation') scoped.translationTokens += row.totalTokens;
      }
    }
    this.data.calls.push(row);
    this.data.calls = this.data.calls.slice(-2000);
    const days = Object.keys(this.data.days).sort();
    for (const key of days.slice(0, Math.max(0, days.length - 100))) delete this.data.days[key];
  }
  async guardNative(id, request) {
    const row = this.data.pending[id];
    if (!row) return;
    let text = '';
    try {
      text = JSON.stringify(request.messages || request.prompt || request);
    } catch {}
    const input = Math.max(estimateTokens(text), row.inputBase || 0),
      amount = input + Math.max(64, request.maxTokens || 1600),
      next = row.steps ? row.reserved + amount : amount,
      c = this.getConfig(),
      other = Object.values(this.data.pending).filter((r) => r.id !== id),
      daily =
        (this.data.days[row.day]?.totalTokens || 0) +
        other.filter((r) => r.day === row.day).reduce((n, r) => n + r.reserved, 0),
      monthly =
        (this.data.months[row.month]?.totalTokens || 0) +
        other.filter((r) => r.month === row.month).reduce((n, r) => n + r.reserved, 0);
    if (
      c.tokenBudgetEnabled &&
      c.tokenBudgetMode === 'block' &&
      ((c.tokenDailyLimit > 0 && daily + next > c.tokenDailyLimit) ||
        (c.tokenMonthlyLimit > 0 && monthly + next > c.tokenMonthlyLimit))
    )
      throw Object.assign(Error('本插件 Token 預算不足，已停止後續模型請求'), { code: 'TOKEN_BUDGET' });
    row.overBudget =
      row.overBudget ||
      (c.tokenDailyLimit > 0 && daily + next > c.tokenDailyLimit) ||
      (c.tokenMonthlyLimit > 0 && monthly + next > c.tokenMonthlyLimit);
    row.reserved = next;
    row.estimatedInput = (row.steps ? row.estimatedInput : 0) + input;
    row.steps = (row.steps || 0) + 1;
    await this.save();
  }
  async run(category, options, work) {
    const c = this.getConfig(),
      periods = this.periods(),
      input =
        estimateTokens((options.system || '') + '\n' + (options.user || '')) +
        Math.ceil(Math.max(0, Number(options.extraInputBytes) || 0) / 3) +
        (options.images?.length || 0) * 2048,
      reserved = input + Math.max(64, options.maxTokens || 1600),
      id = randomUUID();
    const pending = Object.values(this.data.pending),
      daily =
        (this.data.days[periods.day]?.totalTokens || 0) +
        pending.filter((r) => r.day === periods.day).reduce((n, r) => n + r.reserved, 0),
      monthly =
        (this.data.months[periods.month]?.totalTokens || 0) +
        pending.filter((r) => r.month === periods.month).reduce((n, r) => n + r.reserved, 0);
    const over =
      (c.tokenDailyLimit > 0 && daily + reserved > c.tokenDailyLimit) ||
      (c.tokenMonthlyLimit > 0 && monthly + reserved > c.tokenMonthlyLimit);
    if (c.tokenBudgetEnabled && c.tokenBudgetMode === 'block' && over)
      return {
        ok: false,
        code: 'TOKEN_BUDGET',
        error: '本插件模型 Token 預算不足（包含進行中呼叫的預留），請調整預算或等待額度重置',
      };
    const record = {
      id,
      ...periods,
      ...(options.usageScope ? { scope: String(options.usageScope).slice(0, 200) } : {}),
      at: new Date(this.now()).toISOString(),
      category,
      reserved,
      inputBase: input,
      overBudget: over,
    };
    this.data.pending[id] = record;
    await this.save();
    let result;
    try {
      result = await work(record);
      return result;
    } finally {
      const usage = (['NO_LLM', 'MISSING_CREDENTIAL', 'TOKEN_BUDGET'].includes(result?.code) && !record.steps
        ? { inputTokens: 0, outputTokens: 0, totalTokens: 0, source: 'not-started' }
        : null) ||
        normalizeUsage(result?.usage) ||
        (options.opaque || record.steps
          ? {
              inputTokens: record.steps ? record.estimatedInput : reserved,
              outputTokens: record.steps ? record.reserved - record.estimatedInput : 0,
              totalTokens: record.reserved,
              source: 'estimated',
            }
          : null) || {
          inputTokens: input,
          outputTokens: estimateTokens(result?.text || ''),
          totalTokens: input + estimateTokens(result?.text || ''),
          source: 'estimated',
        };
      delete this.data.pending[id];
      this.charge({
        ...record,
        ...usage,
        scope: result?.sessionId || record.scope,
        status: result?.ok ? 'ok' : 'failed',
        provider: result?.provider || null,
        model: result?.model || null,
      });
      await this.save();
    }
  }
  async flush() {
    await this.queue;
  }
}
