"""Voice output and explicitly consented, allowlisted receive for pinned discord.py-self."""
import asyncio
import contextlib
import importlib.util
from pathlib import Path


class VoiceOutput:
    def __init__(self, worker):
        self.worker = worker
        self.voice = None
        self.lock = asyncio.Lock()
        self.playing = False
        self.streams = {}
        self.receiver = None
        self.interrupted = False

    def status(self):
        return {'ok': True, 'available': all(importlib.util.find_spec(x) is not None for x in ('nacl', 'davey')),
                'receiveAvailable': all(importlib.util.find_spec(x) is not None for x in ('nacl', 'davey')), 'receiving': bool(self.receiver and not self.receiver.closed),
                'connected': bool(self.voice and self.voice.is_connected()), 'playing': self.playing,
                'channelId': str(self.voice.channel.id) if self.voice else None}

    async def handle(self, method, p):
        if method == 'voice_status':
            return self.status()
        if method in ('voice_stop', 'voice_leave'):
            for stream in self.streams.values():
                stream['source'].cleanup()
        if method == 'voice_stop':
            self.interrupted = True
            if self.voice:
                self.voice.stop()
            return {'ok': True}
        if method == 'voice_leave':
            if self.receiver:
                self.receiver.close()
                if self.voice:
                    self.voice._connection.remove_socket_listener(self.receiver.packet)
                self.receiver = None
            self.interrupted = True
            if self.voice:
                self.voice.stop()
                with contextlib.suppress(Exception):
                    await self.voice.disconnect(force=True)
            self.voice = None
            return {'ok': True}
        self.worker.allow_write(False)
        if self.worker.settings.get('dryRun', False):
            raise PermissionError('dry_run')
        if str(self.worker.client.user.id) != p.get('expectedSelfId'):
            raise PermissionError('account_changed')
        if method == 'voice_join':
            async with self.lock:
                if self.voice:
                    raise ValueError('voice_already_connected')
                if not self.status()['available']:
                    raise RuntimeError('voice_dependencies_missing')
                import discord
                channel = await self.worker.channel(p['channelId'])
                if not isinstance(channel, discord.VoiceChannel) or str(channel.guild.id) != p['guildId']:
                    raise ValueError('invalid_voice_channel')
                receive = p.get('receive') is True
                cls = discord.VoiceClient
                if receive:
                    if not self.worker.settings.get('voiceReceiveEnabled') or not self.worker.settings.get('voiceReceiveConsent') or not self.worker.settings.get('voiceReceiveUserIds'):
                        raise PermissionError('voice_receive_not_authorized')
                    from voice_receive import VoiceReceive
                    from discord.voice_state import VoiceConnectionState
                    from worker import emit
                    self.receiver = VoiceReceive(self, p, emit)
                    owner = self
                    class ReceivingVoiceClient(discord.VoiceClient):
                        def create_connection_state(self):
                            return VoiceConnectionState(self, hook=owner.receiver.hook)
                    cls = ReceivingVoiceClient
                try:
                    self.voice = await channel.connect(timeout=20, reconnect=False, self_deaf=not receive, cls=cls)
                    if receive:
                        if self.voice.mode != 'aead_xchacha20_poly1305_rtpsize':
                            raise RuntimeError('unsupported_receive_encryption')
                        self.voice._connection.add_socket_listener(self.receiver.packet)
                except Exception:
                    if self.receiver:
                        self.receiver.close()
                        self.receiver = None
                    if self.voice:
                        await self.voice.disconnect(force=True)
                        self.voice = None
                    raise
                return {'ok': True, **self.status()}
        if method.startswith('voice_stream_'):
            import base64
            if method == 'voice_stream_start':
                if not self.voice or not self.voice.is_connected() or self.playing:
                    raise RuntimeError('voice_not_ready')
                from voice_pcm import PcmSource
                import discord
                if not discord.opus.is_loaded() and not discord.opus._load_default():
                    raise RuntimeError('opus_encoder_not_available')
                key = p.get('streamId')
                if not isinstance(key, str) or len(key) != 36 or len(self.streams) >= 2:
                    raise ValueError('invalid_pcm_stream_id')
                source = PcmSource(min(7200, max(1, int(p.get('durationMs', 180000) / 1000))))
                loop = asyncio.get_running_loop()
                from worker import emit
                source.on_started = lambda: loop.call_soon_threadsafe(emit, {'event': 'voice_stream_started', 'nonce': p.get('nonce'), 'streamId': key})
                done = loop.create_future()
                def after(error):
                    def finish():
                        if not done.done():
                            done.set_result({'ok': not error and source.complete, 'started': source.started,
                                             'error': None if not error and source.complete else 'PCM播放已中斷或來源未完整結束'})
                        self.playing = False
                    loop.call_soon_threadsafe(finish)
                record = {'source': source, 'done': done}
                self.streams[key] = record
                self.playing = True
                try:
                    self.voice.play(source, after=after, application='audio', signal_type='music')
                except Exception:
                    self.playing = False
                    self.streams.pop(key, None)
                    source.cleanup()
                    raise
                return {'ok': True}
            record = self.streams.get(p.get('streamId'))
            if not record:
                raise ValueError('unknown_pcm_stream')
            if method == 'voice_stream_write':
                data = base64.b64decode(p.get('pcm', ''), validate=True)
                accepted = record['source'].feed(data, p.get('sequence'))
                return {'ok': True, 'accepted': accepted, 'started': record['source'].started}
            if method == 'voice_stream_end':
                record['source'].ended = True
                return {'ok': True}
            if method == 'voice_stream_wait':
                try:
                    return await asyncio.wait_for(asyncio.shield(record['done']), min(7215, p.get('durationMs', 180000) / 1000 + 15))
                finally:
                    record['source'].cleanup()
                    self.streams.pop(p.get('streamId'), None)
            raise ValueError('unknown_pcm_stream_method')
        if method == 'voice_play':
            if not self.voice or not self.voice.is_connected() or self.playing:
                raise RuntimeError('voice_not_ready')
            import discord
            path = Path(p['path']).resolve()
            # Only plugin-created Opus files, not arbitrary URLs or shell commands.
            import tempfile
            root = Path(tempfile.gettempdir()).resolve()
            if path.parent.parent != root or not path.parent.name.startswith('dsh-discord-opus-') or path.name != 'voice.ogg' or not path.is_file():
                raise ValueError('invalid_voice_audio')
            executable = Path(p['ffmpeg']).resolve()
            if not executable.is_file():
                raise ValueError('ffmpeg_missing')
            loop = asyncio.get_running_loop()
            done = loop.create_future()
            def after(error):
                def finish():
                    if not done.done():
                        done.set_result(error)
                loop.call_soon_threadsafe(finish)
            self.playing = True
            self.interrupted = False
            source = None
            try:
                source = discord.FFmpegOpusAudio(str(path), executable=str(executable), codec='copy', options='-vn -loglevel error')
                self.voice.play(source, after=after)
                error = await asyncio.wait_for(done, min(7200, p.get('durationMs', 60000) / 1000) + 15)
                return {'ok': not error and not self.interrupted, 'interrupted': self.interrupted,
                        'error': '語音播放中斷' if error or self.interrupted else None}
            finally:
                if self.voice:
                    self.voice.stop()
                if source:
                    source.cleanup()
                self.playing = False
        raise ValueError('unsupported_voice_method')
