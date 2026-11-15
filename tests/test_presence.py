import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'bridge'))
from worker import Worker
import discord
class PresenceTests(unittest.IsolatedAsyncioTestCase):
    def fixture(self):
        w=Worker();w.settings={'receiveOnly':False};w.client=SimpleNamespace(user=SimpleNamespace(id=1),change_presence=AsyncMock());return w
    async def test_status_only_preserves_activities(self):
        w=self.fixture();r=await w.mutate('presence',{'status':'invisible'})
        self.assertTrue(r['ok']);self.assertEqual(w.client.change_presence.call_args.kwargs,{'status':discord.Status.invisible})
    async def test_activity_and_custom_status_are_serialized_by_real_sdk(self):
        w=self.fixture();await w.mutate('presence',{'status':'idle','activityType':'playing','activityText':'Stardew Valley','customStatusText':'安靜聊天','customStatusEmoji':'🐟'})
        args=w.client.change_presence.call_args.kwargs;self.assertEqual(args['status'],discord.Status.idle)
        self.assertEqual(args['activities'][0].to_dict()['name'],'Stardew Valley');self.assertEqual(args['activities'][0].type,discord.ActivityType.playing)
        self.assertEqual(args['activities'][1].to_dict()['state'],'安靜聊天');self.assertEqual(args['activities'][1].emoji.name,'🐟')
    async def test_clear_all_activities_and_custom_emoji(self):
        w=self.fixture();await w.mutate('presence',{'activityType':'none','activityText':'','customStatusText':'','customStatusEmoji':''})
        self.assertEqual(w.client.change_presence.call_args.kwargs,{'activities':[]})
        await w.mutate('presence',{'customStatusText':'hey','customStatusEmoji':'<:fish:1560000000000000002>'})
        self.assertEqual(w.client.change_presence.call_args.kwargs['activities'][0].emoji.id,1560000000000000002)
    async def test_invalid_payloads_and_receive_only_never_call_discord(self):
        w=self.fixture()
        for payload in [{'status':'bad'},{'activityType':'playing','activityText':''},{'activityType':'bad'},{'customStatusText':'x'*129},{'customStatusEmoji':'<bad>'}]:
            with self.assertRaises(ValueError):await w.mutate('presence',payload)
        w.settings['receiveOnly']=True
        with self.assertRaises(PermissionError):await w.mutate('presence',{'status':'online'})
        w.client.change_presence.assert_not_called()

    async def test_presence_read_is_available_in_receive_only(self):
        w=self.fixture();w.settings['receiveOnly']=True
        w.client.client_status=discord.Status.idle;w.client.status=discord.Status.online;w.client.activities=[discord.Activity(type=discord.ActivityType.playing,name='test game')];w.client.settings=SimpleNamespace(status=discord.Status.online)
        r=await w.call('presence_get',{})
        self.assertTrue(r['ok']);self.assertEqual(r['clientStatus'],'idle');self.assertEqual(r['savedStatus'],'online');self.assertEqual(r['activities'][0]['name'],'test game');w.client.change_presence.assert_not_called()

    async def test_fresh_presence_read_uses_native_settings_fetch(self):
        w=self.fixture();w.client.client_status=discord.Status.online;w.client.status=discord.Status.online;w.client.activities=[];w.client.settings=None
        w.client.fetch_settings=AsyncMock(return_value=SimpleNamespace(status=discord.Status.dnd,custom_activity=discord.CustomActivity(name='fresh status')))
        r=await w.call('presence_get',{'refresh':True})
        self.assertEqual(r['savedStatus'],'dnd');self.assertEqual(r['customStatus']['state'],'fresh status');self.assertEqual(r['source'],'gateway-and-rest');w.client.change_presence.assert_not_called()
