import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).parents[1] / 'bridge'))
from worker import Worker


class GifSearchTest(unittest.IsolatedAsyncioTestCase):
    async def test_native_http_route_uses_klipy_and_bounded_query(self):
        calls = []
        async def request(route, **kwargs):
            calls.append((route, kwargs))
            return [{'url': 'https://klipy.com/gifs/test'}]
        worker = Worker()
        worker.client = SimpleNamespace(is_ready=lambda: True, is_closed=lambda: False,
                                       http=SimpleNamespace(request=request))
        result = await worker.call('gifs', {'query': 'cat' * 100, 'locale': 'en-US'})
        self.assertTrue(result['ok'])
        route, kwargs = calls[0]
        self.assertEqual(route.method, 'GET')
        self.assertEqual(route.path, '/gifs/search')
        self.assertEqual(kwargs['params']['provider'], 'klipy')
        self.assertEqual(kwargs['params']['limit'], 20)
        self.assertEqual(len(kwargs['params']['q']), 120)
