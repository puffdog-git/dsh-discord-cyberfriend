// 靈樞維護的兩項覆核修正：
// 1. 寫入去重命中既有記憶時，不能把別人寫的記憶登記成「這次寫入、可從 Discord 維護」。
// 2. 更正不再關掉靈樞自己的衝突檢查；被擋下時回報「已拒絕、沒有修改」，不是「結果不確定」。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MemoryContracts } from '../src/memory-contracts.js';
import { MemoryMaintenance } from '../src/memory-maintenance.js';
import { writeLingshu, LINGSHU_TOOLS } from '../src/memory-lingshu.js';

const reply = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

function host({ node, remember }) {
  const calls = [],
    state = { node },
    tools = new Map();
  const invoke = async (name, args) => {
    calls.push({ name, args });
    if (name === 'lingshu_mdcg_whoami')
      return reply({
        root: 'root',
        principal: { tenant: 't', actor: 'a', role: 'designer', clearance: 'internal' },
        readable_sensitivities: ['internal'],
      });
    if (name === 'lingshu_mdcg_get')
      return reply(state.node || { ok: false, error: 'not_found', node_id: args.node_id });
    if (name === 'lingshu_mdcg_remember') return reply(remember(args, state));
    return reply({ ok: true });
  };
  for (const name of LINGSHU_TOOLS) tools.set(name, { execute: (args) => invoke(name, args) });
  const agent = { session: { header: { id: 'diary-session', cwd: os.tmpdir() } }, ctx: {} };
  const ctx = {
    get: (n) =>
      n === 'tools' ? { get: (name) => tools.get(name) } : n === 'agents' ? { get: () => agent } : null,
  };
  return { ctx, agent, calls, state };
}
const write = (h, content = 'same text') =>
  writeLingshu(h.ctx, { args: { content, tags: [] }, exec: { agent: h.agent, signal: AbortSignal.timeout(5000) } });

test('lingshu dedupe hit on a memory this plugin did not write is not registered for maintenance', async () => {
  const h = host({
    node: {
      frontmatter: { id: 'mem_other', session: 'diary-session', layer: 'contextual', tags: ['auto-capture'] },
      content: 'same text',
    },
    remember: () => ({ ok: true, id: 'mem_other', deduped: true }),
  });
  const receipt = await write(h);
  assert.equal(receipt.status, 'deduplicated');
  assert.deepEqual(receipt.ids, ['mem_other']);
  assert.equal(receipt.maintenance, undefined);
});

test('lingshu dedupe hit on this plugin’s own earlier write stays maintainable', async () => {
  const h = host({
    node: {
      frontmatter: { id: 'mem_own', session: 'diary-session', layer: 'contextual', tags: ['discord-diary'] },
      content: 'same text',
    },
    remember: () => ({ ok: true, id: 'mem_own', deduped: true }),
  });
  const receipt = await write(h);
  assert.equal(receipt.status, 'deduplicated');
  assert.equal(receipt.maintenance?.sessionId, 'diary-session');
});

test('lingshu correction keeps the plugin’s conflict check and reports a blocked write as rejected', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingshu-fix7-'));
  const h = host({
    node: null,
    remember: (args, state) => {
      if (!args.node_id) {
        state.node = {
          frontmatter: { id: 'mem_x', session: 'diary-session', layer: 'contextual', tags: args.tags },
          content: args.content,
        };
        return { ok: true, id: 'mem_x' };
      }
      return { ok: false, id: 'mem_x', committed: false, moved_to: 'conflict_deferred', verdict: 'DEFER' };
    },
  });
  h.agent.session.header.cwd = root;
  const receipt = await write(h, 'original');
  const output = {
    root,
    manifest: {
      artifacts: [
        {
          id: 'artifact',
          cwd: root,
          channelId: 'test',
          diary: { sessionId: 'diary-session' },
          memory: { receipts: [{ ...receipt, writer: 'lingshu', evidenceIds: ['source'] }] },
        },
      ],
    },
    flush: async () => {},
  };
  const manager = new MemoryMaintenance({
    history: {},
    output,
    bridge: {},
    contracts: new MemoryContracts({ ctx: h.ctx }),
    getConfig: () => ({ enabled: true }),
  });
  try {
    await manager.init();
    const key = manager.references()[0].key;
    const preview = await manager.previewExternal({ targetKey: key, action: 'correct', replacement: 'new' });
    const result = await manager.applyExternal(preview.id);
    const call = h.calls.find((c) => c.name === 'lingshu_mdcg_remember' && c.args.node_id);
    assert.notEqual(call.args.consistency, false);
    assert.equal(call.args.on_conflict, 'defer');
    assert.equal(call.args.override, false);
    assert.equal(result.receipt.status, 'rejected');
    assert.equal(h.state.node.content, 'original');
    assert.equal(manager.blocked(key), false);
  } finally {
    manager.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});


test('lingshu initial write conflict is failed rather than pending review', async () => {
 const h=host({node:null,remember:()=>({ok:false,id:'mem_conflict',committed:false,moved_to:'conflict_deferred',verdict:'DEFER'})});
 const receipt=await write(h,'conflicting text');
 assert.equal(receipt.status,'failed');assert.deepEqual(receipt.ids,[]);assert.equal(receipt.maintenance,undefined);
});
