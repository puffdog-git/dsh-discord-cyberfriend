import { lingshuReady, writeLingshu } from './memory-lingshu.js';
import { appendFile, readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

// The diary model remains tool-restricted. An explicitly selected connector
// resolves a global public definition, then passes the genuine Agent to execute
// so the memory plugin retains its own workspace/trust/write checks.
const tool = (ctx, name, agent) => {
  try {
    const tools = ctx.get?.('tools') || ctx.tools;
    return tools?.get?.(name) || tools?.get?.(name, agent);
  } catch {
    return undefined;
  }
};
export const MEMORY_CONNECTORS = [
  {
    id: 'memu',
    name: 'memU（預設）',
    tool: 'memu_private_remember',
    mode: 'tool',
    note: '預設依 memU 正式工具與工作區綁定寫入；失敗不自動轉送其他記憶系統。',
  },
  {
    id: 'meow',
    name: '喵記憶',
    tool: 'memory_remember',
    mode: 'tool',
    note: '工作區內的 Discord 專案記憶；不寫全域人格或規則。',
  },
  {
    id: 'lingshu',
    name: '靈樞 dsh-memory',
    mode: 'tool',
    tool: 'lingshu_mdcg_remember',
    note: '直接寫入並保留精確維護回執；需 brain 工具集及相容別名，不自動核准待審提案。',
  },
  {
    id: 'files',
    name: '通用檔案交付',
    mode: 'file',
    note: '輸出有來源的候選 JSONL，配合日記 Markdown 匯入；不代表任何外部插件已入庫。',
  },
  {
    id: 'session',
    name: 'DSH 正式會話自動整理',
    mode: 'session',
    note: '日記已在正式 Agent 會話；由已啟用的記憶插件依自身策略捕獲，不額外重送、不保證已提煉。',
  },
];
// This is an output-compatibility catalogue, not a list of active plugins or
// invented writer IDs. The host/plugin still owns capture, scope and receipts.
export const MEMORY_SYSTEMS = Object.freeze(
  [
    { id: 'memu', name: 'memU', routes: '直接寫入器 memu（預設）', note: '沿用其工作區／記憶庫綁定。' },
    {
      id: 'meow',
      name: '喵記憶',
      routes: '直接寫入器 meow；正式會話',
      note: '依工作區與專案範圍，需先載入插件。',
    },
    {
      id: 'fish',
      name: '魚的記憶',
      routes: '正式會話工具；files 匯入',
      note: '預設按 session；跨會話共用須設定工作區模式或明確匯入目標庫。',
    },
    {
      id: 'prime',
      name: 'Prime Memory',
      routes: 'session 正式會話捕獲；lingshu 直接寫入與精確回執維護',
      note: '是否提煉由插件自己的模式與背景工作決定。',
    },
    {
      id: 'mnemon',
      name: 'Mnemon／Mem0／Supermemory 等 Provider',
      routes: '正式會話；files／文件交付',
      note: '已驗證 Mnemon 本機文件 Source；各雲端 Provider 仍需服務驗收，沿用 View／空間權限。',
    },
    {
      id: 'lingshu',
      name: '靈樞 dsh-memory',
      routes: 'session 正式會話捕獲；通用來源',
      note: '圖庫／租戶／私有設定由靈樞管理，session 標記本身不代表私有。',
    },
    {
      id: 'openviking',
      name: 'OpenViking',
      routes: 'session 正式會話捕獲與 context 召回',
      note: '需後端與使用者金鑰，沿用 account／user／peer 範圍。',
    },
    {
      id: 'hindsight',
      name: 'Hindsight Coding Agents',
      routes: 'session 正式會話回寫與召回',
      note: '需後端並設定正確 bank，寫入接受不等於抽取完成。',
    },
    {
      id: 'soul',
      name: 'Soul-md',
      routes: '正式會話人格／記憶工具；files 交付',
      note: '記憶跟著人格卡，無卡則全域；session 交付不保證自動寫入。',
    },
  ].map(Object.freeze),
);
export function connectorSnapshot(ctx, writers) {
  return MEMORY_CONNECTORS.map((c) => ({
    ...c,
    registered: c.id === 'session' || writers.has(c.id),
    available:
      c.id === 'lingshu' ? lingshuReady(ctx) : c.mode === 'tool' ? !!tool(ctx, c.tool)?.execute : true,
  }));
}
export function installMemoryConnectors(owner) {
  owner.registerMemoryWriter('lingshu', (input) => writeLingshu(owner.ctx, input));
  owner.registerMemoryWriter('meow', async ({ args, exec }) => {
    const definition = tool(owner.ctx, 'memory_remember', exec.agent);
    if (!definition?.execute) throw Error('喵記憶工具未註冊；請先載入 meow-memory');
    exec.signal.throwIfAborted();
    const result = await definition.execute(
      {
        content: args.content,
        level: 'fact',
        project: 'discord-diary',
        importance: 1,
        keywords: [args.title, ...args.tags].filter(Boolean).slice(0, 8),
      },
      exec,
    );
    if (result?.ok !== true) return { status: 'failed', ids: [], detail: '喵記憶未確認寫入' };
    const id = typeof result.id === 'string' && result.id.trim() ? result.id : null;
    return {
      status: id ? (result.merged ? 'deduplicated' : 'stored') : 'unverified',
      ids: id ? [id] : [],
      detail: id ? '喵記憶正式工具回傳記憶 ID' : '工具接受但未提供可核對的記憶 ID',
    };
  });
  owner.registerMemoryWriter('files', async ({ args, exec, sourcePath, evidenceIds, cwd, sessionId }) => {
    if (!isAbsolute(sourcePath || '')) throw Error('通用交付需要日記的完整路徑');
    exec.signal.throwIfAborted();
    const file = sourcePath + '.candidates.jsonl';
    let records = [];
    try {
      const raw = await readFile(file, 'utf8');
      if (raw.length > 5 * 1024 * 1024) throw Error('候選檔超過上限');
      records = raw.split('\n').filter(Boolean).map(JSON.parse);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    if (
      !records.some(
        (r) => r.factKey === args.fact_key && r.content === args.content && r.title === args.title,
      )
    )
      await appendFile(
        file,
        JSON.stringify({
          schema: 'dsh.discord.memory-candidate',
          version: 1,
          factKey: args.fact_key,
          title: args.title,
          content: args.content,
          tags: args.tags,
          source: 'inferred',
          cwd,
          sessionId,
          sourcePath,
          evidenceIds,
          createdAt: new Date().toISOString(),
        }) + '\n',
        'utf8',
      );
    return {
      status: 'exported',
      ids: [],
      path: file,
      detail: '候選檔已交付；請在記憶插件匯入或設定文件來源，尚未確認外部入庫',
    };
  });
}
