import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'bridge'))
from worker import Worker

class StickerReuseTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_available_stickers_in_target_guild_are_sent(self):
        worker=Worker()
        sticker=SimpleNamespace(id=444,available=True)
        channel=SimpleNamespace(id=1560000000000000004,guild=SimpleNamespace(id=555,stickers=[sticker]))
        channel.send=AsyncMock(return_value=SimpleNamespace(id=999,channel=channel))
        worker.client=SimpleNamespace(user=SimpleNamespace(id=1),get_channel=lambda _:channel)
        worker.settings={'receiveOnly':False,'autoReply':True,'dryRun':False}
        result=await worker.mutate('send',{'channelId':str(channel.id),'options':{'autoReply':True,'stickerIds':['444']}})
        self.assertTrue(result['ok'])
        self.assertEqual(channel.send.call_args.kwargs['stickers'],[sticker])
        channel.send.reset_mock()
        bad=await worker.mutate('send',{'channelId':str(channel.id),'options':{'autoReply':True,'stickerIds':['other-guild-id']}})
        self.assertFalse(bad['ok'])
        channel.send.assert_not_called()
        worker.settings['receiveOnly']=True
        with self.assertRaises(PermissionError):
            await worker.mutate('send',{'channelId':str(channel.id),'options':{'autoReply':True,'stickerIds':['444']}})
