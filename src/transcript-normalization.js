import OpenCC from 'opencc-js';
import { redactSensitive } from './security.js';

const converters = new Map();
const builtins = [
  ['Deep Seek', 'DeepSeek'],
  ['Eleven Labs', 'ElevenLabs'],
  ['Open AI', 'OpenAI'],
  ['Chat GPT', 'ChatGPT'],
  ['Fish audio', 'Fish Audio'],
];
const modes = new Set(['original', 'tw', 'twp']);
function converter(mode) {
  if (!converters.has(mode)) converters.set(mode, OpenCC.Converter({ from: 'cn', to: mode }));
  return converters.get(mode);
}
export function parseTranscriptGlossary(value = '{}') {
  if (typeof value !== 'string' || value.length > 20000)
    throw Error('逐字稿專名對照表須為JSON物件，最多20000字元');
  let obj;
  try {
    obj = JSON.parse(value || '{}');
  } catch {
    throw Error('逐字稿專名對照表不是有效JSON');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).length > 100)
    throw Error('逐字稿專名對照表須為最多100組的JSON物件');
  return Object.entries(obj).map(([from, to]) => {
    if (
      !from.trim() ||
      from.length > 80 ||
      typeof to !== 'string' ||
      !to.trim() ||
      to.length > 160 ||
      /[\u0000-\u001f\u007f]/.test(from + to)
    )
      throw Error('逐字稿專名每組須為1–80字的原詞與1–160字的正確名稱，不能包含控制字元');
    return [from, to];
  });
}
export function validateTranscriptConfig(c) {
  if (!modes.has(c.voiceTranscriptScript || 'twp')) throw Error('不支援的逐字稿文字轉換');
  parseTranscriptGlossary(c.voiceTranscriptGlossary || '{}');
}
// Code, URLs, mail addresses and Discord identifiers are opaque, never glossary data.
const protectedParts =
  /(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|<(?:@!?|@&|#)\d+>)/giu;
function latinWord(c) {
  return !!c && /[A-Za-z0-9_]/.test(c);
}
function replaceTerms(text, rules) {
  let out = '',
    count = 0;
  for (let at = 0; at < text.length;) {
    const rule = rules.find((r) => {
      if (at + r.from.length > text.length) return false;
      const part = text.slice(at, at + r.from.length);
      if (r.insensitive ? part.toLowerCase() !== r.from.toLowerCase() : part !== r.from) return false;
      return !(
        (latinWord(r.from[0]) && latinWord(text[at - 1])) ||
        (latinWord(r.from.at(-1)) && latinWord(text[at + r.from.length]))
      );
    });
    if (rule) {
      if (text.slice(at, at + rule.from.length) !== rule.to) count++;
      out += rule.to;
      at += rule.from.length;
    } else out += text[at++];
  }
  return { text: out, count };
}
export function normalizeTranscript(value, c = {}, { maxChars = 4000 } = {}) {
  const raw = redactSensitive(String(value || ''), c, { privateData: true })
      .text.trim()
      .slice(0, maxChars),
    requested = c.voiceTranscriptScript || 'twp',
    language = String(c.voiceSttLanguage || 'auto').toLowerCase();
  // Explicit non-Chinese hints and automatic Japanese kana avoid altering kanji.
  const chinese =
    language === 'auto' ? !/[\u3040-\u30ff]/.test(raw) : /^zh(?:[-_]|$)|^yue(?:[-_]|$)/.test(language);
  const mode = chinese && modes.has(requested) ? requested : 'original',
    convert = mode === 'original' ? (s) => s : converter(mode),
    rules = [];
  const custom =
    c.voiceTranscriptTermsEnabled !== false ? parseTranscriptGlossary(c.voiceTranscriptGlossary || '{}') : [];
  for (const [from, to] of custom) {
    for (const variant of new Set([from, convert(from)]))
      rules.push({ from: variant, to, insensitive: false, custom: true });
  }
  if (c.voiceTranscriptTermsEnabled !== false)
    for (const [from, to] of builtins)
      if (!rules.some((r) => r.from.toLowerCase() === from.toLowerCase()))
        rules.push({ from, to, insensitive: true });
  rules.sort((a, b) => b.from.length - a.from.length || Number(b.custom) - Number(a.custom));
  let converted = false,
    corrections = 0;
  const text = raw
    .split(protectedParts)
    .map((part, i) => {
      if (i % 2) return part;
      const normalized = convert(part);
      converted ||= normalized !== part;
      const result = replaceTerms(normalized, rules);
      corrections += result.count;
      return result.text;
    })
    .join('');
  return {
    text: redactSensitive(text, c, { privateData: true }).text.slice(0, maxChars),
    normalization: { mode, converted, corrections },
  };
}
