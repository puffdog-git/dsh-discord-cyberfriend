import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import message_dict, content_changed
import discord


class MessagePayloadTests(unittest.TestCase):
    def message(self, **extra):
        values = dict(id=111, guild=None, channel=SimpleNamespace(id=222, name='dm', type='private'),
                      author=SimpleNamespace(id=333, display_name='sender', bot=False), content='',
                      created_at=datetime.now(timezone.utc), mentions=[], reference=None,
                      attachments=[], stickers=[], embeds=[])
        values.update(extra)
        return SimpleNamespace(**values)

    def test_sticker_and_gif_metadata_survive_python_json_payload(self):
        embed = discord.Embed(type='gifv', title='Dancing Cat', url='https://tenor.com/view/cat-gif-123')
        embed.set_image(url='https://example.test/cat.gif')
        m = self.message(stickers=[SimpleNamespace(id=444, name='開心貓咪')],
                         attachments=[SimpleNamespace(id=555, url='https://example.test/a.gif', filename='a.gif', size=42, content_type='image/gif')],
                         embeds=[embed])
        data = message_dict(m, 999)
        self.assertEqual(data['stickers'][0]['name'], '開心貓咪')
        self.assertEqual(data['attachments'][0]['contentType'], 'image/gif')
        self.assertEqual(data['embedDetails'][0]['title'], 'Dancing Cat')

    def test_guild_mention_and_reference_target_are_preserved(self):
        m = self.message(guild=SimpleNamespace(id=888, name='guild'), mentions=[SimpleNamespace(id=999, display_name='self')],
                         reference=SimpleNamespace(message_id=777, resolved=SimpleNamespace(author=SimpleNamespace(id=999))))
        data = message_dict(m, 999)
        self.assertFalse(data['isDm'])
        self.assertTrue(data['isMention'])
        self.assertEqual(data['replyToAuthorId'], '999')

    def test_group_dm_is_distinct_from_one_to_one_dm(self):
        m = self.message(channel=SimpleNamespace(id=222, type=discord.ChannelType.group, name='group'))
        data = message_dict(m, 999)
        self.assertTrue(data['isDm'])
        self.assertTrue(data['isGroupDm'])

    def test_full_gif_preview_update_is_not_a_content_edit(self):
        data = {'content': 'https://tenor.com/view/cat', 'attachments': [], 'edited_timestamp': None,
                'embeds': [{'type': 'gifv', 'title': 'cat'}]}
        before = self.message(content=data['content'])
        payload = SimpleNamespace(data=data, cached_message=before)
        self.assertFalse(content_changed(payload))
        payload.cached_message = None
        self.assertFalse(content_changed(payload))
        payload.cached_message = before
        payload.data = {**data, 'content': 'I edited the message'}
        self.assertTrue(content_changed(payload))

    def test_attachment_changes_cancel_but_signed_url_refreshes_do_not(self):
        before = self.message(attachments=[SimpleNamespace(id=123, filename='a.gif', size=42)])
        payload = SimpleNamespace(cached_message=before, data={'attachments': [{'id':'123','filename':'a.gif','size':42,'url':'new signed url'}]})
        self.assertFalse(content_changed(payload))
        payload.data = {'attachments': []}
        self.assertTrue(content_changed(payload))


if __name__ == '__main__':
    unittest.main()
