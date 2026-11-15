import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import Worker, member_name_event
UID=400000000000000001
GID=400000000000000004
CH=400000000000000008
class NamesPinsTests(unittest.IsolatedAsyncioTestCase):
    def test_event_preserves_explicit_nickname_removal_and_global_fields(self):
        user=SimpleNamespace(id=UID,name='name',global_name='Global',nick=None)
        self.assertEqual(member_name_event(user,GID)['guildNickname'],None)
        self.assertNotIn('guildNickname',member_name_event(user))
        self.assertEqual(member_name_event(user,GID)['displayName'],'Global')
    async def test_member_lookup_uses_cache_without_full_guild_fetch(self):
        user=SimpleNamespace(id=UID,name='name',global_name='Global',nick='Nick')
        guild=SimpleNamespace(get_member=lambda uid:user if uid==UID else None)
        worker=Worker();worker.client=SimpleNamespace(get_guild=lambda gid:guild if gid==GID else None,get_user=lambda uid:None)
        row=await worker.call('member_name',{'guildId':str(GID),'userId':str(UID)})
        self.assertTrue(row['ok']);self.assertEqual(row['author']['guildNickname'],'Nick')
        with self.assertRaises(ValueError):await worker.call('member_name',{'guildId':'not-id','userId':str(UID)})
        self.assertFalse((await worker.call('member_name',{'userId':str(UID)}))['ok'])
    async def test_pins_are_bounded_async_iterator_and_readonly(self):
        worker=Worker();worker.settings={'receiveOnly':True};worker.client=SimpleNamespace(user=SimpleNamespace(id=UID))
        observed=[]
        class Channel:
            async def pins(self,*,limit):
                observed.append(limit)
                for i in range(limit):yield {'id':str(i)}
        worker.channel=AsyncMock(return_value=Channel())
        with patch('worker.message_dict',side_effect=lambda m,_:m):
            result=await worker.call('pins',{'channelId':str(CH),'limit':999})
        self.assertEqual(len(result['messages']),20);self.assertEqual(observed,[21]);self.assertTrue(result['hasMore'])
if __name__=='__main__':unittest.main()
