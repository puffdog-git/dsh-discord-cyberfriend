import asyncio
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
import worker as worker_module
from worker import ReconnectLimitError, Worker


class VoiceConnectLimitTests(unittest.TestCase):
    """進語音房的連線不計入主連線的「5 次重連」上限（實機：進出語音房幾次後就進不去）。"""

    def setUp(self):
        self.events = []
        self._emit = worker_module.emit
        worker_module.emit = self.events.append

    def tearDown(self):
        worker_module.emit = self._emit

    def test_voice_sockets_are_not_counted(self):
        w = Worker()
        w.settings = {'reconnect': True}
        calls = []

        async def connect(url, **kwargs):
            calls.append(url)
            return 'socket'

        async def run():
            for _ in range(12):
                self.assertEqual(await w.open_socket(connect, 'wss://c-tpe01-abcd.discord.media/?v=8'), 'socket')

        asyncio.run(run())
        self.assertEqual(len(calls), 12)
        self.assertEqual(w.connect_attempts, 0)
        self.assertEqual(self.events, [])

    def test_voice_errors_pass_through_unchanged(self):
        w = Worker()
        w.settings = {'reconnect': True}

        async def connect(url, **kwargs):
            raise OSError('voice endpoint unreachable')

        with self.assertRaises(OSError):
            asyncio.run(w.open_socket(connect, 'wss://c-tpe01-abcd.discord.media/?v=8'))
        self.assertEqual(w.connect_attempts, 0)

    def test_main_gateway_still_counted_and_limited(self):
        w = Worker()
        w.settings = {'reconnect': True}

        async def connect(url, **kwargs):
            return 'socket'

        async def run():
            for _ in range(5):
                await w.open_socket(connect, 'wss://gateway.discord.gg/?v=9')
            with self.assertRaises(ReconnectLimitError):
                await w.open_socket(connect, 'wss://gateway-us-east1-b.discord.gg/?v=9')

        asyncio.run(run())
        self.assertEqual([e.get('event') for e in self.events].count('gateway_connect'), 6)
        # 主連線重新就緒之後歸零。
        w.recovered()
        self.assertEqual(asyncio.run(w.open_socket(connect, 'wss://gateway.discord.gg/?v=9')), 'socket')

    def test_host_classification(self):
        self.assertTrue(Worker.main_gateway('wss://gateway.discord.gg/?v=9'))
        self.assertFalse(Worker.main_gateway('wss://c-tpe01-abcd.discord.media/?v=8'))
        self.assertFalse(Worker.main_gateway('wss://discord.gg.example.com/'))


if __name__ == '__main__':
    unittest.main()
