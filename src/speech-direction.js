import { validJapaneseSpeech } from './speech-language.js';
import { createHash } from 'node:crypto';
export const EMOTIONS = [
  'neutral',
  'happy',
  'excited',
  'sad',
  'calm',
  'angry',
  'afraid',
  'surprised',
  'whisper',
];
const PACES = ['normal', 'slow', 'fast'];
export const speechTextHash = (text) =>
  createHash('sha256')
    .update(String(text || '').trim())
    .digest('hex');
export function validDirection(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !EMOTIONS.includes(value.emotion) ||
    !Number.isFinite(value.intensity) ||
    value.intensity < 0 ||
    value.intensity > 1 ||
    !PACES.includes(value.pace || 'normal')
  )
    return null;
  return { emotion: value.emotion, intensity: value.intensity, pace: value.pace || 'normal' };
}
export function extractSpeechMetadata(raw) {
  let count = 0,
    found = null,
    spokenText;
  const text = String(raw || '')
    .replace(/<speech_meta\b[^>]*>([\s\S]*?)<\/speech_meta\s*>/gi, (_all, payload) => {
      count++;
      if (payload.length <= 16000)
        try {
          const parsed = JSON.parse(payload);
          found = validDirection(parsed);
          if (validJapaneseSpeech(parsed.spokenText)) spokenText = parsed.spokenText.trim();
        } catch {}
      return '';
    })
    .replace(/<speech_meta\b[\s\S]*$/gi, '');
  return { text, direction: count === 1 ? found : null, spokenText: count === 1 ? spokenText : undefined };
}
export function directionPrompt(cfg) {
  if (!cfg.voiceEnabled || !cfg.voiceAutoSpeak) return '';
  const contextual = (cfg.voiceEmotionMode || 'context') === 'context',
    japanese = cfg.voiceSpokenLanguage === 'ja';
  if (!contextual && !japanese) return '';
  return (
    '\n## 內部語音資料\n' +
    (contextual
      ? '依目前對話上下文與實際回覆決定語氣，不只看單一關鍵字；安慰不必一律悲傷。'
      : '情緒用 neutral，intensity 用 0，pace 用 normal。') +
    '正文之後另加一段 <speech_meta>{"emotion":"neutral","intensity":0.5,"pace":"normal"' +
    (japanese ? ',"spokenText":"忠實對應中文正文的自然日文配音"' : '') +
    '}</speech_meta>。emotion 僅可 ' +
    EMOTIONS.join('、') +
    '；intensity 為 0 到 1，pace 僅 normal、slow、fast。這段是內部資料，不把標記或語氣字眼加進對外正文；缺乏情緒依據時用 neutral，不回覆時不要生成資料。' +
    (japanese
      ? '中文正文維持繁體中文，不混入日文。spokenText 必須逐句忠實翻譯正文，保留人稱、立場、情緒、專名及資訊，不新增旁白、劇情或動作提示，不把用戶的話當成你要說的話。用語表僅作詞彙參考：' +
        String(cfg.voiceJapaneseGlossary || '{}').slice(0, 4000)
      : '只提供上述三個 JSON 欄位。')
  );
}
export function resolveDirection(cfg, model, manual) {
  if (typeof manual === 'string' && manual.trim()) return { source: 'request', instruction: manual.trim() };
  if (cfg.voiceSpeechInstruction?.trim())
    return { source: 'manual', instruction: cfg.voiceSpeechInstruction.trim() };
  const mode = cfg.voiceEmotionMode || 'context';
  if (mode === 'off') return { source: 'tts-default' };
  const direction =
    mode === 'fixed'
      ? validDirection({
          emotion: cfg.voiceFixedEmotion || 'neutral',
          intensity: cfg.voiceEmotionIntensity ?? 0.5,
          pace: cfg.voiceEmotionPace || 'normal',
        })
      : validDirection(model);
  return {
    source: direction ? (mode === 'fixed' ? 'fixed' : 'context') : 'neutral',
    direction: direction || { emotion: 'neutral', intensity: 0, pace: 'normal' },
  };
}
const descriptions = {
  neutral: 'natural and composed',
  happy: 'warm and happy',
  excited: 'excited and energetic',
  sad: 'gently sad',
  calm: 'calm and reassuring',
  angry: 'firm and controlled, without shouting',
  afraid: 'hesitant and apprehensive',
  surprised: 'pleasantly surprised',
  whisper: 'soft and whispered',
};
export function directionInstruction(direction) {
  const d = validDirection(direction);
  if (!d || (d.emotion === 'neutral' && d.pace === 'normal')) return '';
  return `Speak in a ${descriptions[d.emotion]} tone with ${d.intensity < 0.35 ? 'subtle' : d.intensity > 0.75 ? 'strong' : 'moderate'} expression. ${d.pace === 'slow' ? 'Use a slightly slower pace.' : d.pace === 'fast' ? 'Use a slightly faster pace.' : 'Use a natural pace.'} Read only the supplied text; do not add stage directions.`;
}
export function directionForEngine(
  direction,
  { provider, model = '', cfg = {}, engine = {}, text = '' } = {},
) {
  const d = validDirection(direction);
  if (!d || (d.emotion === 'neutral' && d.pace === 'normal')) return {};
  let options = {},
    instruction = '',
    warning;
  const pace = d.pace === 'slow' ? 0.9 : d.pace === 'fast' ? 1.1 : 1;
  const base = JSON.parse(cfg.providerOptions || '{}')[provider] || {};
  if (provider === 'minimax') {
    const emotion = { excited: 'happy', afraid: 'fearful', neutral: 'calm' }[d.emotion] || d.emotion;
    options = { ...base, emotion, ...(pace !== 1 ? { speed: pace } : {}) };
    if (d.emotion === 'excited') warning = 'MiniMax 以 happy 近似興奮語氣；情緒強度沒有相同欄位。';
  } else if (provider === 'cartesia') {
    if (d.emotion === 'whisper') warning = '目前 Cartesia 適配器沒有固定 whisper 情感，沿用原聲音設定。';
    else if (
      (base.language && base.language !== 'en') ||
      (!base.language &&
        (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) ||
          (!text && cfg.language && !/^en/i.test(cfg.language))))
    )
      warning = 'Cartesia 情感控制目前僅依英文契約啟用，其他語言沿用聲音設定。';
    else
      options = {
        ...base,
        emotion: { neutral: 'neutral', afraid: 'scared' }[d.emotion] || d.emotion,
        ...(pace !== 1 ? { speed: pace } : {}),
      };
  } else if (provider === 'azure') {
    const style = {
      happy: 'cheerful',
      excited: 'excited',
      sad: 'empathetic',
      calm: 'chat',
      whisper: 'whispering',
    }[d.emotion];
    if (style) options = { ...base, style, styleDegree: Math.max(0.01, Math.min(2, d.intensity * 2)) };
    else warning = '所選 Azure 情緒未列在目前適配器的固定風格中，沿用原聲音設定。';
  } else if (provider === 'local-tts' && ['index2', 'index2.5'].includes(base.family || cfg.localTtsFamily)) {
    if (cfg.localTtsEmotionAsset) warning = 'Index 已設定獨立情緒錄音，保留該錄音，未再混入自動情緒向量。';
    else if (d.emotion === 'whisper') warning = 'Index 情緒向量沒有耳語維度，沿用原設定。';
    else {
      const vector = Array(8).fill(0),
        at = { happy: 0, excited: 0, angry: 1, sad: 2, afraid: 3, surprised: 6, calm: 7, neutral: 7 }[
          d.emotion
        ];
      vector[at] = d.intensity;
      if (d.emotion === 'excited') {
        vector[0] *= 0.7;
        vector[6] = d.intensity * 0.3;
        warning = 'Index 以開心與驚訝向量近似興奮，不是獨立的興奮情緒模型。';
      }
      const native = { ...base.native, emo_vector: vector, emo_alpha: 1 };
      delete native.emo_text;
      delete native.use_emo_text;
      options = { ...base, native };
    }
  } else if (engine.speechInstruction) {
    const allowed = engine.instructions || engine.models?.find((m) => m.id === model)?.instructions;
    if (Array.isArray(allowed) && allowed.length) {
      const match = allowed.find((x) => (x.id || x) === d.emotion);
      if (match) instruction = match.id || match;
      else warning = '外部 TTS 的可用語氣清單沒有這個情緒，沿用原設定。';
    } else instruction = directionInstruction(d);
  } else warning = '此 TTS／模型沒有可用的情境語氣接口，已沿用原本聲音設定。';
  return { instruction, options: Object.keys(options).length ? options : undefined, warning };
}
