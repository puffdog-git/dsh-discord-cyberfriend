import test from 'node:test';
import assert from 'node:assert/strict';
import {convertReplyScript} from '../src/reply-script.js';
import {processModelOutput} from '../src/persona.js';
import {sanitizeConfig, audienceConfig, describeSchema} from '../src/config.js';

test('reply script is independent, defaults to original and is audience selectable',()=>{
 const config=sanitizeConfig({othersDm_replyChineseScript:'traditional',adminDm_replyChineseScript:'simplified',adminUserId:'400000000000000001'});
 assert.equal(sanitizeConfig({}).replyChineseScript,'original');
 assert.equal(audienceConfig(config,'400000000000000001',true).replyChineseScript,'simplified');
 assert.equal(audienceConfig(config,'123456789012345678',true).replyChineseScript,'traditional');
 assert.ok(JSON.stringify(describeSchema()).includes('AI 回覆字體'));
});
test('reply typography preserves code, URLs, mail, mentions and emoji identifiers',()=>{
 const protectedText='`軟體` ```文字\n軟體``` https://example.org/軟體 test@郵件.example <@123456789012345678> <:測試:123456789012345678>';
 assert.equal(convertReplyScript('這個軟體很適合聊天。 '+protectedText,'simplified'),'这个软体很适合聊天。 '+protectedText);
 assert.equal(convertReplyScript('这是语音测试。','traditional'),'這是語音測試。');
 assert.equal(convertReplyScript('日本語の音声です。','simplified'),'日本語の音声です。');
 assert.equal(convertReplyScript('这是原文。'),'这是原文。');
});
test('conversion happens after metadata parsing without converting control payloads',()=>{
 const output=processModelOutput('這是語音測試。[GIF:繁體][REACTION:👍]',{replyChineseScript:'simplified',antiAiFlavor:false,stripMarkdown:false});
 assert.equal(output.text,'这是语音测试。');
 assert.equal(output.gifQuery,'繁體');assert.deepEqual(output.reactions,['👍']);
 const original=processModelOutput('这是语音测试。',{replyChineseScript:'traditional',antiAiFlavor:false});
 assert.equal(original.text,'這是語音測試。');
});
