import { validJapaneseSpeech } from './speech-language.js';
import { validDirection } from './speech-direction.js';
import { redactSensitive, trustedAdmin } from './security.js';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
export const sourceFingerprint = (m) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        m.content || '',
        (m.attachments || []).map((a) => a.id || a.name),
        (m.stickers || []).map((s) => s.id),
      ]),
    )
    .digest('hex');
const fail = (text, status = 400) => Object.assign(Error(text), { status });
export class UserReview {
  constructor({
    file,
    getTransport,
    getConfig,
    validate = () => {},
    onSent = async () => {},
    onDiscard = async () => {},
  }) {
    Object.assign(this, { file, getTransport, getConfig, validate, onSent, onDiscard });
    this.rows = new Map();
    this.locks = new Set();
    this.queue = Promise.resolve();
  }
  async init() {
    try {
      const d = JSON.parse(await readFile(this.file, 'utf8'));
      for (const row of d.drafts || []) {
        if (row.state === 'sending') {
          row.state = 'uncertain';
          row.error = '上次發送中斷，請先核對 Discord，勿重送';
        }
        this.rows.set(row.id, row);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  status() {
    return {
      drafts: [...this.rows.values()]
        .filter((r) => !['sent', 'discarded'].includes(r.state))
        .map((r) => ({
          ...r,
          replyOptions: undefined,
          media: {
            stickerIds: r.replyOptions?.stickerIds || [],
            files: (r.replyOptions?.files || []).map((p) => String(p).split(/[\\/]/).at(-1)),
            urls: r.replyOptions?.fileUrls || [],
          },
        }))
        .sort((a, b) => b.createdAt - a.createdAt),
    };
  }
  async save() {
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(
          this.file + '.tmp',
          JSON.stringify({ version: 1, drafts: [...this.rows.values()] }, null, 2) + '\n',
        );
        await rename(this.file + '.tmp', this.file);
      });
    return this.queue;
  }
  async stage({ conversationTopic, message, transport, kind, replyOptions, speech, spokenText, sessionId }) {
    if (message.simulated) return { ok: true, skipped: true, reason: '模擬訊息不建立正式草稿' };
    let row = [...this.rows.values()].find(
      (r) => r.source.id === message.id && r.accountId === transport.selfId && r.state === 'pending',
    );
    if (!row && this.rows.size >= 200) {
      for (const [id, r] of this.rows)
        if (['sent', 'discarded', 'stale'].includes(r.state)) {
          this.rows.delete(id);
          if (this.rows.size < 200) break;
        }
      if (this.rows.size >= 200) throw fail('草稿已達 200 筆，請先處理既有草稿');
    }
    const options = {};
    for (const key of [
      'content',
      'stickerIds',
      'fileUrls',
      'files',
      'replyToMessageId',
      'mention',
      'memeImage',
    ])
      if (replyOptions[key] !== undefined) options[key] = structuredClone(replyOptions[key]);
    const record = {
      conversationTopic,
      id: row?.id || randomUUID(),
      version: (row?.version || 0) + 1,
      state: 'pending',
      createdAt: Date.now(),
      accountId: transport.selfId,
      kind,
      source: structuredClone(message),
      fingerprint: sourceFingerprint(message),
      content: options.content || '',
      mediaCount:
        (options.stickerIds?.length || 0) + (options.files?.length || 0) + (options.fileUrls?.length || 0),
      replyOptions: options,
      speech: validDirection(speech),
      spokenText: validJapaneseSpeech(spokenText) ? spokenText : undefined,
      speechOriginal: options.content || '',
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    };
    this.rows.set(record.id, record);
    await this.save();
    return { ok: true, draft: true, draftId: record.id };
  }
  async invalidate(messageId) {
    for (const r of this.rows.values())
      if (r.source.id === messageId && ['pending', 'failed'].includes(r.state)) {
        r.state = 'stale';
        r.version++;
        r.error = '來源訊息已修改或刪除，請重新產生';
      }
    await this.save();
  }
  async discard(id, version, acknowledgeUncertain = false) {
    const r = this.rows.get(id);
    if (!r) throw fail('找不到草稿', 404);
    if (this.locks.has(id) || r.state === 'sending' || r.version !== version)
      throw fail('草稿狀態已改變，請重新整理', 409);
    if (r.state === 'uncertain' && !acknowledgeUncertain) throw fail('此筆送出結果不確定，請先核對 Discord');
    if (r.state === 'uncertain') r.archivedAsUncertain = true;
    r.state = 'discarded';
    r.version++;
    await this.save();
    await this.onDiscard(r);
    return { ok: true };
  }
  async approve(id, { version, content, keepMedia = true } = {}) {
    const r = this.rows.get(id);
    if (!r) throw fail('找不到草稿', 404);
    if (this.locks.has(id) || !['pending', 'failed'].includes(r.state) || r.version !== version)
      throw fail('草稿狀態已改變或不可重送，請重新整理', 409);
    if (
      typeof content !== 'string' ||
      content.length > 2000 ||
      (!content.trim() && (!keepMedia || !r.mediaCount))
    )
      throw fail('請提供文字或保留媒體；文字最多 2000 字元');
    this.locks.add(id);
    try {
      const t = this.getTransport();
      if (!t.ready || t.selfId !== r.accountId) throw fail('帳號未連線或已更換，請重新產生草稿');
      const c = this.getConfig();
      if (!c.enabled || !c.userEnabled || c.userReceiveOnly || c.dryRun)
        throw fail('目前設定禁止發送，請確認總開關、僅觀察與演練模式');
      await this.validate(r, c, { keepMedia });
      const current = await t.getMessage(r.source.channelId, r.source.id);
      if (!current.ok) throw fail('來源訊息無法讀取，請確認是否已刪除');
      if (
        current.message.id !== r.source.id ||
        current.message.channelId !== r.source.channelId ||
        current.message.author?.id !== r.source.author?.id ||
        sourceFingerprint(current.message) !== r.fingerprint
      ) {
        r.state = 'stale';
        r.version++;
        await this.save();
        throw fail('來源內容已改變，請重新產生草稿');
      }
      await this.validate(r, c, { keepMedia });
      if (r.version !== version || !['pending', 'failed'].includes(r.state)) throw fail('草稿已變更', 409);
      content = redactSensitive(content, c, {
        privateData: !trustedAdmin(c, r.source.author?.id) || Boolean(r.source.guildId || r.source.isGroupDm),
      }).text;
      const options = { ...r.replyOptions, content, autoReply: false, expectedSelfId: r.accountId };
      if (!keepMedia) {
        delete options.memeImage;
        options.stickerIds = [];
        options.files = [];
        options.fileUrls = [];
      }
      r.content = content;
      r.replyOptions = options;
      r.mediaCount =
        (options.stickerIds?.length || 0) + (options.files?.length || 0) + (options.fileUrls?.length || 0);
      r.state = 'sending';
      r.version++;
      await this.save();
      let result;
      try {
        result = await t.sendMessage(r.source.channelId, options);
      } catch (e) {
        result = { ok: false, uncertain: true, error: '發送連線中斷，請先核對 Discord' };
      }
      if (result.ok && result.messageId) {
        r.state = 'sent';
        r.sentId = result.messageId;
        r.content = content;
        await this.save();
        try {
          await this.onSent(r, result, options);
        } catch {}
        return { ok: true, messageId: result.messageId };
      }
      r.state = result.uncertain || result.ok ? 'uncertain' : 'failed';
      r.error = result.error || '未取得發送確認，請核對 Discord';
      await this.save();
      return {
        ok: false,
        uncertain: r.state === 'uncertain',
        state: r.state,
        version: r.version,
        error: r.error,
      };
    } finally {
      this.locks.delete(id);
    }
  }
  async flush() {
    await this.queue;
  }
}
