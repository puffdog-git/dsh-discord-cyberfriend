import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscordVoice } from '../src/voice.js';
import { sanitizeConfig } from '../src/config.js';
test('music and covers suppress both transports in the same room, restore naturally, and honor the toggle', () => {
  assert.equal(sanitizeConfig({}).voiceMusicPauseReceiveEnabled, true);
  for (const player of ['user', 'bot'])
    for (const ownership of ['separate', 'shared']) {
      const cfg = { voiceMusicPauseReceiveEnabled: true, replyOwnership: ownership, primaryTransport: 'bot' },
        v = Object.create(DiscordVoice.prototype);
      v.getConfig = () => cfg;
      v.sessions = new Map(
        ['user', 'bot'].map((kind, i) => [
          kind,
          { kind, receiving: true, guildId: 'g', channelId: 'room', joinedAt: i, queue: [] },
        ]),
      );
      const s = v.sessions.get(player);
      const before = [...v.sessions.values()].map((x) => v.canReceive(x));
      for (const scenario of ['music', 'cover', 'duck']) {
        s.current = scenario === 'duck' ? { type: 'speech' } : { type: 'music' };
        s.music = scenario === 'duck' ? { type: 'music' } : null;
        assert.ok([...v.sessions.values()].every((x) => !v.canReceive(x)));
        assert.equal(v.musicReceivePaused({ guildId: 'g', channelId: 'elsewhere' }), false);
        cfg.voiceMusicPauseReceiveEnabled = false;
        assert.deepEqual(
          [...v.sessions.values()].map((x) => v.canReceive(x)),
          before,
        );
        cfg.voiceMusicPauseReceiveEnabled = true;
        s.current = null;
        s.music = null;
        assert.deepEqual(
          [...v.sessions.values()].map((x) => v.canReceive(x)),
          before,
        );
      }
    }
});
