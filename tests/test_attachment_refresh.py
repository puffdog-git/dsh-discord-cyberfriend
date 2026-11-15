import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'bridge'))
from worker import Worker

class RefreshTests(unittest.IsolatedAsyncioTestCase):
    async def test_existing_authenticated_transport_refreshes_only_discord_attachments(self):
        worker=Worker()
        request=AsyncMock(return_value={'refreshed_urls':[{'original':'x','refreshed':'y'}]})
        worker.client=SimpleNamespace(is_ready=lambda: True,is_closed=lambda: False,user=SimpleNamespace(id=1),http=SimpleNamespace(request=request))
        result=await worker.call('refresh_attachments',{'urls':['https://cdn.discordapp.com/attachments/111/222/a.gif','https://example.com/attachments/a']})
        self.assertTrue(result['ok'])
        self.assertEqual(request.call_args.kwargs['json']['attachment_urls'],['https://cdn.discordapp.com/attachments/111/222/a.gif'])
        request.reset_mock()
        result=await worker.call('refresh_attachments',{'urls':['https://example.com/attachments/a']})
        self.assertFalse(result['ok'])
        request.assert_not_called()


