import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AUDIENCE_FIELDS, sanitizeConfig } from './config.js';
const scopes = ['adminDm', 'adminGroup', 'othersDm', 'othersGroup'];
const allowed = new Set(
  AUDIENCE_FIELDS.map((f) => f.audienceBaseKey).filter((k) => k !== 'monitoredChannelIds'),
);
const persona = (k) => /Persona|pluginPersona|pluginStyle|antiAiFlavor/.test(k);
export const BUILTIN_PRESETS = [
  {
    id: 'builtin-companion',
    name: '自然陪聊',
    values: {
      coChatEnabled: true,
      coChatProbability: 15,
      coChatCooldownSeconds: 90,
      followupEnabled: true,
      followupSeconds: 180,
      contextMessages: 20,
    },
    builtin: true,
  },
  {
    id: 'builtin-quiet',
    name: '安靜閱讀',
    values: { coChatEnabled: false, followupEnabled: true, autoReactionEnabled: false, gifEnabled: false },
    builtin: true,
  },
  {
    id: 'builtin-work',
    name: '工作中・先審稿',
    values: { coChatEnabled: false, replyDeliveryMode: 'review', autoReactionEnabled: false },
    builtin: true,
  },
  {
    id: 'builtin-external',
    name: '交由外部人格管理',
    values: {
      pluginPersonaEnabled: false,
      pluginStyleEnabled: false,
      antiAiFlavorPromptEnabled: false,
      stripMarkdown: false,
    },
    builtin: true,
  },
];
const fail = (text) => Object.assign(Error(text), { status: 400 });
export class UserBehavior {
  constructor({ file, getConfig, setConfig }) {
    Object.assign(this, { file, getConfig, setConfig });
    this.data = { version: 1, presets: [], rules: [] };
    this.queue = Promise.resolve();
  }
  async init() {
    try {
      this.data = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  status() {
    return { presets: [...BUILTIN_PRESETS, ...this.data.presets], rules: this.data.rules };
  }
  async save() {
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(this.file + '.tmp', JSON.stringify(this.data, null, 2) + '\n');
        await rename(this.file + '.tmp', this.file);
      });
    return this.queue;
  }
  async capture({ name, profile, includePersona = false }) {
    if (typeof name !== 'string' || !name.trim() || name.length > 80 || !scopes.includes(profile))
      throw fail('請填寫名稱並選擇有效對象設定');
    const c = this.getConfig(),
      values = {};
    for (const f of AUDIENCE_FIELDS)
      if (
        f.section === profile &&
        allowed.has(f.audienceBaseKey) &&
        (includePersona || !persona(f.audienceBaseKey))
      )
        values[f.audienceBaseKey] = structuredClone(c[f.key]);
    if (this.data.presets.length >= 40) throw fail('最多保存 40 組自訂預設');
    const row = { id: randomUUID(), name: name.trim(), values, includesPersona: !!includePersona };
    this.data.presets.push(row);
    await this.save();
    return { ok: true, ...this.status() };
  }
  async removePreset(id) {
    if (id.startsWith('builtin-')) throw fail('內建預設不可刪除');
    this.data.presets = this.data.presets.filter((p) => p.id !== id);
    await this.save();
    return { ok: true, ...this.status() };
  }
  async applyPreset(id, profile) {
    const row = this.status().presets.find((p) => p.id === id);
    if (!row || !(scopes.includes(profile) || profile === 'all')) throw fail('請選擇預設與套用對象');
    const patch = {};
    for (const target of profile === 'all' ? scopes : [profile])
      for (const [key, value] of Object.entries(row.values))
        if (
          allowed.has(key) &&
          AUDIENCE_FIELDS.some((f) => f.section === target && f.audienceBaseKey === key)
        )
          patch[target + '_' + key] = value;
    const result = await this.setConfig(patch);
    if (!result.ok) throw fail(result.error);
    return { ok: true, changed: result.changed, ...this.status() };
  }
  async putRule(input) {
    if (
      !['user', 'channel'].includes(input.kind) ||
      !/^\d{15,22}$/.test(input.targetId || '') ||
      !['user', 'bot', 'both'].includes(input.transport) ||
      !['dm', 'group', 'both'].includes(input.scope)
    )
      throw fail('對話範圍或 ID 格式不正確');
    const values = {};
    for (const key of ['nickname', 'tone'])
      if (input[key] !== undefined) {
        if (typeof input[key] !== 'string' || input[key].length > (key === 'nickname' ? 80 : 800))
          throw fail('稱呼或偏好描述過長');
        if (input[key].trim()) values[key] = input[key].trim();
      }
    if (input.length && !['brief', 'normal', 'detailed'].includes(input.length)) throw fail('回覆長度不正確');
    if (input.length) values.length = input.length;
    for (const key of ['gifEnabled', 'stickerAutoSendEnabled', 'coChatEnabled'])
      if (typeof input[key] === 'boolean') values[key] = input[key];
    if (input.replyDeliveryMode) {
      if (!['auto', 'review'].includes(input.replyDeliveryMode)) throw fail('送出模式不正確');
      values.replyDeliveryMode = input.replyDeliveryMode;
    }
    if (!Object.values(values).some((v) => typeof v === 'boolean' || (typeof v === 'string' && v.trim())))
      throw fail('請至少設定一項稱呼、風格或行為偏好');
    const existing = input.id
      ? this.data.rules.find((r) => r.id === input.id)
      : this.data.rules.find(
          (r) =>
            r.kind === input.kind &&
            r.targetId === input.targetId &&
            r.transport === input.transport &&
            r.scope === input.scope,
        );
    if (input.id && !existing) throw fail('規則已刪除，請重新整理');
    if (!existing && this.data.rules.length >= 200) throw fail('最多保存 200 條偏好');
    const row = {
      id: existing?.id || randomUUID(),
      label: String(input.label || '').slice(0, 100),
      kind: input.kind,
      targetId: input.targetId,
      transport: input.transport,
      scope: input.scope,
      values,
    };
    this.data.rules = this.data.rules.filter((r) => r.id !== row.id);
    this.data.rules.push(row);
    await this.save();
    return { ok: true, ...this.status() };
  }
  async removeRule(id) {
    this.data.rules = this.data.rules.filter((r) => r.id !== id);
    await this.save();
    return { ok: true, ...this.status() };
  }
  apply(config, message, transport = 'user') {
    const out = { ...config };
    const dm = message.isDm && !message.isGroupDm;
    const matches = this.data.rules
      .filter(
        (r) =>
          (r.transport === 'both' || r.transport === transport) &&
          (r.scope === 'both' || r.scope === (dm ? 'dm' : 'group')) &&
          (r.kind === 'channel' ? r.targetId === message.channelId : r.targetId === message.author?.id),
      )
      .sort(
        (a, b) =>
          Number(a.kind === 'channel') * 8 +
          Number(a.transport !== 'both') * 2 +
          Number(a.scope !== 'both') -
          (Number(b.kind === 'channel') * 8 +
            Number(b.transport !== 'both') * 2 +
            Number(b.scope !== 'both')),
      );
    const prefs = {};
    for (const rule of matches) {
      Object.assign(prefs, rule.values);
      for (const key of ['gifEnabled', 'stickerAutoSendEnabled', 'coChatEnabled', 'replyDeliveryMode'])
        if (rule.values[key] !== undefined) {
          out[key] = rule.values[key];
          for (const f of AUDIENCE_FIELDS) if (f.audienceBaseKey === key) out[f.key] = rule.values[key];
        }
    }
    if (prefs.length === 'brief') {
      out.maxReplyTokens = Math.min(out.maxReplyTokens || 800, 400);
      out.coChatMaxMessageChars = Math.min(out.coChatMaxMessageChars || 180, 100);
    }
    if (prefs.length === 'detailed') out.maxReplyTokens = Math.max(out.maxReplyTokens || 800, 1600);
    if (matches.length) out.conversationPreferences = prefs;
    return out;
  }
  async flush() {
    await this.queue;
  }
}
