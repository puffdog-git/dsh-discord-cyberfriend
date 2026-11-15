import asyncio
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import Worker
from discord.context_managers import Typing

CHANNEL = '1560000000000000004'


class Channel:
    id = int(CHANNEL)

    def __init__(self):
        self.posts = 0
        self._state = SimpleNamespace(loop=asyncio.get_running_loop(), http=SimpleNamespace(send_typing=self.send_typing))

    async def send_typing(self, channel_id):
        self.posts += 1

    async def _get_channel(self):
        return self

    def typing(self):
        return Typing(self)


class TypingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.worker = Worker()
        self.channel = Channel()
        self.worker.client = SimpleNamespace(user=SimpleNamespace(id=1), get_channel=lambda _: self.channel)
        self.worker.settings = {'receiveOnly': False, 'autoReply': True, 'dryRun': False, 'typingEnabled': True}

    async def asyncTearDown(self):
        await self.worker.stop_all_typing()

    async def test_concurrent_replies_share_one_native_typing_context(self):
        a = await self.worker.start_typing({'channelId': CHANNEL, 'options': {'autoReply': True}})
        b = await self.worker.start_typing({'channelId': CHANNEL, 'options': {'autoReply': True}})
        await asyncio.sleep(0)
        self.assertEqual(self.channel.posts, 1)
        self.assertEqual(len(self.worker.typing_jobs), 1)
        await self.worker.stop_typing(a['typingId'])
        self.assertEqual(len(self.worker.typing_jobs), 1)
        await self.worker.stop_typing(b['typingId'])
        self.assertEqual(self.worker.typing_jobs, {})
        self.assertEqual(self.worker.typing_leases, {})

    async def test_cancel_before_first_request_does_not_leak_job(self):
        lease = await self.worker.start_typing({'channelId': CHANNEL})
        await self.worker.stop_typing(lease['typingId'])
        self.assertEqual(self.channel.posts, 0)
        self.assertEqual(self.worker.typing_jobs, {})

    async def test_modes_prevent_typing(self):
        for patch in [{'receiveOnly': True}, {'dryRun': True}, {'typingEnabled': False}, {'autoReply': False}]:
            original = self.worker.settings.copy()
            self.worker.settings.update(patch)
            with self.assertRaises(PermissionError):
                await self.worker.start_typing({'channelId': CHANNEL, 'options': {'autoReply': True}})
            self.worker.settings = original
        self.assertEqual(self.channel.posts, 0)

    async def test_disabling_while_generating_stops_native_renewal(self):
        await self.worker.start_typing({'channelId': CHANNEL, 'options': {'autoReply': True}})
        await asyncio.sleep(0)
        self.assertEqual(self.channel.posts, 1)
        await self.worker.call('configure', {'receiveOnly': False, 'autoReply': True, 'dryRun': True, 'typingEnabled': True})
        self.assertEqual(self.worker.typing_jobs, {})
        self.assertEqual(self.worker.typing_leases, {})


if __name__ == '__main__':
    unittest.main()
