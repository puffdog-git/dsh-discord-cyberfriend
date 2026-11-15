"""Exercises production worker with the installed discord library and a network-free fake client."""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
import worker
import discord

SELF = 1560000000000000003
CHANNEL = 1560000000000000004


def snowflake():
    return (int(datetime.now(timezone.utc).timestamp() * 1000) - 1420070400000) << 22


class User:
    id = SELF
    name = display_name = 'fixture-self'
    bot = False

    def __str__(self):
        return self.name


class Message:
    def __init__(self, content, channel, author=None):
        self.id = snowflake()
        self.content = content
        self.channel = channel
        self.author = author or User()
        self.guild = None
        self.created_at = datetime.now(timezone.utc)
        self.mentions = self.attachments = self.stickers = self.embeds = []
        self.reference = None

    def to_reference(self, **kwargs):
        return {'message_id': str(self.id)}


class Channel:
    id = CHANNEL
    name = 'fixture-dm'
    type = 'private'
    guild = None
    recipient = User()

    def __init__(self):
        self.sent = []
        self.typing_posts = 0
        self._state = SimpleNamespace(loop=asyncio.get_running_loop(), http=SimpleNamespace(send_typing=self.send_typing))

    async def send_typing(self, channel_id):
        self.typing_posts += 1

    async def _get_channel(self):
        return self

    def typing(self):
        return discord.context_managers.Typing(self)

    async def send(self, **kwargs):
        message = Message(kwargs['content'], self)
        self.sent.append(message)
        return message

    async def fetch_message(self, message_id):
        if message_id == 1:
            raise ValueError('missing_quote')
        message = Message('incoming', self); message.id = message_id
        return message

    async def history(self, limit):
        for message in reversed(self.sent[-limit:]):
            yield message


class Client:
    def __init__(self):
        self.user = User(); self.guilds = []; self.channel = Channel()
        self.private_channels = [self.channel]; self.closed = False; self.online = False
        self.http = SimpleNamespace(ws_connect=self.unused_ws_connect)

    async def unused_ws_connect(self, *args, **kwargs):
        raise AssertionError('Fixture must not open network sockets')

    def event(self, fn):
        setattr(self, fn.__name__, fn)
        return fn

    async def start(self, token, reconnect):
        assert isinstance(reconnect, bool)
        if token == 'fixture-rejected':
            raise discord.LoginFailure('secret_should_never_appear')
        self.online = True
        await self.on_ready()
        await asyncio.sleep(0.15)
        author = User(); author.id = SELF + 3; author.name = author.display_name = 'fixture-sender'
        await self.on_message(Message('fixture question', self.channel, author))
        await asyncio.Future()

    def is_ready(self):
        return self.online

    def is_closed(self):
        return self.closed

    def get_channel(self, channel_id):
        return self.channel if channel_id == CHANNEL else None

    async def fetch_channel(self, channel_id):
        raise ValueError('unknown_channel')

    async def close(self):
        self.closed = True; self.online = False


discord.Client = Client
asyncio.run(worker.main())
