"""Newline JSON over private process pipes. No HTTP listener, credential arguments or raw logs."""
import asyncio
import contextlib
import importlib.metadata
import json
import logging
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit


def member_name_event(user, guild_id=None):
    row = {'event': 'member_name_update', 'userId': str(user.id),
           'username': user.name, 'displayName': getattr(user, 'global_name', None)}
    if guild_id:
        row.update(guildId=str(guild_id), guildNickname=getattr(user, 'nick', None))
    return row


class ReconnectLimitError(Exception):
    pass


class GatewayConnectError(Exception):
    def __init__(self, exc):
        self.status = getattr(exc, 'status', None)


def transient_error(exc):
    import discord
    from curl_cffi import CurlError
    if isinstance(exc, discord.HTTPException):
        return exc.status in (429, 500, 502, 503, 504)
    if isinstance(exc, CurlError):
        return exc.code in (5, 6, 7, 18, 28, 35, 52, 55, 56)
    return isinstance(exc, (OSError, asyncio.TimeoutError, discord.GatewayNotFound))


def error_details(exc):
    import discord
    from curl_cffi import CurlError
    details = {'code': type(exc).__name__}
    value = getattr(exc, 'code', None)
    if isinstance(value, int):
        if isinstance(exc, discord.ConnectionClosed):
            details['closeCode'] = value
        elif isinstance(exc, CurlError):
            details['curlCode'] = value
    status = getattr(exc, 'status', None)
    if isinstance(status, int):
        details['httpStatus'] = status
    return details

logging.disable(logging.CRITICAL)
sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + '\n')
    sys.stdout.flush()


def message_dict(message, self_id):
    guild = message.guild
    reference = getattr(message.reference, 'resolved', None) or getattr(message.reference, 'cached_message', None)
    return {
        'id': str(message.id), 'channelId': str(message.channel.id),
        'channelName': getattr(message.channel, 'name', '') or '',
        'guildId': str(guild.id) if guild else None, 'guildName': guild.name if guild else '',
        'author': {'id': str(message.author.id), 'name': message.author.display_name,
                   'username': getattr(message.author, 'name', ''),
                   'displayName': getattr(message.author, 'global_name', None) or getattr(message.author, 'name', '') or message.author.display_name,
                   'guildNickname': getattr(message.author, 'nick', None) if guild else None,
                   'tag': str(message.author), 'bot': message.author.bot},
        'content': message.content, 'ts': message.created_at.isoformat(),
        'isVoiceMessage': bool(getattr(message.flags, 'value', 0) & 8192) if hasattr(message, 'flags') else False,
        'isDm': guild is None, 'isGroupDm': str(getattr(message.channel, 'type', '')) == 'group',
        'isMention': any(u.id == self_id for u in message.mentions),
        'replyToAuthorId': str(reference.author.id) if getattr(reference, 'author', None) else None,
        'replyTo': str(message.reference.message_id) if message.reference and message.reference.message_id else None,
        'attachments': [{'id': str(a.id), 'url': a.url, 'name': a.filename, 'size': a.size,
                         'contentType': getattr(a, 'content_type', '') or '', 'durationSecs': getattr(a, 'duration', None)} for a in message.attachments],
        'stickers': [{'id': str(s.id), 'name': s.name, 'description': getattr(s, 'description', '') or '', 'format_type': getattr(getattr(s, 'format', None), 'value', None)} for s in message.stickers],
        'mentions': [{'id': str(u.id), 'name': u.display_name} for u in message.mentions],
        'embeds': len(message.embeds),
        'embedDetails': [e.to_dict() for e in message.embeds[:5]],
    }


def content_changed(payload):
    data = payload.data
    before = getattr(payload, 'cached_message', None)
    if before is not None:
        if 'content' in data and data['content'] != before.content:
            return True
        if 'attachments' in data:
            previous = [(str(a.id), a.filename, a.size) for a in before.attachments]
            current = [(str(a['id']), a.get('filename'), a.get('size')) for a in data['attachments']]
            if previous != current:
                return True
        if 'sticker_items' in data and [str(s.id) for s in before.stickers] != [str(s['id']) for s in data['sticker_items']]:
            return True
        return False
    # Discord often sends a full message with unchanged content and null edited_timestamp
    # when its link preview finishes loading. That is not an author edit.
    if 'embeds' in data and 'edited_timestamp' in data and data['edited_timestamp'] is None:
        return False
    return bool(data.get('edited_timestamp')) or any(key in data for key in ('content', 'attachments', 'sticker_items'))


