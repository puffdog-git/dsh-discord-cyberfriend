"""Pinned discord.py-self 2.1 voice receive bridge. No files or STT here."""
import asyncio
import base64
import struct
import time


class VoiceReceive:
    def __init__(self, owner, options, emit):
        self.owner, self.options, self.emit = owner, options, emit
        self.loop = asyncio.get_running_loop()
        self.speakers, self.sequence = {}, {}
        self.closed, self.pending, self.dropped = False, 0, 0
        self.last_error = 0

    def allowed(self, user):
        settings = self.owner.worker.settings
        return (not self.closed and self.owner.worker.client.is_ready() and not settings.get('receiveOnly', True)
                and not settings.get('dryRun', False) and settings.get('voiceReceiveEnabled', False)
                and settings.get('voiceReceiveConsent', False)
                and str(user) in settings.get('voiceReceiveUserIds', [])
                and str(user) != str(self.owner.worker.client.user.id))

    async def hook(self, ws, packet):
        data = packet.get('d', {})
        if packet.get('op') == 5 and self.allowed(data.get('user_id')):
            ssrc = data.get('ssrc')
            if isinstance(ssrc, int) and (len(self.speakers) < 128 or ssrc in self.speakers):
                self.speakers[ssrc] = str(data['user_id'])
        elif packet.get('op') == 13:
            self.speakers = {k: v for k, v in self.speakers.items() if v != str(data.get('user_id'))}

    def packet(self, packet):
        if self.closed or len(packet) < 32 or len(packet) > 4096 or packet[0] >> 6 != 2 or packet[1] & 127 != 120:
            return
        ssrc = struct.unpack_from('>I', packet, 8)[0]
        user = self.speakers.get(ssrc)
        if not user or not self.allowed(user) or self.pending >= 128:
            return
        self.pending += 1
        self.loop.call_soon_threadsafe(self.decode, bytes(packet), user, ssrc)

    def decode(self, packet, user, ssrc):
        self.pending -= 1
        if not self.allowed(user):
            return
        voice = self.owner.voice
        if not voice or not voice.is_connected() or str(voice.channel.id) != self.options['channelId'] or str(voice.channel.guild.id) != self.options['guildId']:
            return
        try:
            opus, seq = self.decrypt(voice, packet, user)
            last = self.sequence.get(ssrc)
            if last is not None and not 0 < (seq - last) % 65536 < 32768:
                return
            self.sequence[ssrc] = seq
            if len(opus) > 4000 or not opus:
                return
            self.emit({'event': 'voice_opus', 'nonce': self.options['nonce'],
                       'accountId': str(self.owner.worker.client.user.id), 'userId': user,
                       'channelId': self.options['channelId'], 'guildId': self.options['guildId'],
                       'opus': base64.b64encode(opus).decode('ascii')})
        except Exception:
            if time.monotonic() - self.last_error > 5:
                self.last_error = time.monotonic()
                self.emit({'event': 'voice_receive_error', 'nonce': self.options['nonce'],
                           'reason': '語音封包未通過解密或格式驗證'})

    @staticmethod
    def decrypt(voice, packet, user):
        # Modern RTP-size mode authenticates the clear RTP + extension header.
        if voice.mode != 'aead_xchacha20_poly1305_rtpsize':
            raise ValueError('unsupported_receive_encryption')
        from nacl.secret import Aead
        header_size = 12 + 4 * (packet[0] & 15)
        extension_size = 0
        if packet[0] & 16:
            if len(packet) < header_size + 4:
                raise ValueError('invalid_extension')
            extension_size = struct.unpack_from('>H', packet, header_size + 2)[0] * 4
            header_size += 4
        if len(packet) <= header_size + 20:
            raise ValueError('short_packet')
        payload = Aead(bytes(voice.secret_key)).decrypt(packet[header_size:-4], packet[:header_size], packet[-4:] + bytes(20))
        if extension_size > len(payload):
            raise ValueError('invalid_extension_size')
        payload = payload[extension_size:]
        if packet[0] & 32:
            padding = payload[-1] if payload else 0
            if not padding or padding > len(payload):
                raise ValueError('invalid_padding')
            payload = payload[:-padding]
        state = voice._connection
        if state.dave_protocol_version:
            import davey
            if state.dave_session is None:
                raise ValueError('dave_not_ready')
            payload = bytes(state.dave_session.decrypt(int(user), davey.MediaType.audio, payload))
        return payload, struct.unpack_from('>H', packet, 2)[0]

    def close(self):
        self.closed = True
        self.speakers.clear()
        self.sequence.clear()
