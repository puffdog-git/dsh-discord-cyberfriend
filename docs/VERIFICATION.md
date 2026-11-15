# Verification record

Date: 2026-11-11 (Asia/Taipei)

- Runtime: DSH bundled Python 3.12.14; isolated .venv; discord.py-self 2.1.0.
- Dependency consistency: pip check passed; imported library and API signatures verified offline.
- Python bridge: production JSON worker exercised using a network-free Discord Client fixture.
- AI path: incoming fixture DM -> production responder -> mock host LLM -> Python channel.send -> acknowledgment.
- Guards: receive-only enforced in both Node and Python; stale session cancellation; no implicit quote fallback; self/history/duplicate/channel filtering; secrets excluded from launch arguments and error reports.
- Node tests: 11 passed, including real Python subprocess fixtures.
- UI smoke: 45 checks passed.
- REST smoke: 23 checks passed in an isolated copy.
- Host load/dispose: passed; 18 uniquely prefixed tools and isolated API/global service.
- Node/Python syntax checks passed.
- No live Discord login or real LLM send was performed for this new plugin. The test config starts empty and does not import previous credentials.
- Registered in desktop profile via junction and bundle entry. DSH was not restarted.

The upstream library version is pinned; runtime dependencies are recorded in requirements.lock.txt. Live token verification remains separate: use the UI or scripts/verify-connection.mjs after entering a current valid token in this plugin.

## Live connection and diagnostics follow-up

2026-11-11: the user-configured token passed preflight REST 200, reached READY with discord.py-self 2.1.0, remained connected for 60 seconds, and passed postflight REST 200. No outbound messages or LLM calls were made. See data/connection-verification.json.

Earlier host logs showed READY followed by CurlError code 6. That code was incorrectly named closeCode by the bridge; it is now curlCode, separately from Discord ConnectionClosed codes. The UI now shows the actual error. Gateway connection diagnostics contain only the hostname, never the URL query, credentials or raw exception text.

The running DSH host was also reconnected and observed connected for 60 seconds. It was left connected in receive-only mode (auto reply off). Node-side diagnostic changes require the next plugin reload; the replacement Python worker and cleared connection state are already active. See data/host-connection-verification.json.

## Auto reply configuration follow-up

The live configuration still had dryRun=true while userReceiveOnly=false and userAutoReply=true. Host logs showed successful reply generation followed by reply.dry-run, explaining why no text was sent. autoReact did not check dryRun and could still add reactions; this is now fixed and regression-tested. The user card now explains the active dry-run setting. The running configuration was changed to dryRun=false through the API without reconnecting. A new incoming DM is needed to verify live text delivery; historical dry-run outputs are not replayed.

Live AI DM reply verified after disabling dry-run: 2026-11-11T08:42:57.974Z, reply.sent acknowledged with a Discord message ID, 3973 ms from reply preparation. This used the running DSH host model and real Python transport, rather than fixture output. See data/ai-reply-verification.json. No historical dry-run output was replayed.

## Typing integration

19 Node tests and 7 Python tests passed after adding native typing contexts. Python tests exercise the installed upstream Typing context with a fake HTTP endpoint, verifying one initial request for concurrent replies in the same channel and lifecycle cleanup. No anti-detection success-rate benchmark was performed; upstream client/network defaults remain unchanged. See docs/TYPING-AND-CLIENT-REVIEW.md.

Live typing verified: user reported seeing the typing indicator and receiving the reply. Host logs confirmed native typing started, reply.sent, and typing renewal stopped. See data/typing-verification.json.

## Bounded recovery and conversation controls — 2026-11-11

- Implemented bounded native reconnect/resume, recent/quoted context retrieval, raw edit/delete synchronization, and authorized reaction controls sharing the normal reply pipeline.
- 29 Node tests passed, including cancellation during generation/queued sending, stale history after deletion, authorization and config changes, replay before RESUMED, and real Python subprocess fixtures.
- 13 Python tests passed, including DNS retry bounds, terminal HTTP 401/403, watchdog cancellation, raw event serialization, and cancellation during quote lookup. No RuntimeWarnings remained.
- 45 frontend checks passed; 23 REST checks and host load/dispose passed in a new isolated copy without live data. External fetch was blocked in the isolated smoke process. 18 tools remain registered.
- Existing live settings and credentials were not changed. DSH was not restarted, and no live Discord messages were sent for this batch. Reload/reconnect is required to activate the source changes; live recovery and reaction controls remain to be verified.
- Usage and limits: [CONVERSATION-UPGRADE.md](CONVERSATION-UPGRADE.md).

## Reply parity follow-up — 2026-11-11

Reviewed Bot Gateway normalization, shared message classification, gating, persona/model generation, typing, media output, reactions, and live config updates. Fixed empty-media rejection, premature user-transport filtering of direct mentions, missing Bot author/DM/mention fields, non-expiring round caps, media-only output failures, and inconsistent reaction scope. Details: [REPLY-PARITY-REVIEW.md](REPLY-PARITY-REVIEW.md).

- 51 Node tests and 18 Python tests passed; 45 UI checks and 23 isolated REST checks passed. Subsequent responder preview-preservation change passed all affected parity/typing tests (28).
- User reported sticker and guild @ responses successful. Host recorded a real user-transport mention reply at 2026-11-11T11:19:19.548Z.
- First live GIF test at 11:17:58Z began generation but was cancelled by a preview update. Added content comparison in Python and a non-cancelling preview event, with regression tests. Revised GIF behavior still requires the next reload/live test.
- Added replyCooldownExemptUserIds and saved the test main account in that list at the user's request. This bypasses only direct-message/mention cooldown; other users retain 20 seconds and quotas remain in force. Pending reload for live activation.

## Bot connectivity / cross-conversation cap follow-up

Live status after the next reload showed the cooldown exemption active and three real user replies at 2026-11-11T11:26Z. Bot connected at 11:27:43Z and remained connected with heartbeat latency about 208–226 ms. Bot DMs at 11:28:17Z and 11:28:43Z were received but denied by the same user's shared five-round cap.

Changed round accounting to receive transport + original channel + user, preserving total daily stats and independent reset windows. 54 Node tests passed. Rechecked upstream and both local plugin LLM paths: none sends GIF frames/images to the model; current GIF understanding is text metadata only. See BOT-CONNECTION-AND-GIF-REVIEW.md. Bot reply verification after the round-scope reload remains pending.

Live completion: after reload, Bot was connected with ping 227 ms. At 2026-11-11T11:34:10.968Z it entered reply.dm with transport=bot; reply.sent acknowledged delivery at 11:34:17.285Z (19:34:17 UTC+8). User confirmed receipt with “ok”. The Bot reply regression is resolved. 23 isolated REST checks also passed. No new GIF vision capability was implemented in this follow-up.
