import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'bridge'))
import discord
from conversation_ops import execute,channel_info
from worker import Worker
UID=1560000000000000001
CID=400000000000000008
GID=400000000000000004
MID=1560000000000000012
class ConversationOpsTests(unittest.IsolatedAsyncioTestCase):
    def fixture(self,cls=discord.Thread):
        w=Worker();w.settings={'receiveOnly':False,'dryRun':False,'channelActionsEnabled':True};w.client=SimpleNamespace(user=SimpleNamespace(id=UID))
        channel=Mock(spec=cls);channel.id=CID;channel.guild=SimpleNamespace(id=GID);channel.type=SimpleNamespace(value=11 if cls==discord.Thread else 15);channel.name='Thread';channel.parent=None;channel.archived=False;channel.locked=False;channel.available_tags=[];channel.applied_tags=[]
        msg=SimpleNamespace(id=MID,content='Original',author=SimpleNamespace(id=UID),pin=AsyncMock(),unpin=AsyncMock(),edit=AsyncMock(),delete=AsyncMock(),forward=AsyncMock(return_value=SimpleNamespace(id=MID+1)))
        channel.fetch_message=AsyncMock(return_value=msg);channel.join=AsyncMock();channel.leave=AsyncMock();channel.edit=AsyncMock();channel.create_thread=AsyncMock(return_value=SimpleNamespace(thread=SimpleNamespace(id=CID+1),message=SimpleNamespace(id=MID+1)))
        w.channel=AsyncMock(return_value=channel)
        return w,channel,msg
    def params(self,action,**extra):return {'action':action,'channelId':str(CID),'messageId':str(MID),'expectedSelfId':str(UID),'expectedContent':'Original','expectedAuthorId':str(UID),**extra}
    async def test_scoped_search_passes_dates_and_limit_to_sdk_iterator(self):
        w,c,m=self.fixture();seen=[]
        async def search(query,**kwargs):
            seen.append((query,kwargs));yield m
        c.search=search
        p=self.params('search',query='agreement',limit=100,after='2026-11-01T00:00:00Z',before='2026-11-10T00:00:00Z')
        r=await execute(w,False,p,lambda msg,_:{'id':str(msg.id)})
        self.assertEqual(len(r['messages']),1);self.assertEqual(seen[0][1]['limit'],20);self.assertIsNotNone(seen[0][1]['after'].tzinfo)
    async def test_pin_unpin_edit_delete_call_native_sdk_and_suppress_mentions(self):
        for action in ('pin','unpin','edit','delete'):
            w,c,m=self.fixture();r=await execute(w,True,self.params(action,content='Corrected'),lambda *_:None)
            self.assertTrue(r['ok']);getattr(m,action).assert_awaited_once()
            if action=='edit':self.assertFalse(m.edit.call_args.kwargs['allowed_mentions'].everyone)
    async def test_source_change_other_author_and_settings_refuse_writes(self):
        for mode in ('content','author','dryrun','receiveonly','disabled','account'):
            w,c,m=self.fixture();p=self.params('edit',content='new')
            if mode=='content':m.content='Changed'
            elif mode=='author':m.author.id=123
            elif mode=='account':p['expectedSelfId']='wrong'
            elif mode=='dryrun':w.settings['dryRun']=True
            elif mode=='receiveonly':w.settings['receiveOnly']=True
            else:w.settings['channelActionsEnabled']=False
            with self.assertRaises(PermissionError):await execute(w,True,p,lambda *_:None)
            m.edit.assert_not_called()
    async def test_config_change_during_fetch_prevents_late_mutation(self):
        w,c,m=self.fixture()
        async def fetch(_):w.settings['channelActionsEnabled']=False;return m
        c.fetch_message=fetch
        with self.assertRaises(PermissionError):await execute(w,True,self.params('delete'),lambda *_:None)
        m.delete.assert_not_called()
    async def test_join_leave_and_thread_edit_native_routes(self):
        for action in ('join','leave','thread_edit'):
            w,c,m=self.fixture();r=await execute(w,True,self.params(action,name='New title',archived=True),lambda *_:None)
            self.assertTrue(r['ok']);getattr(c,'edit' if action=='thread_edit' else action).assert_awaited_once()
    async def test_native_forward_rechecks_guild_and_uses_sdk_forward(self):
        w,c,m=self.fixture();dest=SimpleNamespace(id=CID+1,guild=SimpleNamespace(id=GID));w.channel=AsyncMock(side_effect=[c,dest]);r=await execute(w,True,self.params('forward',destinationId=str(CID+1)),lambda *_:None)
        self.assertTrue(r['ok']);m.forward.assert_awaited_once_with(dest)
        w,c,m=self.fixture();dest.guild.id=GID+1;w.channel=AsyncMock(side_effect=[c,dest])
        with self.assertRaises(PermissionError):await execute(w,True,self.params('forward',destinationId=str(CID+1)),lambda *_:None)
        m.forward.assert_not_called()
    async def test_forum_create_uses_actual_tag_objects_and_suppresses_mentions(self):
        w,c,m=self.fixture(discord.ForumChannel);tag=SimpleNamespace(id=MID,name='tag');c.available_tags=[tag]
        r=await execute(w,True,self.params('forum_create',name='Post',content='Body',tags=[str(MID)]),lambda *_:None)
        self.assertEqual(r['threadId'],str(CID+1));self.assertEqual(c.create_thread.call_args.kwargs['applied_tags'],[tag]);self.assertFalse(c.create_thread.call_args.kwargs['allowed_mentions'].users)
        with self.assertRaises(ValueError):await execute(w,True,self.params('forum_create',name='bad',content='body',tags=['no-tag']),lambda *_:None)
    async def test_thread_members_and_archives_are_scoped_and_bounded_outputs(self):
        w,c,m=self.fixture();c.fetch_members=AsyncMock(return_value=[SimpleNamespace(id=i)for i in range(75)])
        r=await execute(w,False,self.params('members'),lambda *_:None);self.assertEqual(len(r['members']),50);self.assertTrue(r['truncated'])
        async def archives(**kw):
            self.assertEqual(kw['limit'],20)
            yield c
        c.archived_threads=archives;r=await execute(w,False,self.params('archives',limit=100),lambda *_:None);self.assertEqual(len(r['threads']),1)
if __name__=='__main__':unittest.main()
class MediaForumTests(unittest.IsolatedAsyncioTestCase):
    fixture = ConversationOpsTests.fixture
    params = ConversationOpsTests.params
    async def test_sdk_maps_media_channel_to_forum_engine(self):
        from discord.channel import _guild_channel_factory
        cls,kind=_guild_channel_factory(16)
        self.assertIs(cls,discord.ForumChannel);self.assertEqual(kind.value,16)
    async def test_media_uses_forum_create_tags_and_archive_path(self):
        w,c,m=self.fixture(discord.ForumChannel);c.type=discord.ChannelType.media;c.parent_id=None;c.threads=[]
        self.assertEqual(channel_info(c)['type'],16)
        r=await execute(w,False,self.params('posts'),lambda *_:None)
        self.assertTrue(r['cacheOnly']);self.assertEqual(r['threads'],[])
        r=await execute(w,True,self.params('forum_create',name='Media post',content='Media caption',tags=[]),lambda *_:None)
        self.assertTrue(r['ok']);c.create_thread.assert_awaited_once()

if __name__=='__main__':unittest.main()
