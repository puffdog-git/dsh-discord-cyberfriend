import sys
import unittest
import asyncio
import struct
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
from nacl.secret import Aead
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from voice_receive import VoiceReceive
from voice_pcm import PcmSource

USER = '400000000000000001'
KEY = bytes(range(32))


def rtp(body=b'opus', sequence=1, extension=False, protocol=0):
    header = bytearray(struct.pack('>BBHII', 0x90 if extension else 0x80, 120, sequence, 1000, 42))
    if extension:
        header.extend(struct.pack('>HH', 0xBEDE, 1))
        body = bytes(4) + body
    nonce = struct.pack('>I', sequence) + bytes(20)
    encrypted = Aead(KEY).encrypt(body, bytes(header), nonce).ciphertext
    return bytes(header) + encrypted + nonce[:4]


class ReceiveTests(unittest.IsolatedAsyncioTestCase):
    def fixture(self):
        voice = SimpleNamespace(mode='aead_xchacha20_poly1305_rtpsize', secret_key=KEY,
                                _connection=SimpleNamespace(dave_protocol_version=0), channel=SimpleNamespace(id='channel',guild=SimpleNamespace(id='guild')), is_connected=lambda: True)
        settings = {'voiceReceiveEnabled': True, 'voiceReceiveConsent': True, 'voiceReceiveUserIds': [USER], 'receiveOnly': False}
        client = SimpleNamespace(user=SimpleNamespace(id=1), is_ready=lambda: True)
        owner = SimpleNamespace(voice=voice, worker=SimpleNamespace(settings=settings, client=client))
        events = []
        receiver = VoiceReceive(owner, {'nonce': 'session-nonce', 'channelId': 'channel', 'guildId': 'guild'}, events.append)
        return receiver, owner, events

    async def test_authenticated_transport_and_encrypted_rtp_extension(self):
        r, owner, events = self.fixture()
        for extension in (False, True):
            body, seq = r.decrypt(owner.voice, rtp(extension=extension), USER)
            self.assertEqual(body, b'opus')
        bad = bytearray(rtp())
        bad[5] ^= 1
        with self.assertRaises(Exception):
            r.decrypt(owner.voice, bytes(bad), USER)
        owner.voice.mode = 'unsupported'
        with self.assertRaises(ValueError):
            r.decrypt(owner.voice, rtp(), USER)

    async def test_dave_uses_original_sender_and_never_falls_back_after_decryption_failure(self):
        r, owner, events = self.fixture()
        decrypt = Mock(return_value=b'decoded-opus')
        owner.voice._connection.dave_protocol_version = 1
        owner.voice._connection.dave_session = SimpleNamespace(decrypt=decrypt)
        self.assertEqual(r.decrypt(owner.voice, rtp(), USER)[0], b'decoded-opus')
        self.assertEqual(decrypt.call_args.args[0], int(USER))
        decrypt.side_effect = ValueError('invalid dave')
        with self.assertRaises(ValueError):
            r.decrypt(owner.voice, rtp(), USER)

    async def test_unauthorized_audio_is_not_decrypted_and_duplicate_packets_are_ignored(self):
        r, owner, events = self.fixture()
        await r.hook(None, {'op': 5, 'd': {'user_id': '999', 'ssrc': 42}})
        self.assertEqual(r.speakers, {})
        r.packet(rtp())
        self.assertEqual(r.pending, 0)
        await r.hook(None, {'op': 5, 'd': {'user_id': USER, 'ssrc': 42}})
        r.packet(rtp()); r.packet(rtp()); r.packet(rtp(sequence=2))
        await asyncio.sleep(0)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]['userId'], USER)
        self.assertEqual(events[0]['nonce'], 'session-nonce')
        owner.worker.settings['voiceReceiveConsent'] = False
        r.packet(rtp(sequence=3))
        await asyncio.sleep(0)
        self.assertEqual(len(events), 2)

    async def test_receiver_pending_bound_and_disconnect_close(self):
        r, owner, events = self.fixture()
        await r.hook(None, {'op': 5, 'd': {'user_id': USER, 'ssrc': 42}})
        for i in range(200):
            r.packet(rtp(sequence=i+1))
        self.assertEqual(r.pending, 128)
        r.close()
        await asyncio.sleep(0)
        self.assertEqual(events, [])

    async def test_pcm_exact_tail_is_drained_and_early_cleanup_never_claims_complete(self):
        s = PcmSource()
        s.feed(bytes(3844), 0)
        s.ended = True
        self.assertEqual(len(s.read()), 3840)
        self.assertEqual(len(s.read()), 3840)
        self.assertEqual(s.read(), b'')
        self.assertTrue(s.complete)
        s.cleanup()
        t = PcmSource();t.feed(bytes(3840), 0);t.read();t.cleanup()
        self.assertEqual(t.read(), b'')
        self.assertFalse(t.complete)

    async def test_pcm_backpressure_sequence_and_limits(self):
        s = PcmSource(max_seconds=10)
        for i in range(25):
            self.assertTrue(s.feed(bytes(3840), i))
        self.assertFalse(s.feed(bytes(3840), 25))
        self.assertEqual(s.sequence, 25)
        s.read()
        self.assertTrue(s.feed(bytes(3840), 25))
        with self.assertRaises(ValueError):
            s.feed(bytes(3840), 25)
        with self.assertRaises(ValueError):
            s.feed(bytes(3), 26)
        s.cleanup()
    async def test_room_move_drops_packets_before_audio_leaves_python(self):
        r, owner, events = self.fixture()
        await r.hook(None, {'op': 5, 'd': {'user_id': USER, 'ssrc': 42}})
        owner.voice.channel.id = 'different-room'
        r.packet(rtp())
        await asyncio.sleep(0)
        self.assertEqual(events, [])

from unittest.mock import AsyncMock
from worker import Worker
import discord


class ThreadTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_thread_creation_and_source_read_rechecks_mutation_policy(self):
        w = Worker()
        w.settings = {'receiveOnly': False, 'autoReply': True, 'dryRun': False}
        w.client = SimpleNamespace(user=SimpleNamespace(id=1), is_ready=lambda: True, is_closed=lambda: False)
        channel = Mock(spec=discord.TextChannel)
        message = SimpleNamespace(create_thread=AsyncMock(return_value=SimpleNamespace(id=123)))
        channel.fetch_message = AsyncMock(return_value=message)
        w.channel = AsyncMock(return_value=channel)
        args = {'channelId': '123', 'messageId': '456', 'name': '長議題', 'archiveMinutes': 1440,
                'options': {'expectedSelfId': '1'}}
        self.assertEqual((await w.call('thread_create', args))['threadId'], '123')
        message.create_thread.assert_awaited_once_with(name='長議題', auto_archive_duration=1440)
        async def revoke(_id):
            w.settings['receiveOnly'] = True
            return message
        channel.fetch_message = revoke
        with self.assertRaises(PermissionError):
            await w.call('thread_create', args)
        self.assertEqual(message.create_thread.await_count, 1)
