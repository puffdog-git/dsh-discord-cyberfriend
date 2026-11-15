import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTranscript,parseTranscriptGlossary,validateTranscriptConfig} from '../src/transcript-normalization.js';
test('Taiwan conversion uses phrase context, supports character-only and original modes',()=>{
 const input='明天下午3点到图书馆整理笔记，用软件打开文件。';
 assert.equal(normalizeTranscript(input,{voiceSttLanguage:'zh'}).text,'明天下午3點到圖書館整理筆記，用軟體開啟檔案。');
 assert.match(normalizeTranscript(input,{voiceTranscriptScript:'tw',voiceSttLanguage:'zh'}).text,/軟件/);
 assert.equal(normalizeTranscript(input,{voiceTranscriptScript:'original',voiceTranscriptTermsEnabled:false}).text,input);
});
test('custom terms survive conversion, prefer longest aliases, replace once and treat regex syntax literally',()=>{
 const c={voiceSttLanguage:'zh',voiceTranscriptGlossary:JSON.stringify({'大肥余':'大肥魚','深度求索':'DeepSeek','a.b':'產品A','A':'B','B':'C','Open AI':'OpenAI 自訂'})};
 assert.equal(normalizeTranscript('大肥余用深度求索与a.b、A、B、Open AI。',c).text,'大肥魚用DeepSeek與產品A、B、C、OpenAI 自訂。');
 const r=normalizeTranscript('Deep Seek Eleven Labs open ai Chat GPT Fish Audio Open AIs Deep Seekers',{});
 assert.equal(r.text,'DeepSeek ElevenLabs OpenAI ChatGPT Fish Audio Open AIs Deep Seekers');assert.equal(r.normalization.corrections,4);
});
test('URLs, emails, inline code and Discord identifiers are never corrected or converted',()=>{
 const input='代码 `Open AI 简体` https://example.com/简体/DeepSeek a@简体.example <@123456789012345678> ```\n简体 Open AI\n```';
 const c={voiceTranscriptGlossary:JSON.stringify({'Open AI':'changed','123456789012345678':'wrong'})};const out=normalizeTranscript(input,c).text;
 assert.ok(out.includes('`Open AI 简体`'));assert.ok(out.includes('https://example.com/简体/DeepSeek'));assert.ok(out.includes('<@123456789012345678>'));assert.ok(out.includes('```\n简体 Open AI\n```'));
 assert.ok(out.includes('a@简体.example'));
 assert.equal(normalizeTranscript('OpenAI@test.com',{voiceTranscriptGlossary:'{"OpenAI":"changed"}'}).text,'OpenAI@test.com');
});
test('explicit non-Chinese and auto Japanese skip kanji conversion; unknown words and homophones remain untouched',()=>{
 assert.equal(normalizeTranscript('今日は図書館で勉強する',{voiceSttLanguage:'auto'}).text,'今日は図書館で勉強する');
 assert.equal(normalizeTranscript('中国',{voiceSttLanguage:'ja'}).text,'中国');assert.equal(normalizeTranscript('辨试 豆宝',{voiceSttLanguage:'zh'}).text,'辨試 豆寶');
 assert.equal(normalizeTranscript('Deep Seek',{voiceTranscriptTermsEnabled:false}).text,'Deep Seek');
});
test('glossary validation bounds input and rejects non-string replacement or malformed settings',()=>{
 for(const value of ['{','[]','null','{"":"x"}','{"a":1}','{"a":""}','{"a":"line\\nbreak"}'])assert.throws(()=>parseTranscriptGlossary(value),/逐字稿/);
 assert.throws(()=>parseTranscriptGlossary('x'.repeat(20001)),/最多/);assert.throws(()=>validateTranscriptConfig({voiceTranscriptScript:'unsupported'}),/不支援/);
 assert.ok(normalizeTranscript('字'.repeat(5000),{}, {maxChars:2000}).text.length<=2000);
});
