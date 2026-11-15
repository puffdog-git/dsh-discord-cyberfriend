import OpenCC from 'opencc-js';

const converters = new Map();
const opaque =
  /(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|<(?:@!?|@&|#)\d+>|<a?:[^:>]+:\d+>)/giu;

// Output typography only. User input, control tags and Japanese speech are untouched.
export function convertReplyScript(text, mode = 'original') {
  if (!['traditional', 'simplified'].includes(mode) || /[\u3040-\u30ff]/.test(text)) return text;
  if (!converters.has(mode))
    converters.set(
      mode,
      OpenCC.Converter(mode === 'traditional' ? { from: 'cn', to: 't' } : { from: 't', to: 'cn' }),
    );
  const convert = converters.get(mode);
  return String(text)
    .split(opaque)
    .map((part, index) => (index % 2 ? part : convert(part)))
    .join('');
}
