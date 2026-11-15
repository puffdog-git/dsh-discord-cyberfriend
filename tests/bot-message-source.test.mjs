import test from 'node:test';
import assert from 'node:assert/strict';
import {BotTransport} from '../src/transport/bot.js';
const channelId='400000000000000008', messageId='1580000000000000011';
function fixture(channel={id:channelId,guild_id:'400000000000000004',type:2}) {
 const t=Object.create(BotTransport.prototype);t.selfId='bot';
 t.rest=async(_,url)=>url.endsWith('/messages/'+messageId)?{id:messageId,channel_id:channelId,author:{id:'user'},content:'test'}:channel;
 return t;
}
test('REST source message obtains guild from authoritative channel',async()=>{
 const r=await fixture().getMessage(channelId,messageId);assert.equal(r.ok,true);assert.equal(r.message.guildId,'400000000000000004');
});
test('REST DM remains without guild; ambiguous or mismatched channel fails closed',async()=>{
 assert.equal((await fixture({id:channelId,type:1}).getMessage(channelId,messageId)).message.guildId ?? null,null);
 for(const channel of [{id:'other',guild_id:'guild'},{id:channelId,type:2}])assert.equal((await fixture(channel).getMessage(channelId,messageId)).ok,false);
});
test('REST source rejects account changes during lookup',async()=>{
 const t=fixture(), rest=t.rest;t.rest=async(...args)=>{const r=await rest(...args);t.selfId='other';return r;};
 assert.equal((await t.getMessage(channelId,messageId)).ok,false);
});

