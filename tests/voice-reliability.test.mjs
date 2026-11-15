import test from 'node:test';import assert from 'node:assert/strict';
import {SpeechActivity,resemblesPlayback}from'../src/voice-activity.js';
function frame(amplitude=4000){const pcm=Buffer.alloc(3840);for(let i=0;i<pcm.length;i+=2)pcm.writeInt16LE(amplitude,i);return pcm}
test('one loud frame or separated clicks cannot interrupt; sustained voice confirms once',()=>{
 const gate=new SpeechActivity();let count=0;for(let i=0;i<30;i++){count+=gate.push(frame()).newlyConfirmed;for(let n=0;n<8;n++)count+=gate.push(frame(0)).newlyConfirmed;}assert.equal(count,0);
 for(let i=0;i<40;i++)count+=gate.push(frame()).newlyConfirmed;assert.equal(count,1);
 const quiet=new SpeechActivity();for(let i=0;i<100;i++)assert.equal(quiet.push(frame(100)).newlyConfirmed,false);
 const clicks=new SpeechActivity();for(let i=0;i<60;i++){assert.equal(clicks.push(frame()).newlyConfirmed,false);for(let n=0;n<5;n++)assert.equal(clicks.push(frame(0)).newlyConfirmed,false);}
});
test('playback echo heuristic tolerates punctuation but does not classify a new question as echo',()=>{
 assert.equal(resemblesPlayback('明天下午三點，到圖書館。','好的，明天下午三點到圖書館整理筆記。'),true);
 assert.equal(resemblesPlayback('等等，我想改成後天上午。','好的，明天下午三點到圖書館整理筆記。'),false);
 assert.equal(resemblesPlayback('停','停止播放'),false);
});
