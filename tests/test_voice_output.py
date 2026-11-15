import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import Worker
from voice_output import VoiceOutput
import discord
import subprocess
import tempfile

CH = '400000000000000005'
G = '400000000000000004'


class VoiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_ffmpeg_opus_source_without_loading_an_opus_dll(self):
        exe = Path(__file__).resolve().parents[1] / 'node_modules/ffmpeg-static/ffmpeg.exe'
        result = subprocess.run([str(exe), '-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i',
                                 'anullsrc=r=48000:cl=stereo', '-t', '0.1', '-c:a', 'libopus', '-f', 'ogg', 'pipe:1'],
                                capture_output=True, timeout=10, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.assertEqual(result.returncode, 0)
        with tempfile.TemporaryDirectory(prefix='dsh-discord-opus-') as directory:
            path = Path(directory) / 'voice.ogg'
            path.write_bytes(result.stdout)
            source = discord.FFmpegOpusAudio(str(path), executable=str(exe), codec='copy', options='-loglevel error')
            try:
                self.assertTrue(source.is_opus())
                self.assertTrue(source.read())
            finally:
                source.cleanup()

    def fixture(self):
        w = Worker()
        w.settings = {'receiveOnly': False, 'dryRun': False}
        w.client = SimpleNamespace(user=SimpleNamespace(id=1), is_ready=lambda: True, is_closed=lambda: False)
        return w, VoiceOutput(w)

    async def test_installed_voice_dependencies_and_normal_flow_keep_self_deaf(self):
        w, v = self.fixture()
        self.assertTrue(v.status()['available'])
        voice = SimpleNamespace(channel=SimpleNamespace(id=int(CH)), is_connected=lambda: True, stop=Mock(), disconnect=AsyncMock())
        channel = Mock(spec=discord.VoiceChannel)
        channel.guild = SimpleNamespace(id=int(G))
        channel.connect = AsyncMock(return_value=voice)
        w.channel = AsyncMock(return_value=channel)
        result = await v.handle('voice_join', {'expectedSelfId': '1', 'channelId': CH, 'guildId': G})
        self.assertTrue(result['connected'])
        self.assertTrue(channel.connect.call_args.kwargs['self_deaf'])
        self.assertFalse(channel.connect.call_args.kwargs['reconnect'])
        await v.handle('voice_leave', {})
        voice.disconnect.assert_awaited_once()
        self.assertFalse(v.status()['connected'])

    async def test_observation_dry_run_and_account_change_block_voice_mutations(self):
        w, v = self.fixture()
        for setting in ('receiveOnly', 'dryRun'):
            w.settings[setting] = True
            with self.assertRaises(PermissionError):
                await v.handle('voice_join', {'expectedSelfId': '1'})
            w.settings[setting] = False
        with self.assertRaises(PermissionError):
            await v.handle('voice_join', {'expectedSelfId': 'other'})

    async def test_stop_and_leave_work_even_when_main_client_is_not_ready(self):
        w, _ = self.fixture()
        w.client.is_ready = lambda: False
        v = VoiceOutput(w)
        v.voice = SimpleNamespace(stop=Mock(), disconnect=AsyncMock())
        w.voice_output = v
        self.assertTrue((await w.call('voice_stop', {}))['ok'])
        self.assertTrue((await w.call('voice_leave', {}))['ok'])
        self.assertIsNone(v.voice)

    async def test_voice_player_rejects_arbitrary_file_and_network_sources_before_ffmpeg(self):
        w, v = self.fixture()
        v.voice = SimpleNamespace(is_connected=lambda: True, play=Mock())
        for path in ('https://example.com/audio', str(Path(__file__).resolve())):
            with self.assertRaises(ValueError):
                await v.handle('voice_play', {'expectedSelfId': '1', 'path': path, 'ffmpeg': 'ffmpeg'})
        v.voice.play.assert_not_called()
