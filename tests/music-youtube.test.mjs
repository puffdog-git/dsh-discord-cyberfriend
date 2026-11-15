import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeMusicProvider } from '../src/music-youtube.js';
import { MusicProviders } from '../src/music-providers.js';
import { musicTools } from '../src/music-tools.js';

test('YouTube source resolves late, searches, loads audio and detects unload', async () => {
  let service;
  const p = new MusicProviders({ scopeFor: () => ({ workspace: 'test' }) });
  p.register(youtubeMusicProvider({ get: () => service }));
  assert.equal(p.catalog().find(p => p.id === 'plugin:youtube').available, false);
  await assert.rejects(p.search('plugin:youtube', '歌'), /啟用/);
  service = { search: async q => [{ id: 'abcdefghijk', title: q }], load: async () => Buffer.from('audio') };
  assert.equal(p.catalog().find(p => p.id === 'plugin:youtube').available, true);
  assert.equal((await p.search('plugin:youtube', '歌'))[0].provider, 'plugin:youtube');
  assert.equal((await p.load('plugin:youtube', 'abcdefghijk', { signal: new AbortController().signal })).toString(), 'audio');
  service.load = async () => { service = undefined; return Buffer.from('audio'); };
  await assert.rejects(p.load('plugin:youtube', 'abcdefghijk', { signal: new AbortController().signal }), /啟用|變更/);
});

test('AI YouTube search/play uses the bound room and rejects a different text channel', async () => {
  const controller = new AbortController(), agent = { session: { id: 'session' } };
  const binding = { sessionId: 'session', transport: 'bot', accountId: 'account', channelId: 'text', cwd: 'test' };
  let roomChannel = 'text', queued;
  const p = new MusicProviders();
  p.register(youtubeMusicProvider({ get: () => ({ search: async () => [{ id: 'abcdefghijk', title: '歌' }], load() {} }) }));
  const tools = musicTools({ providers: p, bridge: { bindings: { x: binding } },
    getManager: () => ({ byKind: { bot: { ready: true, selfId: 'account' } } }),
    voice: { session: () => ({ textChannelId: roomChannel }), check() {}, music: a => { queued = a; return { ok: true, queued: true }; } } });
  const execute = (name, args) => tools.find(t => t.name.endsWith(name)).execute(args, { agent, signal: controller.signal });
  const found = await execute('music_search', { provider: 'plugin:youtube', query: '歌' });
  const result = await execute('music_play', { provider: 'plugin:youtube', trackId: found.tracks[0].id, label: '歌' });
  assert.equal(result.queued, true);
  assert.deepEqual(queued, { kind: 'bot', provider: 'plugin:youtube', trackId: 'abcdefghijk', label: '歌' });
  roomChannel = 'other';
  await assert.rejects(execute('music_play', { provider: 'plugin:youtube', trackId: 'abcdefghijk' }), /未綁定/);
});
