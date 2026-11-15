import { lingshuAdapter } from "./memory-lingshu.js";
import { createHash, randomUUID } from "node:crypto";
import { MEMORY_SYSTEMS } from "./memory-connectors.js";
import {
  diagnoseCapabilityFailure,
  observeCapability,
} from "./capability-diagnostics.js";
const hash = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
const bounded = (work, signal) =>
  new Promise((resolve, reject) => {
    const abort = () =>
      reject(Error("timeout: memory operation outcome uncertain"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    Promise.resolve(work)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
const label = (x) =>
  String(x || "")
    .slice(0, 120)
    .replace(/[^\w@./: -]/g, "_");
const service = (ctx, n) => {
  try {
    return ctx?.get?.(n) || ctx?.[n];
  } catch {
    return null;
  }
};
export function memuScope(text) {
  return (
    /私有[记記][忆憶][库庫] ([\w.-]+)[（(]/.exec(String(text))?.[1] || null
  );
}
export class MemoryContracts {
  constructor({ ctx, now = Date.now, timeoutMs = 30000 } = {}) {
    this.ctx = ctx;
    this.now = now;
    this.timeoutMs = timeoutMs;
    this.activeWrites = new Set();
    this.identities = new WeakMap();
    this.nextIdentity = 0;
    this.adapters = new Map();
    this.register({
      id: "memu",
      name: "memU",
      actions: { correct: "corrected", forget: "archived" },
      available: () =>
        !!this.tool("memu_private_list") &&
        !!this.tool("memu_private_update") &&
        !!this.tool("memu_private_archive"),
      inspect: async ({ reference, signal }) => {
        const exec = this.exec(reference, signal),
          text = String(
            await this.tool("memu_private_list").execute(
              { limit: 200, offset: 0 },
              exec,
            ),
          ),
          scopeKey = memuScope(text);
        if (!scopeKey) throw Error("原會話沒有可核對的記憶庫綁定");
        const lines = text.split("\n"),
          start = lines.findIndex((l) =>
            new RegExp(
              "^- \\[" +
                reference.memoryId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                "\\]",
            ).test(l),
          );
        if (start < 0) return { found: false, scopeKey, revision: "not-found" };
        let end = start + 1;
        while (end < lines.length && !/^- \[/.test(lines[end])) end++;
        const entry = lines.slice(start, end).join("\n");
        if (/ · lib=/.test(entry)) throw Error("跨庫記憶僅可讀，不能修改");
        return {
          found: true,
          scopeKey,
          revision: hash([
            entry,
            ...[
              "memu_private_list",
              "memu_private_update",
              "memu_private_archive",
            ].map((n) => this.identity(this.tool(n)?.execute)),
          ]),
          note: "僅核對前200筆目錄；原插件沒有原子版本更新契約。",
        };
      },
      execute: async ({ reference, action, replacement, signal }) => {
        const name =
            action === "forget"
              ? "memu_private_archive"
              : "memu_private_update",
          result = String(
            await this.tool(name).execute(
              {
                id: reference.memoryId,
                ...(action === "correct" ? { content: replacement } : {}),
              },
              this.exec(reference, signal),
            ),
          );
        const prefix = action === "forget" ? "已(?:归档|歸檔) " : "已更新 ";
        return {
          status: new RegExp(
            "^" +
              prefix +
              reference.memoryId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
              "(?:[。:]|$)",
          ).test(result)
            ? action === "forget"
              ? "archived"
              : "corrected"
            : "uncertain",
          ids: [reference.memoryId],
          scopeKey: reference.scopeKey,
        };
      },
    });
    this.register(lingshuAdapter(this));
  }
  identity(fn) {
    if (!fn) return null;
    if (!this.identities.has(fn)) this.identities.set(fn, ++this.nextIdentity);
    return this.identities.get(fn);
  }
  writeKey(ref) {
    return JSON.stringify([ref.writer, ref.scopeKey, ref.memoryId]);
  }
  tool(name) {
    const t = service(this.ctx, "tools")?.get?.(name);
    return t?.execute ? t : null;
  }
  exec(ref, signal) {
    const agent = service(this.ctx, "agents")?.get?.(ref.sessionId);
    if (
      !agent ||
      agent.session?.header?.id !== ref.sessionId ||
      agent.session.header.cwd !== ref.cwd
    )
      throw Object.assign(
        Error("原日記會話未載入或工作區已改變；請先在 DSH 開啟原會話"),
        {
          diagnosticCode: "SCOPE",
        },
      );
    return { agent, ctx: agent.ctx, logger: agent.ctx?.logger, signal };
  }
  register(adapter) {
    if (
      !/^[a-zA-Z0-9_.-]{1,64}$/.test(adapter?.id) ||
      !adapter.actions ||
      typeof adapter.inspect !== "function" ||
      typeof adapter.execute !== "function"
    )
      throw Error("記憶維護契約不完整");
    if (this.adapters.has(adapter.id)) throw Error("記憶維護契約已註冊");
    for (const [a, s] of Object.entries(adapter.actions))
      if (
        !{
          correct: ["corrected"],
          forget: ["archived", "suppressed", "deleted"],
          delete: ["deleted"],
        }[a]?.includes(s)
      )
        throw Error("記憶維護操作與效果不一致");
    const value = {
      ...adapter,
      actions: Object.freeze({ ...adapter.actions }),
    };
    this.adapters.set(value.id, value);
    return () => {
      if (this.adapters.get(value.id) === value) this.adapters.delete(value.id);
    };
  }
  signature(id) {
    const a = this.adapters.get(id);
    return [
      this.identity(a?.inspect),
      this.identity(a?.execute),
      this.identity(a?.reconcile),
      ...(a?.signature?.() || []),
      ...(id === "memu"
        ? [
            "memu_private_list",
            "memu_private_update",
            "memu_private_archive",
          ].map((n) => this.identity(this.tool(n)?.execute))
        : []),
    ];
  }
  catalog() {
    const ids = new Set([
      ...MEMORY_SYSTEMS.map((x) => x.id),
      ...this.adapters.keys(),
    ]);
    return [...ids].map((id) => {
      const a = this.adapters.get(id);
      let ready = false;
      try {
        ready = !!a && (!a.available || a.available());
      } catch {}
      return {
        id,
        name:
          MEMORY_SYSTEMS.find((x) => x.id === id)?.name || label(a?.name || id),
        registered: !!a,
        available: ready,
        actions: Object.fromEntries(
          ["correct", "forget", "delete"].map((action) => [
            action,
            {
              supported: ready && !!a.actions[action],
              effect: a?.actions[action] || null,
            },
          ]),
        ),
        note: !a
          ? "未註冊維護契約，請到原插件操作；寫入／召回相容不代表支援修改或刪除"
          : !ready
            ? id === "lingshu"
              ? "靈樞維護需啟用 brain 工具集與 lingshu 相容別名；目前工具未齊全，請先到原插件設定。"
              : "維護接口未載入"
            : id === "memu"
              ? "忘記是歸檔，保留原資料；不支援永久刪除。需原日記會話已載入與新式作用域回執。"
              : id === "lingshu"
                ? "更正與軟刪除可能待審，不自動核准；需 brain 工具集及 lingshu 別名。只處理直接寫入器保存的精確回執，舊自動捕獲記憶請到原插件處理。"
                : "依明確註冊的作用域與操作契約執行",
      };
    });
  }
  references(artifacts) {
    const refs = [];
    for (const a of artifacts)
      for (const r of a.memory?.receipts || [])
        for (const memoryId of r.ids || []) {
          if (
            typeof memoryId !== "string" ||
            !memoryId.trim() ||
            memoryId.length > 180 ||
            !/^[\w:./-]+$/.test(memoryId)
          )
            continue;
          const value = {
            writer: r.writer,
            memoryId,
            sessionId: r.maintenance?.sessionId || a.diary?.sessionId,
            cwd: a.cwd,
            scopeKey: r.maintenance?.scopeKey || null,
            evidenceIds: r.evidenceIds || [],
            status: r.status,
            channelId: String(a.channelId),
            artifactId: a.id,
          };
          value.key = hash([
            value.writer,
            value.memoryId,
            value.sessionId,
            value.cwd,
            value.artifactId,
          ]).slice(0, 32);
          refs.push(value);
        }
    return refs;
  }
  async inspect(
    ref,
    action,
    { signal = AbortSignal.timeout(this.timeoutMs) } = {},
  ) {
    const adapter = this.adapters.get(ref.writer),
      catalog = this.catalog().find((x) => x.id === ref.writer);
    if (!adapter || !catalog?.actions[action]?.supported)
      throw Error("外部插件未宣告此操作或接口尚未載入");
    if (
      !ref.scopeKey ||
      !ref.sessionId ||
      !ref.cwd ||
      !["stored", "deduplicated"].includes(ref.status)
    )
      throw Error("原回執缺少可核對作用域或尚未確認入庫，請到原插件處理");
    let snapshot;
    try {
      snapshot = await bounded(
        adapter.inspect({ reference: structuredClone(ref), signal }),
        signal,
      );
    } catch (error) {
      const issue = diagnoseCapabilityFailure(error);
      throw Object.assign(Error(issue.summary + "；" + issue.fix), {
        diagnosticCode: issue.code,
      });
    }
    signal.throwIfAborted();
    if (
      snapshot?.found !== true ||
      snapshot.scopeKey !== ref.scopeKey ||
      typeof snapshot.revision !== "string" ||
      !snapshot.revision
    )
      throw Error("原記憶不存在、作用域改變或未回報版本");
    return {
      snapshot: { scopeKey: snapshot.scopeKey, revision: snapshot.revision },
      adapter,
      effect: adapter.actions[action],
    };
  }
  async execute(ref, action, replacement, preview) {
    const current = await this.inspect(ref, action);
    if (
      current.adapter !== preview.adapter ||
      hash(current.snapshot) !== hash(preview.snapshot)
    )
      throw Error("外部記憶或維護契約已變更，請重新預覽");
    const signal = AbortSignal.timeout(this.timeoutMs);
    return observeCapability(
      this.ctx,
      "memory.maintenance:" + ref.writer,
      "memory-" + action,
      async () => {
        const key = this.writeKey(ref);
        if (this.activeWrites.has(key))
          throw Error("同一記憶仍有外部操作進行中");
        this.activeWrites.add(key);
        const work = Promise.resolve().then(() => {
          signal.throwIfAborted();
          return current.adapter.execute({
            reference: structuredClone(ref),
            action,
            replacement,
            expectedRevision: current.snapshot.revision,
            signal,
          });
        });
        void work.then(
          () => this.activeWrites.delete(key),
          () => this.activeWrites.delete(key),
        );
        const r = await bounded(work, signal);
        signal.throwIfAborted();
        if (
          r?.status === "pending_review" &&
          ref.writer === "lingshu" &&
          /^prop_[\w-]{1,100}$/.test(r.proposalId || "") &&
          r.scopeKey === ref.scopeKey &&
          r.ids?.length === 1 &&
          r.ids[0] === ref.memoryId &&
          (action === "forget" ||
            /^[a-f0-9]{64}$/.test(r.verification?.contentHash || ""))
        )
          return {
            status: "pending_review",
            proposalId: r.proposalId,
            verification: { contentHash: r.verification?.contentHash || null },
          };
        if (
          r?.status === "rejected" &&
          ref.writer === "lingshu" &&
          r.scopeKey === ref.scopeKey &&
          r.ids?.length === 1 &&
          r.ids[0] === ref.memoryId
        )
          return { status: "rejected" };
        if (
          r?.status !== current.effect ||
          r.scopeKey !== ref.scopeKey ||
          !Array.isArray(r.ids) ||
          r.ids.length !== 1 ||
          r.ids[0] !== ref.memoryId
        )
          return {
            status: "uncertain",
            diagnostic: diagnoseCapabilityFailure("uncertain"),
          };
        return { status: r.status };
      },
      {
        outcome: (r) =>
          ["uncertain", "pending_review"].includes(r.status)
            ? "unconfirmed"
            : "passed",
      },
    );
  }
}
