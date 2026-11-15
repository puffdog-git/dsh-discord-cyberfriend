import asyncio
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import Worker


class EmojiListTests(unittest.TestCase):
    """表情選擇器：使用者帳號從 SDK 已下發的伺服器資料列出自訂表情，不另外發請求。"""

    def worker(self):
        w = Worker()
        emojis = [
            SimpleNamespace(id=101, name='pepe', animated=False, available=True),
            SimpleNamespace(id=102, name='dance', animated=True, available=True),
            SimpleNamespace(id=103, name='locked', animated=False, available=False),
        ]
        guild = SimpleNamespace(id=900000000000000001, name='測試伺服器', emojis=emojis)
        w.client = SimpleNamespace(guilds=[guild], get_guild=lambda gid: guild if gid == guild.id else None)
        return w

    def call(self, w, params):
        return asyncio.run(w.list_emojis(params))

    def test_lists_guild_emojis_with_codes(self):
        result = self.call(self.worker(), {'guildId': '900000000000000001'})
        self.assertTrue(result['ok'])
        self.assertEqual([e['code'] for e in result['emojis']], ['<:pepe:101>', '<a:dance:102>', '<:locked:103>'])
        self.assertEqual(result['emojis'][1]['url'], 'https://cdn.discordapp.com/emojis/102.gif?size=48')
        self.assertEqual(result['emojis'][0]['url'], 'https://cdn.discordapp.com/emojis/101.webp?size=48')
        self.assertFalse(result['emojis'][2]['available'])

    def test_unknown_or_invalid_guild_is_rejected(self):
        self.assertFalse(self.call(self.worker(), {'guildId': '123'})['ok'])
        self.assertFalse(self.call(self.worker(), {'guildId': 'abc'})['ok'])


if __name__ == '__main__':
    unittest.main()
