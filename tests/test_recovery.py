import asyncio
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import Worker, ReconnectLimitError, GatewayConnectError
from curl_cffi import CurlError
import discord


class RecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.worker = Worker()
        self.worker.settings = {'reconnect': True}

    async def asyncTearDown(self):
        self.worker.recovered()

    async def test_transient_dns_recovers_with_backoff_and_five_attempt_bound(self):
        connect = AsyncMock(side_effect=[CurlError('private', code=6), 'socket'])
        with patch('worker.asyncio.sleep', new_callable=AsyncMock) as sleep, patch.object(self.worker, 'begin_recovery'):
            result = await self.worker.connect_gateway(connect, 'wss://gateway.discord.gg')
        self.assertEqual(result, 'socket')
        self.assertEqual(connect.await_count, 2)
        sleep.assert_awaited_once_with(2)
        self.worker.recovered()
        connect = AsyncMock(side_effect=CurlError('private', code=6))
        with patch('worker.asyncio.sleep', new_callable=AsyncMock), patch.object(self.worker, 'begin_recovery'):
            with self.assertRaises(ReconnectLimitError):
                await self.worker.connect_gateway(connect, 'wss://gateway.discord.gg')
        self.assertEqual(connect.await_count, 5)

    async def test_rejected_handshake_is_terminal_without_retry(self):
        for status in (401, 403):
            self.worker.recovered()
            exc = discord.HTTPException(SimpleNamespace(status=status, reason='rejected'), 'private')
            connect = AsyncMock(side_effect=exc)
            with self.assertRaises(GatewayConnectError) as caught:
                await self.worker.connect_gateway(connect, 'wss://gateway.discord.gg')
            self.assertEqual(caught.exception.status, status)
            self.assertEqual(connect.await_count, 1)

    async def test_disabled_recovery_does_not_retry(self):
        self.worker.settings['reconnect'] = False
        connect = AsyncMock(side_effect=CurlError('private', code=6))
        with self.assertRaises(CurlError):
            await self.worker.connect_gateway(connect, 'wss://gateway.discord.gg')
        self.assertEqual(connect.await_count, 1)

    async def test_watchdog_cancels_session_and_success_cleans_watchdog(self):
        self.worker.session_task = asyncio.create_task(asyncio.sleep(60))
        # Use a separate Event to trigger expiry without wall-clock waiting.
        trigger = asyncio.Event()
        original_sleep = asyncio.sleep
        async def wait_for_trigger(seconds):
            await trigger.wait()
        with patch('worker.asyncio.sleep', new=wait_for_trigger):
            self.worker.begin_recovery()
            await original_sleep(0)
            trigger.set()
            await original_sleep(0)
            await original_sleep(0)
        self.assertTrue(self.worker.session_task.cancelled())
        self.worker.recovered()
        self.assertIsNone(self.worker.recovery_task)

    async def test_cancel_during_quote_lookup_prevents_send(self):
        entered, release = asyncio.Event(), asyncio.Event()
        async def fetch(_):
            entered.set()
            await release.wait()
            return SimpleNamespace(to_reference=lambda **kw: {})
        channel = SimpleNamespace(fetch_message=fetch, send=AsyncMock())
        self.worker.client = SimpleNamespace(user=SimpleNamespace(id=1), get_channel=lambda _: channel)
        self.worker.settings = {'receiveOnly': False, 'autoReply': True}
        task = asyncio.create_task(self.worker.mutate('send', {'channelId': '1560000000000000004',
            'options': {'content': 'answer', 'autoReply': True, 'replyId': 'job', 'replyToMessageId': '123'}}))
        await entered.wait()
        await self.worker.call('cancel_reply', {'replyId': 'job'})
        release.set()
        self.assertTrue((await task)['cancelled'])
        channel.send.assert_not_awaited()

    async def test_raw_events_are_registered_and_serialized_without_fetching(self):
        class FakeClient:
            def __init__(self):
                self.http = SimpleNamespace(ws_connect=AsyncMock())
                self.user = SimpleNamespace(id=123, name='fixture', display_name='fixture')
                self.guilds = []
                self.closed = False
            def event(self, fn):
                setattr(self, fn.__name__, fn)
                return fn
            async def start(self, token, reconnect):
                await asyncio.Future()
            def is_closed(self):
                return self.closed
            async def close(self):
                self.closed = True
        with patch('discord.Client', FakeClient), patch('worker.emit') as emit:
            await self.worker.call('start', {'token': 'fixture-only'})
            client = self.worker.client
            payload = SimpleNamespace(channel_id=111, message_id=222, guild_id=None,
                                      data={'embeds': []}, user_id=333, emoji='🔍')
            await client.on_raw_message_edit(payload)
            self.assertEqual(emit.call_args.args[0]['event'], 'message_preview')
            payload.data = {'content': 'edited'}
            await client.on_raw_message_edit(payload)
            self.assertEqual(emit.call_args.args[0]['event'], 'message_edit')
            await client.on_raw_message_delete(payload)
            self.assertEqual(emit.call_args.args[0]['messageId'], '222')
            await client.on_raw_reaction_add(payload)
            self.assertEqual(emit.call_args.args[0]['userId'], '333')
            self.assertFalse(emit.call_args.args[0]['removed'])
            await client.on_raw_reaction_remove(payload)
            self.assertTrue(emit.call_args.args[0]['removed'])
            await client.on_resumed()
            self.assertEqual(emit.call_args.args[0]['event'], 'resumed')
            await self.worker.call('shutdown', {})


if __name__ == '__main__':
    unittest.main()
