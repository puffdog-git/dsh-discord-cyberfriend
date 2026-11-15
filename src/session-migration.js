import { createHash, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const fingerprint = (events) => createHash('sha256').update(JSON.stringify(events)).digest('hex');

// A workspace path is immutable in DSH's stored Session header. Use the host's
// seeded-session API, preserving the whole closed log instead of editing headers.
export function migrationSeed(events) {
  if (!Array.isArray(events)) throw Error('無法讀取完整會話歷史');
  let openTurn = false, openStep = false;
  for (const [index, event] of events.entries()) {
    if (event.seq !== index) throw Error('會話歷史序號不完整，保留原會話');
    if (event.type === 'turn/start') openTurn = true;
    if (event.type === 'step/start') openStep = true;
    if (event.type === 'step/end') openStep = false;
    if (event.type === 'turn/end') { openTurn = false; openStep = false; }
  }
  if (openTurn || openStep) throw Error('會話仍有未結束回合，請完成或取消後再移動');
  const first = events.find((e) => ['system/message', 'user/message', 'assistant/message'].includes(e.type));
  if (first && first.type !== 'system/message') throw Error('舊會話尚未建立完整系統開頭，請先完成一次正常回覆');
  const seed = structuredClone(events);
  if (events.length) seed.push({ type: 'session/end-seed', seq: events.length,
    time: events.at(-1).time, data: { inherited: true } });
  return seed;
}

export async function migrateWorkspace(bridge, key, target, { manualCwd = true } = {}) {
  if (typeof target !== 'string' || !isAbsolute(target)) throw Error('請提供工作區的完整絕對路徑');
  const cwd = resolve(target), binding = bridge.bindings[key];
  if (!binding) throw Error('找不到 Discord 綁定');
  if (resolve(binding.cwd) === cwd) return { changed: false, sessionId: binding.sessionId };
  const agents = bridge.service('agents'), query = bridge.service('sessionQuery');
  if (!query?.observeSession) throw Error('宿主尚未提供安全的會話讀取介面，原綁定未變');
  const original = agents.get(binding.sessionId);
  if (original && (original.status !== 'idle' || original.inbox?.nextTurn?.length || original.inbox?.nextStep?.length))
    throw Error('會話仍有執行中或排隊的工作，請稍後再移動');
  let observation, handle, committed = false;
  try {
    observation = await query.observeSession(binding.sessionId);
    if (observation.header.id !== binding.sessionId || resolve(observation.header.cwd || '') !== resolve(binding.cwd))
      throw Error('原會話工作區與綁定不符，未移動');
    if (observation.header.origin === 'subagent') throw Error('子代理會話不能由 Discord 移動');
    const events = structuredClone(observation.events), seed = migrationSeed(events), sourceHash = fingerprint(events);
    await mkdir(cwd, { recursive: true });
    const workspace = await bridge.service('workspaceRegistry').create(cwd);
    const selection = bridge.service('agentDefaultModel')?.currentSelection?.();
    if (!selection) throw Error('DSH 尚無可用的模型設定；移動不會呼叫模型');
    const newId = `session-${randomUUID()}`;
    handle = await agents.create({ sessionId: newId,
      ...(seed.length ? { seed, inheritedEventCount: events.length } : {}),
      meta: { cwd, title: binding.title, ...(seed.length ? { isSeeded: true } : {}),
        ...(observation.header.agentPreset ? { agentPreset: observation.header.agentPreset } : {}) },
      agentOptions: selection, setup: async () => {} });
    const copied = handle.agent.session.snapshotEvents().slice(0, events.length);
    if (handle.agent.session.header.cwd !== cwd || fingerprint(copied) !== sourceHash)
      throw Error('新會話歷史核對失敗，原綁定未變');
    if (original && (original.status !== 'idle' || original.inbox?.nextTurn?.length || original.inbox?.nextStep?.length ||
        fingerprint(original.session.snapshotEvents()) !== sourceHash))
      throw Error('搬移期間原會話有新活動，請稍後重試；原綁定未變');
    if (bridge.bindings[key] !== binding) throw Error('搬移期間綁定已變更，未覆蓋');
    await workspace.attachSession(newId);
    const finalSource = await query.observeSession(binding.sessionId);
    try {
      const active = agents.get(binding.sessionId);
      if (handle.agent.status !== 'idle' || handle.agent.inbox?.nextTurn?.length || handle.agent.inbox?.nextStep?.length ||
          bridge.bindings[key] !== binding || fingerprint(finalSource.events) !== sourceHash ||
          (active && (active.status !== 'idle' || active.inbox?.nextTurn?.length || active.inbox?.nextStep?.length)))
        throw Error('搬移期間原會話有新活動，原綁定未變');
    } finally { finalSource[Symbol.dispose]?.(); }
    const next = { ...binding, cwd, sessionId: newId, workspaceId: workspace.id, manualCwd,
      migrations: [...(binding.migrations || []), { fromSessionId: binding.sessionId, fromCwd: binding.cwd,
        toSessionId: newId, at: Date.now(), inheritedEvents: events.length }].slice(-20) };
    bridge.bindings[key] = next;
    try { await bridge.save(); } catch (error) { bridge.bindings[key] = binding; throw error; }
    committed = true;
    const oldState = bridge.live.get(binding.sessionId);

    // A UI-owned Agent is retained; never cancel somebody's manual work.
    if (oldState && !oldState.borrowed && original?.status === 'idle' &&
        !original.inbox?.nextTurn?.length && !original.inbox?.nextStep?.length) {
      bridge.live.delete(binding.sessionId);
      await oldState.dispose().catch(() => bridge.log?.warn('session.migration', '舊會話釋放未完成，已保留新綁定'));
    }
    return { changed: true, sessionId: newId, previousSessionId: binding.sessionId,
      cwd, inheritedEvents: events.length, oldSessionRetained: true,
      memoryNote: '外部記憶庫與舊維護回執保留原定位；共用工作區不會自動合併舊庫。' };
  } catch (error) {
    if (handle && !committed) error.message += `；未切換的候選會話 ${handle.agent.id} 已保留供核對`;
    throw error;
  } finally {
    if (handle && handle.agent.status === 'idle' && !handle.agent.inbox?.nextTurn?.length && !handle.agent.inbox?.nextStep?.length) {
      try { await handle.dispose(); } catch {
        bridge.log?.warn('session.migration', '候選會話釋放未完成；未取消任何執行工作');
      }
    }
    observation?.[Symbol.dispose]?.();
  }
}
