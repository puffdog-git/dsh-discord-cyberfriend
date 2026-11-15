import sys
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import Worker

class VoiceMessageTests(unittest.IsolatedAsyncioTestCase):
    async def test_upstream_multipart_helpers_keep_voice_metadata_and_audio_content_type(self):
        worker = Worker()
        worker.settings = {'receiveOnly': False, 'typingEnabled': False}
        channel = SimpleNamespace(id=400000000000000008, guild=None, send=AsyncMock())
        captured = []
        async def send(channel_id, *, params):
            captured.append(json.loads(next(p['data'] for p in params.multipart if p['name'] == 'payload_json')))
            part = next(p for p in params.multipart if p['name'] == 'files[0]')
            self.assertEqual(part['content_type'], 'audio/ogg')
            self.assertEqual(part['data'].read(4), b'OggS')
            return {'id': '1580000000000000010'}
        worker.client = SimpleNamespace(is_ready=lambda: True, is_closed=lambda: False,
            user=SimpleNamespace(id=123), get_channel=lambda _: channel,
            http=SimpleNamespace(send_message=send))
        with tempfile.TemporaryDirectory(prefix='dsh-discord-voice-message-') as directory:
            file = Path(directory) / 'voice-message.ogg'
            file.write_bytes(b'OggS' + bytes(100))
            result = await worker.call('send', {'channelId': str(channel.id), 'options': {
                'files': [str(file)], 'voiceMessage': {'durationSecs': 1.25, 'waveform': 'AQI='}}})
        self.assertTrue(result['ok'])
        self.assertEqual(captured[0]['flags'], 8192)
        self.assertEqual(captured[0]['attachments'][0]['duration_secs'], 1.25)
        self.assertEqual(captured[0]['attachments'][0]['waveform'], 'AQI=')
        channel.send.assert_not_called()
