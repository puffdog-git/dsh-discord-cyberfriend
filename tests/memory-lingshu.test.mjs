import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MemoryContracts } from '../src/memory-contracts.js';
import { MemoryMaintenance } from '../src/memory-maintenance.js';
import { writeLingshu, LINGSHU_TOOLS } from '../src/memory-lingshu.js';
async function fixture(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingshu-contract-')),
    calls = [],
    records = [];
  let pending = null,
    current = null,
    tenant = 'tenant-a',
    mode = 'pending';
  const agent = { session: { header: { id: 'diary-test', cwd: root } }, ctx: {} },
    tools = new Map();
  const result = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const invoke = async (name, args) => {
    calls.push({ name, args });
    if (name === 'lingshu_mdcg_whoami')
      return result({
        root,
        principal: { tenant, actor: 'actor', role: 'designer', clearance: 'internal' },
        readable_sensitivities: ['public', 'internal'],
      });
    if (name === 'lingshu_mdcg_get')
      return result(current || { ok: false, error: 'not_found', node_id: args.node_id });
    if (name === 'lingshu_mdcg_remember' && !args.node_id) {
      current = {
        frontmatter: {
          id: 'mem_test',
          session: 'diary-test',
          layer: 'knowledge',
          importance: 0.5,
          role: 'assistant',
          tags: args.tags,
        },
        content: args.content,
      };
      return result({ ok: true, id: 'mem_test' });
    }
    if (name === 'lingshu_cg' && args.op === 'review') {
      assert.notEqual(args.action, 'decide');
      return result(
        args.action === 'records'
          ? { records }
          : {
              ok: true,
              pid: pending.pid,
              node_id: records[0].id,
              decision: pending.decision,
              status: pending.decision === 'accept' ? 'accepted' : 'rejected',
            },
      );
    }
    if (mode === 'generic') return result({ ok: true });
    pending = {
      pid: 'prop_test_' + calls.length,
      action: args.op === 'forget' ? 'forget' : 'correct',
      text: args.content,
    };
    return result({ ok: true, committed: false, pid: pending.pid, mutation: { target: 'mem_test' } });
  };
  for (const name of LINGSHU_TOOLS) tools.set(name, { execute: (args) => invoke(name, args) });
  const ctx = {
    get: (n) =>
      n === 'tools' ? { get: (name) => tools.get(name) } : n === 'agents' ? { get: () => agent } : null,
  };
  const receipt = await writeLingshu(ctx, {
    args: { content: 'synthetic original', tags: [] },
    exec: { agent, signal: AbortSignal.timeout(5000) },
  });
  const contracts = new MemoryContracts({ ctx }),
    output = {
      root,
      manifest: {
        artifacts: [
          {
            id: 'artifact',
            cwd: root,
            channelId: 'test',
            diary: { sessionId: 'diary-test' },
            memory: { receipts: [{ ...receipt, writer: 'lingshu', evidenceIds: ['source'] }] },
          },
        ],
      },
      flush: async () => {},
    },
    history = {};
  const manager = new MemoryMaintenance({
    history,
    output,
    bridge: {},
    contracts,
    getConfig: () => ({ enabled: true }),
  });
  await manager.init();
  const key = manager.references()[0].key;
  const decide = (decision) => {
    pending.decision = decision;
    records.push({ id: 'rev_test_r1', tags: ['pid:' + pending.pid] });
    if (decision === 'accept') {
      if (pending.action === 'forget') current = null;
      else current.content = pending.text;
    }
  };
  try {
    await fn({
      root,
      manager,
      contracts,
      ctx,
      output,
      history,
      key,
      calls,
      tools,
      decide,
      setTenant: (x) => (tenant = x),
      setMode: (x) => (mode = x),
      getCurrent: () => current,
    });
  } finally {
    manager.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
test('lingshu review remains pending across restart, blocks retries, then verifies accepted correction and soft forget', () =>
  fixture(async (f) => {
    for (const action of ['correct', 'forget']) {
      const p = await f.manager.previewExternal({
          targetKey: f.key,
          action,
          replacement: 'synthetic replacement',
        }),
        r = await f.manager.applyExternal(p.id);
      assert.equal(r.receipt.status, 'pending_review');
      assert.ok(r.receipt.proposalId);
      assert.equal(f.manager.blocked(f.key), true);
      assert.equal((await f.manager.reconcileExternal(p.id)).receipt.status, 'pending_review');
      await assert.rejects(f.manager.acknowledgeExternal(p.id));
      await assert.rejects(f.manager.previewExternal({ targetKey: f.key, action: 'forget' }));
      const restarted = new MemoryMaintenance({
        history: f.history,
        output: f.output,
        bridge: {},
        contracts: f.contracts,
      });
      await restarted.init();
      assert.equal(restarted.blocked(f.key), true);
      restarted.close();
      f.decide('accept');
      assert.equal(
        (await f.manager.reconcileExternal(p.id)).receipt.status,
        action === 'correct' ? 'corrected' : 'suppressed',
      );
      assert.equal(f.manager.blocked(f.key), false);
    }
    assert.ok(
      f.calls
        .filter(
          (c) =>
            c.args.node_id &&
            ['lingshu_mdcg_remember', 'lingshu_cg'].includes(c.name) &&
            c.args.op !== 'review',
        )
        .every((c) => c.args.override === false),
    );
    assert.ok(
      !(await fs.readFile(path.join(f.root, 'maintenance-receipts.json'), 'utf8')).includes(
        'synthetic replacement',
      ),
    );
  }));
test('lingshu scope change refuses writes and generic ok never means completion', () =>
  fixture(async (f) => {
    const p = await f.manager.previewExternal({ targetKey: f.key, action: 'forget' });
    f.setTenant('other');
    await assert.rejects(f.manager.applyExternal(p.id));
    assert.equal(f.getCurrent().content, 'synthetic original');
    f.setTenant('tenant-a');
    f.setMode('generic');
    const q = await f.manager.previewExternal({ targetKey: f.key, action: 'forget' });
    assert.equal((await f.manager.applyExternal(q.id)).receipt.status, 'uncertain');
    assert.equal(f.manager.blocked(f.key), true);
  }));
test('lingshu rejected review is explicit and tool replacement invalidates previews', () =>
  fixture(async (f) => {
    const p = await f.manager.previewExternal({
      targetKey: f.key,
      action: 'correct',
      replacement: 'replacement',
    });
    const old = f.tools.get('lingshu_mdcg_remember');
    f.tools.set('lingshu_mdcg_remember', { execute: (...args) => old.execute(...args) });
    await assert.rejects(f.manager.applyExternal(p.id), /變更/);
    const q = await f.manager.previewExternal({ targetKey: f.key, action: 'forget' });
    await f.manager.applyExternal(q.id);
    f.decide('reject');
    assert.equal((await f.manager.reconcileExternal(q.id)).receipt.status, 'rejected');
    assert.ok(f.getCurrent());
  }));

test('lingshu reconciliation retains pending lock when persistence fails or tools change in flight', () =>
  fixture(async (f) => {
    const p = await f.manager.previewExternal({ targetKey: f.key, action: 'forget' });
    await f.manager.applyExternal(p.id);
    f.decide('accept');
    const persist = f.manager.persistReceipts;
    f.manager.persistReceipts = async () => {
      throw Error('disk failed');
    };
    await assert.rejects(f.manager.reconcileExternal(p.id), /disk failed/);
    assert.equal(f.manager.receipts[0].status, 'pending_review');
    assert.equal(f.manager.receipts[0].checkedAt, undefined);
    assert.equal(f.manager.blocked(f.key), true);
    f.manager.persistReceipts = persist;
    const adapter = f.contracts.adapters.get('lingshu'),
      reconcile = adapter.reconcile;
    adapter.reconcile = async (args) => {
      const result = await reconcile(args);
      const old = f.tools.get('lingshu_cg');
      f.tools.set('lingshu_cg', { execute: (...v) => old.execute(...v) });
      return result;
    };
    await assert.rejects(f.manager.reconcileExternal(p.id), /變更/);
    assert.equal(f.manager.receipts[0].status, 'pending_review');
    assert.equal(f.manager.blocked(f.key), true);
  }));

test('lingshu unload does not commit a late reconciliation result', () =>
  fixture(async (f) => {
    const p = await f.manager.previewExternal({ targetKey: f.key, action: 'forget' });
    await f.manager.applyExternal(p.id);
    f.decide('accept');
    const adapter = f.contracts.adapters.get('lingshu'),
      original = adapter.reconcile;
    adapter.reconcile = async (args) => {
      const result = await original(args);
      f.manager.close();
      return result;
    };
    await assert.rejects(f.manager.reconcileExternal(p.id), /卸載/);
    assert.equal(f.manager.receipts[0].status, 'pending_review');
    const disk = JSON.parse(await fs.readFile(path.join(f.root, 'maintenance-receipts.json'), 'utf8'));
    assert.ok(JSON.stringify(disk).includes('pending_review'));
  }));


test('lingshu accepted review with unchanged content remains uncertain and locked across restart', () => fixture(async f => {
 const original=f.getCurrent().content;
 const plan=await f.manager.previewExternal({targetKey:f.key,action:'correct',replacement:'conflicting replacement'});
 await f.manager.applyExternal(plan.id);f.decide('accept');f.getCurrent().content=original;
 const result=await f.manager.reconcileExternal(plan.id);assert.equal(result.receipt.status,'uncertain');assert.equal(f.manager.blocked(f.key),true);
 await assert.rejects(f.manager.previewExternal({targetKey:f.key,action:'correct',replacement:'retry'}));
 const restarted=new MemoryMaintenance({history:f.history,output:f.output,bridge:{},contracts:f.contracts});await restarted.init();assert.equal(restarted.blocked(f.key),true);restarted.close();
}));
