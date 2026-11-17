import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import Worker


class MemberVoiceChannelTests(unittest.TestCase):
    """點歌時自動加入：使用者帳號從 SDK 已下發的語音狀態查某位成員在哪個語音頻道，不另外發請求。"""

    GUILD = 900000000000000001
    ROOM = 900000000000000101

    def worker(self, members=None, states=None):
        w = Worker()
        members = members or {}
        states = states or {}
        guild = SimpleNamespace(
            id=self.GUILD,
            get_member=lambda uid: members.get(uid),
            _voice_state_for=lambda uid: states.get(uid),
        )
        w.client = SimpleNamespace(get_guild=lambda gid: guild if gid == guild.id else None)
        return w

    def test_member_in_voice_channel(self):
        member = SimpleNamespace(voice=SimpleNamespace(channel=SimpleNamespace(id=self.ROOM)))
        result = self.worker(members={11: member}).member_voice_channel({'guildId': str(self.GUILD), 'userId': '11'})
        self.assertEqual(result, {'ok': True, 'channelId': str(self.ROOM)})

    def test_member_not_in_voice_returns_empty(self):
        member = SimpleNamespace(voice=None)
        result = self.worker(members={11: member}).member_voice_channel({'guildId': str(self.GUILD), 'userId': '11'})
        self.assertEqual(result, {'ok': True, 'channelId': ''})

    def test_falls_back_to_guild_voice_states_when_member_not_cached(self):
        state = SimpleNamespace(channel=SimpleNamespace(id=self.ROOM))
        result = self.worker(states={12: state}).member_voice_channel({'guildId': str(self.GUILD), 'userId': '12'})
        self.assertEqual(result['channelId'], str(self.ROOM))

    def test_unknown_guild_and_bad_ids(self):
        w = self.worker()
        self.assertEqual(w.member_voice_channel({'guildId': '1', 'userId': '11'}), {'ok': False, 'error': 'unknown_guild'})
        self.assertEqual(w.member_voice_channel({'guildId': 'x', 'userId': '11'}), {'ok': False, 'error': 'invalid_id'})
        self.assertEqual(w.member_voice_channel({}), {'ok': False, 'error': 'invalid_id'})


if __name__ == '__main__':
    unittest.main()
