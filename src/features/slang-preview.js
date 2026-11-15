// 鄉民語氣的預覽：同一句話，各產生一則「沒附樣本」和「有附樣本」的回覆給使用者比較。
//
// 只呼叫模型，不會送任何東西到 Discord，也不寫入聊天記錄、會話或記憶。
// 用的是插件自己的提示詞（人設、規則）；「DSH 會話」模式下工作區裡的人格檔與對話歷史不在預覽範圍內。
import { buildPrompt, processModelOutput } from '../persona.js';
import { audienceConfig } from '../config.js';
import { generateReply } from '../llm.js';

export const PREVIEW_AUDIENCES = ['adminDm', 'adminGroup', 'othersDm', 'othersGroup'];

export function createSlangPreview({ ctx, getConfig, slangTone, generate = generateReply, selfName = () => '' }) {
  let busy = false;
  return async function preview({ text, audience } = {}) {
    const message = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if ([...message].length < 2) return { ok: false, error: '請輸入一句要讓 AI 回覆的話' };
    const target = PREVIEW_AUDIENCES.includes(audience) ? audience : 'othersGroup';
    const base = getConfig();
    const isDm = target.endsWith('Dm');
    const isAdmin = target.startsWith('admin');
    if (isAdmin && !base.adminUserId) return { ok: false, error: '還沒設定管理者 ID，無法預覽管理者的對象設定' };
    if (busy) return { ok: false, error: '上一個預覽還在進行，請稍候' };
    busy = true;
    try {
      const config = audienceConfig(base, isAdmin ? base.adminUserId : 'preview-other-user', isDm);
      const sample = slangTone.sampleFor(message, config);
      if (!sample.providers) return { ok: false, error: '沒有安裝提供語氣樣本的插件（需要「刷 PTT」）' };
      if (!sample.samples.length) return { ok: false, error: '樣本庫是空的（或都被來源限制、禁用詞擋掉），沒辦法預覽' };
      const prompt = buildPrompt({
        speech: false,
        compact: false,
        messageMaxChars: 16000,
        config: { ...config, gifEnabled: false, stickerAutoSendEnabled: false },
        kind: isDm ? 'dm' : 'mention',
        selfName: selfName() || 'AI',
        historyText: '',
        message,
        author: { name: '預覽', id: isAdmin ? base.adminUserId : 'preview-other-user' },
        isGuild: !isDm,
        isGroupDm: false,
        requesterId: isAdmin ? base.adminUserId : 'preview-other-user',
      });
      const temperature = config.temperature !== undefined && config.temperature !== null && config.temperature !== '' && Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.8;
      const run = async (user) => {
        const result = await generate(ctx, config, { system: prompt.system, user, maxTokens: Math.max(64, Number(config.maxReplyTokens) || 400), temperature, usageScope: 'slang-preview' });
        if (!result?.ok) return { ok: false, error: String(result?.error || '模型沒有回覆').slice(0, 200) };
        const output = processModelOutput(result.text, config);
        return { ok: true, text: String(output?.text ?? result.text ?? '').trim(), noReply: !String(output?.text ?? '').trim() };
      };
      const without = await run(prompt.user);
      const withTone = await run(prompt.user + sample.block);
      return {
        ok: true,
        audience: target,
        samples: sample.samples.map((s) => s.text),
        matched: sample.matched,
        serious: sample.serious,
        without,
        with: withTone,
        note: sample.serious ? '這句話含有「嚴肅話題的字」，實際回覆時不會帶鄉民語氣；這裡仍然顯示有附樣本的結果供比較。' : '',
      };
    } finally {
      busy = false;
    }
  };
}
