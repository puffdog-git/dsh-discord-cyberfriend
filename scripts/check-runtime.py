"""Offline compatibility check; does not authenticate or contact Discord."""
import importlib.metadata
import inspect
import json
import discord
from PIL import Image

version = importlib.metadata.version('discord.py-self')
assert version == discord.__version__ == '2.1.0', 'Unexpected discord package/version'
for owner, member in [(discord.Client, 'start'), (discord.Client, 'close'),
                      (discord.Client, 'fetch_channel'), (discord.abc.Messageable, 'send'),
                      (discord.abc.Messageable, 'history'), (discord.Message, 'to_reference')]:
    assert callable(getattr(owner, member)), member
assert 'reconnect' in inspect.signature(discord.Client.start).parameters
assert 'allowed_mentions' in inspect.signature(discord.abc.Messageable.send).parameters
assert 'reference' in inspect.signature(discord.abc.Messageable.send).parameters
assert importlib.metadata.version('Pillow') == '13.0.0'
assert callable(Image.open)
from rlottie_python import LottieAnimation
assert importlib.metadata.version('rlottie-python') == '1.3.8'
assert callable(LottieAnimation.from_data)
print(json.dumps({'ok': True, 'library': 'discord.py-self', 'version': version, 'networkUsed': False}))