class Worker:
    def __init__(self):
        self.client = None
        self.session_task = None
        self.settings = {'receiveOnly': True, 'autoReply': False}
        self.mutations = asyncio.Lock()
        self.plugin_nonces = {}
        self.plugin_message_ids = {}  # 依插入順序保存（當作有序集合），超過上限時淘汰最舊的
        self.plugin_message_limit = 10000
        self.standard_stickers = {}
        self.sticker_catalog_until = 0
        self.typing_jobs = {}
        self.typing_leases = {}
        self.recovery_task = None
        self.connect_attempts = 0
        self.cancelled_replies = set()
        self.voice_output = None

    def recovered(self):
        self.connect_attempts = 0
        if self.recovery_task:
            self.recovery_task.cancel()
            self.recovery_task = None

    def begin_recovery(self):
        if self.recovery_task or not self.settings.get('reconnect', True):
            return
        async def expire():
            await asyncio.sleep(90)
            emit({'event': 'error', 'code': 'ReconnectLimitError'})
            if self.session_task:
                self.session_task.cancel()
        self.recovery_task = asyncio.create_task(expire())

    @staticmethod
    def main_gateway(url):
        """是不是 Discord 的主連線（gateway…discord.gg）。語音房的連線走別的主機（…discord.media）。"""
        return (urlsplit(str(url)).hostname or '').endswith('.discord.gg')

    async def open_socket(self, connect, url, **kwargs):
        # 「5 次連接嘗試」的上限只管主連線的斷線重連。語音房的連線也經過同一個入口，
        # 原本每進一次語音房就被算一次，而且只有主連線重新就緒時才歸零——
        # 實機：一個晚上進出語音房幾次之後，就再也進不了語音房（ReconnectLimitError）。
        # 語音連線有上游自己的重試，這裡不計數、不套用上限。
        if not self.main_gateway(url):
            return await connect(url, **kwargs)
        emit({'event': 'gateway_connect', 'host': urlsplit(str(url)).hostname or ''})
        return await self.connect_gateway(connect, url, **kwargs)

    async def connect_gateway(self, connect, url, **kwargs):
        # Finish before upstream's 60-second initial socket timeout; its recovery
        # path assumes an existing websocket when attempting session RESUME.
        try:
            async with asyncio.timeout(50):
                return await self.retry_gateway(connect, url, **kwargs)
        except asyncio.TimeoutError:
            raise ReconnectLimitError() from None

    async def retry_gateway(self, connect, url, **kwargs):
        # Bound connection attempts while retaining upstream's session RESUME protocol.
        while True:
            self.connect_attempts += 1
            if self.connect_attempts > 5:
                raise ReconnectLimitError()
            try:
                return await connect(url, **kwargs)
            except Exception as exc:
                if not self.settings.get('reconnect', True):
                    raise
                if not transient_error(exc):
                    # Do not let Client.connect turn a rejected handshake into retries.
                    raise GatewayConnectError(exc) from None
                if self.connect_attempts >= 5:
                    raise ReconnectLimitError() from None
                self.begin_recovery()
                emit({'event': 'reconnecting', 'attempt': self.connect_attempts, **error_details(exc)})
                await asyncio.sleep(min(2 ** self.connect_attempts, 16))

    async def stop_typing(self, typing_id):
        channel_id = self.typing_leases.pop(typing_id, None)
        job = self.typing_jobs.get(channel_id)
        if job:
            job['leases'].discard(typing_id)
            if not job['leases']:
                job['task'].cancel()
                await asyncio.gather(job['task'], return_exceptions=True)
                if self.typing_jobs.get(channel_id) is job:
                    self.typing_jobs.pop(channel_id, None)
        return {'ok': True}

    async def stop_all_typing(self):
        tasks = [job['task'] for job in self.typing_jobs.values()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self.typing_jobs.clear()
        self.typing_leases.clear()

    def allow_typing(self, options):
        self.allow_write(bool(options.get('autoReply')))
        if self.settings.get('dryRun', False) or not self.settings.get('typingEnabled', True):
            raise PermissionError('typing_disabled')
        if options.get('expectedSelfId') and options['expectedSelfId'] != str(self.client.user.id):
            raise PermissionError('account_changed')

    async def run_typing(self, channel_id, job, options):
        try:
            channel = await self.channel(channel_id)
            self.allow_typing(options)
            # One upstream renewal task per channel, shared by concurrent replies.
            async with channel.typing():
                emit({'event': 'typing', 'state': 'started'})
                await asyncio.sleep(120)  # Bound orphaned leases if the host never releases them.
        except asyncio.CancelledError:
            raise
        except Exception:
            emit({'event': 'typing', 'state': 'failed'})
        finally:
            if self.typing_jobs.get(channel_id) is job:
                self.typing_jobs.pop(channel_id, None)
            for lease in job['leases']:
                self.typing_leases.pop(lease, None)
            emit({'event': 'typing', 'state': 'stopped'})

    async def start_typing(self, params):
        options = params.get('options', {})
        self.allow_typing(options)
        channel_id = str(params.get('channelId', ''))
        if not channel_id.isdecimal() or not 15 <= len(channel_id) <= 22:
            raise ValueError('invalid_channel_id')
        lease = uuid.uuid4().hex
        job = self.typing_jobs.get(channel_id)
        if not job:
            job = {'leases': set()}
            self.typing_jobs[channel_id] = job
            job['task'] = asyncio.create_task(self.run_typing(channel_id, job, options))
        job['leases'].add(lease)
        self.typing_leases[lease] = channel_id
        return {'ok': True, 'typingId': lease}

    def allow_write(self, automated=False):
        if self.settings.get('receiveOnly', True):
            raise PermissionError('receive_only')
        if automated and not self.settings.get('autoReply', False):
            raise PermissionError('auto_reply_disabled')

    async def session(self, token):
        try:
            self.begin_recovery()
            await self.client.start(token, reconnect=self.settings.get('reconnect', True))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            emit({'event': 'error', **error_details(exc)})
        finally:
            self.recovered()
            await self.stop_all_typing()
            await self.client.close()
            emit({'event': 'disconnected', 'terminal': True})

    def remember_plugin_message(self, message_id):
        key = str(message_id)
        self.plugin_message_ids.pop(key, None)
        self.plugin_message_ids[key] = True
        while len(self.plugin_message_ids) > self.plugin_message_limit:
            del self.plugin_message_ids[next(iter(self.plugin_message_ids))]

    async def message_origin(self, message):
        if message.author.id != self.client.user.id:
            return None
        nonce = str(getattr(message, 'nonce', '') or '')
        if not nonce:
            await asyncio.sleep(0.4)
        pending = any(asyncio.get_running_loop().time() - at < 300 for at in self.plugin_nonces.values())
        return 'plugin' if nonce in self.plugin_nonces or str(message.id) in self.plugin_message_ids else ('manual' if nonce or not pending else 'unknown')

    async def channel(self, channel_id):
        channel_id = str(channel_id)
        if not channel_id.isdecimal() or not 15 <= len(channel_id) <= 22:
            raise ValueError('invalid_channel_id')
        return self.client.get_channel(int(channel_id)) or await self.client.fetch_channel(int(channel_id))

    def member_voice_channel(self, params):
        """某位成員目前所在的語音頻道；只讀 SDK 已下發的語音狀態，不另外發請求、不加入頻道。"""
        guild_id, user_id = str(params.get('guildId', '')), str(params.get('userId', ''))
        if not (guild_id.isdecimal() and user_id.isdecimal()):
            return {'ok': False, 'error': 'invalid_id'}
        guild = self.client.get_guild(int(guild_id))
        if guild is None:
            return {'ok': False, 'error': 'unknown_guild'}
        member = guild.get_member(int(user_id))
        state = getattr(member, 'voice', None) if member is not None else None
        if state is None:
            lookup = getattr(guild, '_voice_state_for', None)
            state = lookup(int(user_id)) if callable(lookup) else None
        channel = getattr(state, 'channel', None)
        return {'ok': True, 'channelId': str(channel.id) if channel is not None else ''}

    async def list_emojis(self, params):
        """伺服器的自訂表情（給設定介面的表情選擇器）；只讀 SDK 已下發的資料，不另外發請求。"""
        raw = str(params.get('guildId', ''))
        guild = self.client.get_guild(int(raw)) if raw.isdigit() else None
        if guild is None:
            return {'ok': False, 'error': '找不到這個伺服器'}
        rows = []
        for emoji in list(getattr(guild, 'emojis', []))[:500]:
            animated = bool(getattr(emoji, 'animated', False))
            name = str(getattr(emoji, 'name', '') or 'emoji')
            rows.append({
                'id': str(emoji.id), 'name': name, 'animated': animated,
                'available': bool(getattr(emoji, 'available', True)),
                'code': f"<{'a' if animated else ''}:{name}:{emoji.id}>",
                'url': f"https://cdn.discordapp.com/emojis/{emoji.id}.{'gif' if animated else 'webp'}?size=48",
            })
        return {'ok': True, 'emojis': rows}

    async def call(self, method, params):
        if method == 'configure':
            self.settings = {key: params.get(key, default) for key, default in
                             [('receiveOnly', True), ('autoReply', False), ('dryRun', False), ('typingEnabled', True), ('reconnect', True), ('memberNameUpdatesEnabled', True), ('channelActionsEnabled', False), ('voiceReceiveEnabled', False), ('voiceReceiveConsent', False), ('voiceReceiveUserIds', [])]}
            if self.voice_output and self.voice_output.receiver and (not self.settings['voiceReceiveEnabled'] or not self.settings['voiceReceiveConsent'] or self.settings['receiveOnly'] or self.settings['dryRun']):
                self.voice_output.receiver.close()
            if self.settings['receiveOnly'] or self.settings['dryRun'] or not self.settings['typingEnabled'] or not self.settings['autoReply']:
                await self.stop_all_typing()
            return {'ok': True}
        if method == 'start':
            if self.client:
                raise RuntimeError('already_started')
            import discord
            version = importlib.metadata.version('discord.py-self')
            if version != '2.1.0' or discord.__version__ != '2.1.0':
                raise RuntimeError('unexpected_library_version')
            self.settings = {key: params.get(key, default) for key, default in
                             [('receiveOnly', True), ('autoReply', False), ('dryRun', False), ('typingEnabled', True), ('reconnect', True), ('memberNameUpdatesEnabled', True), ('channelActionsEnabled', False), ('voiceReceiveEnabled', False), ('voiceReceiveConsent', False), ('voiceReceiveUserIds', [])]}
            self.client = discord.Client()
            original_ws_connect = self.client.http.ws_connect

            async def observed_ws_connect(url, **kwargs):
                return await self.open_socket(original_ws_connect, url, **kwargs)

            self.client.http.ws_connect = observed_ws_connect

            @self.client.event
            async def on_ready():
                self.recovered()
                user = self.client.user
                emit({'event': 'ready', 'libraryVersion': version, 'guildCount': len(self.client.guilds),
                      'user': {'id': str(user.id), 'username': user.name, 'displayName': user.display_name, 'tag': str(user)}})

            @self.client.event
            async def on_member_update(before, after):
                if self.settings.get('memberNameUpdatesEnabled', True):
                    emit(member_name_event(after, after.guild.id))

            @self.client.event
            async def on_user_update(before, after):
                if self.settings.get('memberNameUpdatesEnabled', True):
                    emit(member_name_event(after))

            @self.client.event
            async def on_message(message):
                origin = await self.message_origin(message)
                emit({'event': 'message', 'origin': origin, 'message': message_dict(message, self.client.user.id)})

            @self.client.event
            async def on_disconnect():
                emit({'event': 'disconnected', 'terminal': self.client.is_closed()})
                if not self.client.is_closed() and self.session_task and not self.session_task.done():
                    self.begin_recovery()
                await self.stop_all_typing()

            @self.client.event
            async def on_resumed():
                self.recovered()
                emit({'event': 'resumed'})

            @self.client.event
            async def on_raw_message_edit(payload):
                if not content_changed(payload):
                    if 'embeds' in payload.data:
                        emit({'event': 'message_preview', 'channelId': str(payload.channel_id),
                              'messageId': str(payload.message_id), 'guildId': str(payload.guild_id) if payload.guild_id else None,
                              'embedDetails': payload.data['embeds'][:5]})
                    return
                emit({'event': 'message_edit', 'channelId': str(payload.channel_id),
                      'messageId': str(payload.message_id), 'guildId': str(payload.guild_id) if payload.guild_id else None})

            @self.client.event
            async def on_raw_message_delete(payload):
                emit({'event': 'message_delete', 'channelId': str(payload.channel_id),
                      'messageId': str(payload.message_id), 'guildId': str(payload.guild_id) if payload.guild_id else None})

            @self.client.event
            async def on_raw_bulk_message_delete(payload):
                for message_id in payload.message_ids:
                    emit({'event': 'message_delete', 'channelId': str(payload.channel_id),
                          'messageId': str(message_id), 'guildId': str(payload.guild_id) if payload.guild_id else None})

            async def reaction_event(payload, removed=False):
                emit({'event': 'reaction', 'channelId': str(payload.channel_id), 'messageId': str(payload.message_id),
                      'guildId': str(payload.guild_id) if payload.guild_id else None, 'dm': payload.guild_id is None,
                      'userId': str(payload.user_id), 'emoji': str(payload.emoji), 'removed': removed})

            @self.client.event
            async def on_raw_reaction_add(payload):
                await reaction_event(payload)

            @self.client.event
            async def on_raw_reaction_remove(payload):
                await reaction_event(payload, True)

            self.session_task = asyncio.create_task(self.session(params['token']))
            return {'ok': True, 'pending': True}
        if method == 'shutdown':
            if self.voice_output:
                await self.voice_output.handle('voice_leave', {})
            await self.stop_all_typing()
            if self.session_task:
                self.session_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self.session_task
            if self.client:
                await self.client.close()
            return {'ok': True}
        if method in ('conversation_read', 'conversation_write'):
            from conversation_ops import execute
            return await execute(self, method == 'conversation_write', params, message_dict)
        if method == 'pins':
            channel = await self.channel(params.get('channelId'))
            limit = max(1, min(20, int(params.get('limit') or 20)))
            items = []
            async for message in channel.pins(limit=limit + 1):
                items.append(message_dict(message, self.client.user.id))
            return {'ok': True, 'messages': items[:limit], 'hasMore': len(items) > limit}
        if method == 'member_name':
            user_id = str(params.get('userId', ''))
            guild_id = str(params.get('guildId') or '')
            if not user_id.isdecimal() or not 15 <= len(user_id) <= 22 or guild_id and (not guild_id.isdecimal() or not 15 <= len(guild_id) <= 22):
                raise ValueError('invalid_member_id')
            guild = self.client.get_guild(int(guild_id)) if guild_id else None
            user = guild.get_member(int(user_id)) if guild else self.client.get_user(int(user_id))
            if not user:
                return {'ok': False}
            event = member_name_event(user, guild_id if guild else None)
            return {'ok': True, 'author': {key: event[key] for key in ('username', 'displayName', 'guildNickname') if key in event}}
        if method == 'presence_get':
            settings = await asyncio.wait_for(self.client.fetch_settings(), timeout=10) if params.get('refresh') else self.client.settings
            custom = getattr(settings, 'custom_activity', None) if settings else None
            return {'ok': True, 'clientStatus': str(self.client.client_status), 'accountStatus': str(self.client.status),
                    'activities': [a.to_dict() for a in self.client.activities], 'savedStatus': str(settings.status) if settings else None,
                    'customStatus': custom.to_dict() if custom else None, 'source': 'gateway-and-rest' if params.get('refresh') else 'gateway-cache'}
        if method == 'typing_stop':
            return await self.stop_typing(params.get('typingId'))
        if method == 'cancel_reply':
            self.cancelled_replies.add(params.get('replyId'))
            if len(self.cancelled_replies) > 10000:
                # All older work has expired well before this bound.
                self.cancelled_replies = {params.get('replyId')}
            return {'ok': True}
        if method.startswith('voice_'):
            if self.voice_output is None:
                from voice_output import VoiceOutput
                self.voice_output = VoiceOutput(self)
            if method not in ('voice_status', 'voice_stop', 'voice_leave') and (not self.client or not self.client.is_ready() or self.client.is_closed()):
                return {'ok': False, 'error': 'Python Discord 尚未就緒'}
            if method == 'voice_member_channel':
                return self.member_voice_channel(params)
            if method == 'voice_text_channel':
                channel = await self.channel(params['channelId'])
                return {'ok': str(getattr(getattr(channel, 'guild', None), 'id', '')) == params['guildId'] and str(channel.type) in ('text', 'news', 'forum', 'voice')}
            return await self.voice_output.handle(method, params)
        if not self.client or not self.client.is_ready() or self.client.is_closed():
            return {'ok': False, 'error': 'Python Discord 尚未就緒'}
        if method == 'media_asset':
            channel = await self.channel(params['channelId'])
            guild = getattr(channel, 'guild', None)
            if not guild or str(guild.id) != str(params.get('guildId')):
                return {'ok': False}
            if params.get('type') == 'sticker':
                sticker = next((s for s in guild.stickers if str(s.id) == str(params.get('id')) and s.available), None)
                return {'ok': True, 'type': 'sticker', 'id': str(sticker.id)} if sticker else {'ok': False}
            if params.get('type') != 'emoji':
                return {'ok': False}
            emoji = next((e for e in guild.emojis if str(e.id) == str(params.get('id')) and e.available), None)
            return {'ok': True, 'type': 'emoji', 'text': str(emoji)} if emoji else {'ok': False}
        if method == 'typing_start':
            return await self.start_typing(params)
        if method == 'typing_once':
            self.allow_typing(params.get('options', {}))
            channel = await self.channel(params['channelId'])
            self.allow_typing(params.get('options', {}))
            await channel.typing()
            return {'ok': True}
        if method in ('send', 'reaction', 'removeReaction', 'presence', 'edit_message', 'delete_message'):
            async with self.mutations:
                return await self.mutate(method, params)
        if method == 'thread_parent':
            import discord
            channel = await self.channel(params['channelId'])
            return {'ok': True, 'type': 0 if isinstance(channel, discord.TextChannel) else -1}
        if method == 'thread_create':
            import discord
            async with self.mutations:
                self.allow_write(True)
                if params.get('options', {}).get('expectedSelfId') != str(self.client.user.id) or self.settings.get('dryRun'):
                    raise PermissionError('account_changed_or_dryrun')
                channel = await self.channel(params['channelId'])
                if not isinstance(channel, discord.TextChannel) or params.get('archiveMinutes') not in (60, 1440, 4320, 10080):
                    raise ValueError('invalid_thread_parent_or_archive')
                message = await channel.fetch_message(int(params['messageId']))
                self.allow_write(True)
                if params.get('options', {}).get('expectedSelfId') != str(self.client.user.id) or self.settings.get('dryRun'):
                    raise PermissionError('account_changed_or_dryrun')
                thread = await message.create_thread(name=str(params.get('name', '')).strip()[:90] or 'DSH 對話', auto_archive_duration=params['archiveMinutes'])
                return {'ok': True, 'threadId': str(thread.id)}
        if method == 'guilds':
            return {'ok': True, 'guilds': [{'id': str(g.id), 'name': g.name} for g in self.client.guilds]}
        if method == 'emojis':
            return await self.list_emojis(params)
        if method == 'stickers':
            import discord
            query = str(params.get('query', '')).casefold()[:120]
            channel = await self.channel(params['channelId']) if params.get('channelId') else None
            guild = getattr(channel, 'guild', None)
            guilds = [guild] if channel and guild else ([] if channel else self.client.guilds)
            rows = []
            for g in guilds:
                for s in g.stickers:
                    if s.available and (not query or query in (s.name + ' ' + (s.description or '')).casefold()):
                        rows.append({'id': str(s.id), 'name': s.name, 'description': s.description, 'guildId': str(g.id), 'url': str(s.url), 'kind': 'guild', 'format': str(s.format)})
            warning = None
            try:
                if self.sticker_catalog_until < asyncio.get_running_loop().time():
                    packs = await asyncio.wait_for(self.client.sticker_packs(), timeout=8)
                    self.standard_stickers = {str(s.id): s for pack in packs for s in pack.stickers}
                    self.sticker_catalog_until = asyncio.get_running_loop().time() + 300
                for s in self.standard_stickers.values():
                    if not query or query in (' '.join([s.name, s.description or '', *getattr(s, 'tags', [])])).casefold():
                        rows.append({'id': str(s.id), 'name': s.name, 'description': s.description, 'guildId': None, 'url': str(s.url), 'kind': 'standard', 'format': str(s.format)})
            except Exception:
                self.sticker_catalog_until = asyncio.get_running_loop().time() + 30
                warning = '官方貼圖包暫時無法讀取；仍顯示已取得的伺服器貼圖'
            return {'ok': True, 'stickers': rows[:50], 'warning': warning, 'note': '發送仍受 Discord 帳號權限與付費資格限制'}
        if method == 'gifs':
            from discord.http import Route
            items = await asyncio.wait_for(self.client.http.request(Route('GET', '/gifs/search'), params={
                'q': str(params.get('query', ''))[:120], 'provider': 'klipy', 'media_format': 'gif',
                'locale': 'en-US' if params.get('locale') == 'en-US' else 'zh-TW', 'limit': 20,
            }), timeout=10)
            return {'ok': True, 'items': items if isinstance(items, list) else []}
        if method == 'refresh_attachments':
            from urllib.parse import urlparse
            from discord.http import Route
            urls = []
            for value in params.get('urls', [])[:3]:
                parsed = urlparse(str(value))
                if (parsed.scheme == 'https' and parsed.hostname in ('cdn.discordapp.com', 'media.discordapp.net')
                        and not parsed.username and not parsed.password and parsed.port in (None, 443)
                        and parsed.path.startswith('/attachments/')):
                    urls.append(str(value))
            if not urls:
                return {'ok': False, 'error': 'invalid_attachment_url'}
            payload = await asyncio.wait_for(self.client.http.request(Route('POST', '/attachments/refresh-urls'),
                json={'attachment_urls': urls}), timeout=8)
            return {'ok': True, 'items': payload.get('refreshed_urls', [])}
        if method == 'channels':
            channels = list(self.client.private_channels)
            for guild in self.client.guilds:
                channels.extend(guild.channels)
            return {'ok': True, 'channels': [
                {'id': str(c.id), 'name': getattr(c, 'name', None) or str(c),
                 'guildId': str(c.guild.id) if getattr(c, 'guild', None) else None, 'type': str(c.type)}
                for c in channels if not params.get('guildId') or str(getattr(getattr(c, 'guild', None), 'id', '')) == params['guildId']]}
        if method == 'dms':
            return {'ok': True, 'dms': [{'id': str(c.id), 'recipient': {
                'id': str(c.recipient.id), 'username': c.recipient.name, 'tag': str(c.recipient)}}
                for c in self.client.private_channels if getattr(c, 'recipient', None)]}
        if method == 'messages':
            channel = await self.channel(params['channelId'])
            messages = [message_dict(m, self.client.user.id) async for m in channel.history(limit=max(1, min(50, int(params.get('limit', 20)))))]
            return {'ok': True, 'messages': list(reversed(messages))}
        if method == 'message':
            channel = await self.channel(params['channelId'])
            message = await channel.fetch_message(int(params['messageId']))
            return {'ok': True, 'message': message_dict(message, self.client.user.id)}
        return {'ok': False, 'error': '不支援的 Python 操作'}

    async def mutate(self, method, params):
        import discord
        options = params.get('options', {})
        automated = bool(options.get('autoReply'))
        self.allow_write(automated)
        if options.get('replyId') in self.cancelled_replies:
            return {'ok': True, 'cancelled': True}
        if automated and self.settings.get('dryRun', False):
            raise PermissionError('dry_run')
        if options.get('expectedSelfId') and options['expectedSelfId'] != str(self.client.user.id):
            raise PermissionError('account_changed')
        if method == 'presence':
            kwargs = {}
            if 'status' in params:
                if params['status'] not in ('online', 'idle', 'dnd', 'invisible'):
                    raise ValueError('invalid_presence_status')
                kwargs['status'] = discord.Status(params['status'])
            if any(k in params for k in ('activityType', 'activityText', 'customStatusText', 'customStatusEmoji')):
                if 'activityText' in params and 'activityType' not in params:
                    raise ValueError('activity_type_required')
                activity_type = params.get('activityType', 'none')
                if activity_type not in ('none', 'playing', 'listening', 'watching', 'competing'):
                    raise ValueError('invalid_activity_type')
                values = {k: params.get(k, '') for k in ('activityText', 'customStatusText', 'customStatusEmoji')}
                if any(not isinstance(v, str) or len(v) > (100 if k == 'customStatusEmoji' else 128) for k, v in values.items()):
                    raise ValueError('invalid_activity_text')
                activities = []
                if activity_type != 'none':
                    if not values['activityText'].strip():
                        raise ValueError('activity_text_required')
                    activities.append(discord.Activity(type=getattr(discord.ActivityType, activity_type), name=values['activityText'].strip()))
                if values['customStatusText'] or values['customStatusEmoji']:
                    emoji = values['customStatusEmoji']
                    if emoji.startswith('<'):
                        import re
                        if not re.fullmatch(r'<a?:\w+:\d{15,22}>', emoji):
                            raise ValueError('invalid_custom_status_emoji')
                        emoji = discord.PartialEmoji.from_str(emoji)
                    activities.append(discord.CustomActivity(name=values['customStatusText'] or None, emoji=emoji or None))
                kwargs['activities'] = activities
            await self.client.change_presence(**kwargs)
            return {'ok': True, 'verification': 'request-accepted'}
        channel = await self.channel(params['channelId'])
        if method in ('edit_message', 'delete_message'):
            message_id = str(params.get('messageId', ''))
            if not message_id.isdecimal() or not 15 <= len(message_id) <= 22:
                raise ValueError('invalid_message_id')
            message = await channel.fetch_message(int(message_id))
            if message.author.id != self.client.user.id:
                raise PermissionError('not_own_message')
            self.allow_write()
            if method == 'delete_message':
                await message.delete()
                return {'ok': True, 'deleted': True, 'messageId': message_id}
            content = params.get('content')
            if not isinstance(content, str) or not content.strip() or len(content) > 2000:
                raise ValueError('message_text_required_max_2000')
            edited = await message.edit(content=content, allowed_mentions=discord.AllowedMentions.none())
            return {'ok': True, 'messageId': str(edited.id)}
        if method in ('reaction', 'removeReaction'):
            message = await channel.fetch_message(int(params['messageId']))
            self.allow_write()
            if method == 'reaction':
                await message.add_reaction(params['emoji'])
            else:
                await message.remove_reaction(params['emoji'], self.client.user)
            return {'ok': True}
        stickers = []
        if options.get('stickerIds'):
            guild = getattr(channel, 'guild', None)
            for sticker_id in options['stickerIds'][:3]:
                sticker = next((s for s in getattr(guild, 'stickers', []) if str(s.id) == str(sticker_id) and s.available), None)
                if not sticker:
                    sticker = self.standard_stickers.get(str(sticker_id))
                    if sticker is None and str(sticker_id).isdecimal():
                        sticker = await self.client.fetch_sticker(int(sticker_id))
                    if getattr(sticker, 'type', None) != discord.StickerType.standard:
                        return {'ok': False, 'error': '貼圖不在目前伺服器或不可用'}
                stickers.append(sticker)
        content = str(options.get('content', ''))
        files = []
        try:
            for entry in list(options.get('files', [])) + list(options.get('fileUrls', [])):
                if not isinstance(entry, str):
                    raise ValueError('invalid_attachment')
                if entry.startswith(('https://', 'http://')):
                    content += ('\n' if content else '') + entry
                else:
                    files.append(discord.File(Path(entry).resolve()))
            if not content.strip() and not files and not stickers:
                raise ValueError('empty_message')
            reference = None
            if options.get('replyToMessageId'):
                target = await channel.fetch_message(int(options['replyToMessageId']))
                reference = target.to_reference(fail_if_not_exists=True)
            self.allow_write(automated)
            if not automated and options.get('simulateTyping') is not False and not self.settings.get('dryRun', False) and self.settings.get('typingEnabled', True):
                with contextlib.suppress(Exception):
                    await channel.typing()
            if options.get('replyId') in self.cancelled_replies:
                return {'ok': True, 'cancelled': True}
            self.allow_write(automated)
            if automated and self.settings.get('dryRun', False):
                raise PermissionError('dry_run')
            nonce = str(uuid.uuid4().int % (2 ** 63))
            self.plugin_nonces[nonce] = asyncio.get_running_loop().time()
            if len(self.plugin_nonces) > 10000:
                self.plugin_nonces.pop(next(iter(self.plugin_nonces)))
            try:
                voice_meta = options.get('voiceMessage')
                if voice_meta:
                    import base64
                    import math
                    from types import SimpleNamespace
                    from discord.http import handle_message_parameters
                    from discord.utils import MISSING
                    duration = voice_meta.get('durationSecs')
                    waveform = base64.b64decode(voice_meta.get('waveform', ''), validate=True)
                    if (content.strip() or len(files) != 1 or stickers or options.get('fileUrls') or
                            not isinstance(duration, (int, float)) or not math.isfinite(duration) or not 0 < duration <= 600 or
                            not 0 < len(waveform) <= 256):
                        raise ValueError('invalid_voice_message')
                    path = Path(options['files'][0]).resolve()
                    import tempfile
                    if (path.parent.parent != Path(tempfile.gettempdir()).resolve() or
                            not path.parent.name.startswith('dsh-discord-voice-message-') or
                            path.name != 'voice-message.ogg' or path.stat().st_size > 8 * 1024 * 1024):
                        raise ValueError('invalid_voice_message_file')
                    with handle_message_parameters(files=files, flags=discord.MessageFlags._from_value(8192), nonce=nonce,
                            allowed_mentions=discord.AllowedMentions.none(),
                            message_reference=reference.to_dict() if reference else MISSING) as payload:
                        for part in payload.multipart:
                            if part['name'] == 'payload_json':
                                data = json.loads(part['data'])
                                data['attachments'][0].update(duration_secs=duration, waveform=voice_meta['waveform'])
                                part['data'] = json.dumps(data)
                            else:
                                part['content_type'] = 'audio/ogg'
                        # Keep upstream HTTP/session/rate-limit machinery for user accounts.
                        result = await self.client.http.send_message(channel.id, params=payload)
                    sent = SimpleNamespace(id=int(result['id']), channel=channel)
                else:
                    sent = await channel.send(nonce=nonce, content=content or None, files=files, stickers=stickers or None, reference=reference,
                                              allowed_mentions=discord.AllowedMentions(everyone=False, roles=False, users=True,
                                                                                       replied_user=options.get('mention', False)))
            except Exception as exc:
                status = getattr(exc, 'status', None)
                if isinstance(status, int) and 400 <= status < 500:
                    raise
                return {'ok': False, 'uncertain': True, 'code': type(exc).__name__, 'error': '發送過程失去確認，可能已送出；請核對 Discord，勿直接重送'}
            self.remember_plugin_message(sent.id)
            return {'ok': True, 'messageId': str(sent.id), 'channelId': str(sent.channel.id)}
        finally:
            for attachment in files:
                attachment.close()


async def main():
    worker = Worker()
    tasks = set()

    async def handle(packet):
        try:
            result = await worker.call(packet['method'], packet.get('params', {}))
        except Exception as exc:
            # Exception text may contain request details. Only whitelisted metadata leaves Python.
            safe_errors = {'not_own_message': '只能修改或撤回自己的訊息', 'invalid_message_id': '訊息 ID 格式不正確', 'message_text_required_max_2000': '訊息文字需為 1 至 2000 字元', 'receive_only': '僅觀察模式禁止修改 Discord', 'invalid_channel_id': '頻道 ID 格式不正確'}
            result = {'ok': False, 'code': type(exc).__name__, 'error': safe_errors.get(str(exc), f'Python 操作失敗（{type(exc).__name__}）')}
            status = getattr(exc, 'status', None)
            if isinstance(status, int):
                result['httpStatus'] = status
        emit({'id': packet.get('id'), 'result': result})

    try:
        while True:
            line = await asyncio.to_thread(sys.stdin.readline)
            if not line:
                break
            try:
                packet = json.loads(line)
            except (ValueError, TypeError):
                continue
            # Configuration and lifecycle remain ordered; reads/mutations may await network IO.
            if packet.get('method') in ('start', 'configure'):
                await handle(packet)
            elif packet.get('method') == 'shutdown':
                break
            else:
                task = asyncio.create_task(handle(packet)); tasks.add(task); task.add_done_callback(tasks.discard)
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await worker.call('shutdown', {})


if __name__ == '__main__':
    asyncio.run(main())
