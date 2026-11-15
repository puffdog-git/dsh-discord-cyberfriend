"""Bounded conversation operations through the pinned SDK, never raw user-token HTTP."""
from datetime import datetime
import discord


def channel_info(c):
    parent = getattr(c, 'parent', None)
    tags = getattr(c, 'available_tags', [])
    return {'id': str(c.id), 'guildId': str(c.guild.id) if getattr(c, 'guild', None) else None,
            'type': getattr(getattr(c, 'type', None), 'value', -1), 'name': getattr(c, 'name', ''),
            'parentId': str(parent.id) if parent else str(c.parent_id) if getattr(c, 'parent_id', None) else None, 'archived': bool(getattr(c, 'archived', False)),
            'locked': bool(getattr(c, 'locked', False)), 'appliedTags': [str(t.id) for t in getattr(c, 'applied_tags', [])],
            'tags': [{'id': str(t.id), 'name': t.name} for t in tags][:100]}


async def execute(w, write, p, serialize):
    channel = await w.channel(p.get('channelId'))
    action = p.get('action')
    limit = max(1, min(20, int(p.get('limit') or 20)))
    if not write:
        if action == 'info':
            return {'ok': True, 'channel': channel_info(channel)}
        if action == 'search':
            query = str(p.get('query', '')).strip()
            if not query or len(query) > 200:
                raise ValueError('invalid_query')
            after, before = (datetime.fromisoformat(p[k].replace('Z', '+00:00')) for k in ('after', 'before'))
            if after.tzinfo is None or before.tzinfo is None or not 0 < (before-after).total_seconds() <= 366*86400:
                raise ValueError('invalid_time_range')
            rows = [serialize(m, w.client.user.id) async for m in channel.search(query, limit=limit, after=after, before=before)]
            return {'ok': True, 'messages': rows[:limit]}
        if action == 'posts':
            return {'ok': True, 'threads': [channel_info(t) for t in getattr(channel, 'threads', [])][:limit], 'cacheOnly': True, 'note': 'SDK 已下發的目前頻道貼文快取，不宣稱完整即時列表'}
        if action == 'archives':
            rows = [channel_info(t) async for t in channel.archived_threads(limit=limit)]
            return {'ok': True, 'threads': rows[:limit]}
        if action == 'members':
            if not isinstance(channel, discord.Thread):
                raise ValueError('not_thread')
            members = await channel.fetch_members()
            return {'ok': True, 'members': [{'userId': str(m.id)} for m in members[:50]], 'truncated': len(members)>50}
        raise ValueError('unsupported_read')
    async with w.mutations:
        def check():
            w.allow_write(False)
            if not w.settings.get('channelActionsEnabled', False) or w.settings.get('dryRun') or str(w.client.user.id) != p.get('expectedSelfId'):
                raise PermissionError('account_or_dryrun_changed')
        check()
        message = await channel.fetch_message(int(p['messageId'])) if action in ('pin','unpin','edit','delete','forward') else None
        if message and (message.content != p.get('expectedContent') or str(message.author.id) != p.get('expectedAuthorId')):
            raise PermissionError('source_changed')
        if message and action in ('edit','delete') and message.author.id != w.client.user.id:
            raise PermissionError('not_own_message')
        destination = await w.channel(p['destinationId']) if action == 'forward' else None
        if destination and (not channel.guild or not destination.guild or channel.guild.id != destination.guild.id):
            raise PermissionError('cross_guild_forward')
        tags = None
        if 'tags' in p:
            parent = getattr(channel, 'parent', None) if isinstance(channel, discord.Thread) else channel
            available = {str(t.id):t for t in getattr(parent, 'available_tags', [])}
            if len(p['tags'])>5 or any(i not in available for i in p['tags']):
                raise ValueError('invalid_forum_tags')
            tags = [available[i] for i in p['tags']]
        check()
        if action in ('pin','unpin'):
            await getattr(message, action)(reason='DSH confirmed conversation operation')
        elif action == 'edit':
            await message.edit(content=p['content'], allowed_mentions=discord.AllowedMentions.none())
        elif action == 'delete':
            await message.delete()
        elif action == 'forward':
            result = await message.forward(destination)
            return {'ok':True,'messageId':str(result.id)}
        elif action in ('join','leave'):
            if not isinstance(channel, discord.Thread):raise ValueError('not_thread')
            await getattr(channel, action)()
        elif action == 'thread_edit':
            if not isinstance(channel, discord.Thread):raise ValueError('not_thread')
            kwargs={k:p[k] for k in ('name','archived') if k in p}
            if tags is not None:kwargs['applied_tags']=tags
            await channel.edit(**kwargs, reason='DSH confirmed conversation operation')
        elif action == 'forum_create':
            if not isinstance(channel, discord.ForumChannel):raise ValueError('not_forum')
            result=await channel.create_thread(name=p['name'], content=p['content'], applied_tags=tags or [], allowed_mentions=discord.AllowedMentions.none())
            return {'ok':True,'threadId':str(result.thread.id),'messageId':str(result.message.id)}
        else:
            raise ValueError('unsupported_write')
        return {'ok':True}
