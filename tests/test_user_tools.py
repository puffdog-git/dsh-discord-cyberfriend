import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'bridge'))
from worker import Worker
import discord
CH=1560000000000000011
MID=1560000000000000012
class UserToolsTests(unittest.IsolatedAsyncioTestCase):
    def fixture(self):
        w=Worker();w.settings={'receiveOnly':False,'typingEnabled':False}
        m=SimpleNamespace(id=MID,author=SimpleNamespace(id=1),edit=AsyncMock(return_value=SimpleNamespace(id=MID)),delete=AsyncMock())
        c=SimpleNamespace(id=CH,guild=None,fetch_message=AsyncMock(return_value=m),send=AsyncMock(return_value=SimpleNamespace(id=MID,channel=SimpleNamespace(id=CH))))
        w.client=SimpleNamespace(is_ready=lambda:True,is_closed=lambda:False,user=SimpleNamespace(id=1),get_channel=lambda _:c,sticker_packs=AsyncMock(return_value=[]))
        return w,c,m
    async def test_edit_and_delete_only_own_messages(self):
        w,c,m=self.fixture();await w.call('edit_message',{'channelId':str(CH),'messageId':str(MID),'content':'fixed'})
        self.assertEqual(m.edit.call_args.kwargs['content'],'fixed');self.assertFalse(m.edit.call_args.kwargs['allowed_mentions'].everyone)
        await w.call('delete_message',{'channelId':str(CH),'messageId':str(MID)});m.delete.assert_awaited_once()
        m.author.id=2;m.edit.reset_mock();m.delete.reset_mock()
        for method in ('edit_message','delete_message'):
            with self.assertRaises(PermissionError):await w.call(method,{'channelId':str(CH),'messageId':str(MID),'content':'bad'})
        m.edit.assert_not_called();m.delete.assert_not_called()
    async def test_read_only_blocks_changes_and_invalid_text(self):
        w,c,m=self.fixture()
        with self.assertRaises(ValueError):await w.call('edit_message',{'channelId':str(CH),'messageId':str(MID),'content':''})
        w.settings['receiveOnly']=True
        with self.assertRaises(PermissionError):await w.call('delete_message',{'channelId':str(CH),'messageId':str(MID)})
        m.delete.assert_not_called()
    async def test_search_filters_to_target_guild_and_caches_standard_packs(self):
        w,c,m=self.fixture();s=SimpleNamespace(id=44,name='開心魚',description='happy',url='https://cdn.discordapp.com/stickers/44.png',format='png',available=True)
        c.guild=SimpleNamespace(id=55,stickers=[s]);w.client.guilds=[c.guild,SimpleNamespace(id=99,stickers=[s])]
        a=await w.call('stickers',{'channelId':str(CH),'query':'happy'});b=await w.call('stickers',{'channelId':str(CH),'query':'不存在'})
        self.assertEqual(len(a['stickers']),1);self.assertEqual(a['stickers'][0]['guildId'],'55');self.assertEqual(b['stickers'],[]);w.client.sticker_packs.assert_awaited_once()
    async def test_standard_sticker_can_be_sent_in_dm_but_foreign_guild_sticker_is_rejected(self):
        w,c,m=self.fixture();s=SimpleNamespace(id=44,type=discord.StickerType.standard);w.standard_stickers['44']=s
        r=await w.call('send',{'channelId':str(CH),'options':{'stickerIds':['44']}});self.assertTrue(r['ok']);self.assertEqual(c.send.call_args.kwargs['stickers'],[s])
        w.standard_stickers['45']=SimpleNamespace(id=45,type=discord.StickerType.guild);r=await w.call('send',{'channelId':str(CH),'options':{'stickerIds':['45']}});self.assertFalse(r['ok'])

    async def test_plugin_nonce_is_reserved_before_http_and_echo_cannot_trigger_takeover(self):
        w,c,m=self.fixture()
        async def send(**kwargs):
            nonce=kwargs['nonce'];self.assertIn(nonce,w.plugin_nonces)
            echo=SimpleNamespace(id=MID,author=SimpleNamespace(id=1),nonce=nonce)
            self.assertEqual(await w.message_origin(echo),'plugin')
            return SimpleNamespace(id=MID,channel=SimpleNamespace(id=CH))
        c.send=send
        await w.call('send',{'channelId':str(CH),'options':{'content':'hi'}})
        manual=SimpleNamespace(id=MID+1,author=SimpleNamespace(id=1),nonce='other-client-nonce')
        self.assertEqual(await w.message_origin(manual),'manual')
        ambiguous=SimpleNamespace(id=MID+2,author=SimpleNamespace(id=1),nonce=None)
        self.assertEqual(await w.message_origin(ambiguous),'unknown')
    async def test_send_network_failure_is_uncertain_and_must_not_be_retried(self):
        w,c,m=self.fixture();c.send=AsyncMock(side_effect=TimeoutError())
        r=await w.call('send',{'channelId':str(CH),'options':{'content':'maybe sent'}})
        self.assertFalse(r['ok']);self.assertTrue(r['uncertain'])
