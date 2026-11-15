import { createHash } from "node:crypto";
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const LINGSHU_TOOLS = [
  "lingshu_mdcg_whoami",
  "lingshu_mdcg_get",
  "lingshu_mdcg_remember",
  "lingshu_cg",
];
export const lingshuTool = (ctx, name) => {
  try {
    return (ctx.get?.("tools") || ctx.tools)?.get?.(name);
  } catch {
    return null;
  }
};
export const lingshuReady = (ctx) =>
  LINGSHU_TOOLS.every(
    (n) => typeof lingshuTool(ctx, n)?.execute === "function",
  );
export async function lingshuCall(ctx, name, args, exec) {
  exec.signal.throwIfAborted();
  const tool = lingshuTool(ctx, name);
  if (!tool?.execute)
    throw Error("靈樞維護工具未載入；需 brain 工具集與 lingshu 相容別名");
  const response = await tool.execute(args, exec);
  exec.signal.throwIfAborted();
  if (!Array.isArray(response?.content) || response.isError)
    throw Error("靈樞未回傳可核對的結構化結果");
  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (raw.length > 1048576) throw Error("靈樞回應超過核對上限");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error("靈樞回應不是 JSON，停止維護");
  }
  if (
    name === "lingshu_mdcg_get" &&
    value?.error === "not_found" &&
    value.node_id === args.node_id
  )
    return null;
  // 靈樞的衝突檢查擋下寫入：明確「沒有落盤、沒有入隊」，交給呼叫端回報為已拒絕。
  if (
    name === "lingshu_mdcg_remember" &&
    value?.committed === false &&
    value.moved_to === "conflict_deferred" &&
    !value.error
  )
    return value;
  if (value?.error || value?.ok === false)
    throw Error("靈樞拒絕此操作；請在原插件檢查權限或保護狀態");
  return value;
}
export async function lingshuScope(ctx, exec) {
  const who = await lingshuCall(ctx, "lingshu_mdcg_whoami", {}, exec),
    p = who?.principal;
  if (
    typeof who?.root !== "string" ||
    !who.root ||
    typeof p?.tenant !== "string" ||
    typeof p?.actor !== "string"
  )
    throw Error("靈樞未提供圖庫與租戶身分，不能猜測作用域");
  return (
    "lingshu:" +
    digest([
      who.root,
      p.tenant,
      p.actor,
      p.clearance,
      p.role,
      who.readable_sensitivities,
    ])
  );
}
const validId = (id) =>
  typeof id === "string" && /^[\w.@-]{1,128}$/.test(id) && !id.includes("..");
export const lingshuContentHash = (text) =>
  digest(String(text).replace(/\r\n/g, "\n").trimEnd());
async function node(ctx, ref, exec) {
  if (!validId(ref.memoryId)) throw Error("無效的靈樞記憶 ID");
  const value = await lingshuCall(
    ctx,
    "lingshu_mdcg_get",
    { node_id: ref.memoryId },
    exec,
  );
  if (value === null) return null;
  if (
    value?.frontmatter?.id !== ref.memoryId ||
    typeof value.content !== "string"
  )
    throw Error("靈樞記憶 ID 或正文格式不符");
  return value;
}
function revision(value) {
  const { last_access, access_count, ...meta } = value.frontmatter;
  return digest([meta, value.content]);
}
export function lingshuAdapter(contracts) {
  const ctx = contracts.ctx;
  const currentRevision = (value) =>
    digest([
      revision(value),
      ...LINGSHU_TOOLS.map((n) =>
        contracts.identity(lingshuTool(ctx, n)?.execute),
      ),
    ]);
  async function snapshot(reference, signal) {
    const exec = contracts.exec(reference, signal),
      scopeKey = await lingshuScope(ctx, exec);
    if (scopeKey !== reference.scopeKey)
      throw Error("靈樞圖庫或租戶作用域已改變");
    const value = await node(ctx, reference, exec);
    return { exec, scopeKey, value };
  }
  return {
    id: "lingshu",
    name: "靈樞 dsh-memory",
    actions: { correct: "corrected", forget: "suppressed" },
    available: () => lingshuReady(ctx),
    signature: () =>
      LINGSHU_TOOLS.map((n) =>
        contracts.identity(lingshuTool(ctx, n)?.execute),
      ),
    inspect: async ({ reference, signal }) => {
      const s = await snapshot(reference, signal);
      return {
        found: !!s.value,
        scopeKey: s.scopeKey,
        revision: s.value ? currentRevision(s.value) : "not-found",
      };
    },
    execute: async ({
      reference,
      action,
      replacement,
      expectedRevision,
      signal,
    }) => {
      const s = await snapshot(reference, signal);
      if (!s.value || currentRevision(s.value) !== expectedRevision)
        throw Error("靈樞記憶已變更，請重新預覽");
      const fm = s.value.frontmatter;
      // Do not override protected nodes or approve proposals. Preserve attribution.
      const result =
        action === "forget"
          ? await lingshuCall(
              ctx,
              "lingshu_cg",
              {
                op: "forget",
                node_id: reference.memoryId,
                reason: "Discord 操作者確認忘記此筆記憶",
                override: false,
              },
              s.exec,
            )
          : await lingshuCall(
              ctx,
              "lingshu_mdcg_remember",
              {
                node_id: reference.memoryId,
                content: replacement,
                layer: fm.layer,
                role: fm.role,
                importance: fm.importance,
                tags: fm.tags,
                session: fm.session,
                sensitivity: fm.sensitivity,
                override: false,
                // 保留靈樞自己的衝突檢查（它會排除這筆記憶本身）；被擋下時不落盤也不入隊。
                on_conflict: "defer",
              },
              s.exec,
            );
      const base = { ids: [reference.memoryId], scopeKey: s.scopeKey };
      const verification = {
        contentHash:
          action === "correct" ? lingshuContentHash(replacement) : null,
      };
      if (result?.moved_to === "conflict_deferred") {
        const unchanged = await snapshot(reference, signal);
        return {
          ...base,
          status:
            result.id === reference.memoryId &&
            unchanged.value &&
            currentRevision(unchanged.value) === expectedRevision
              ? "rejected"
              : "uncertain",
        };
      }
      if (
        result?.committed === false &&
        /^prop_[\w-]{1,100}$/.test(result.pid || "") &&
        (result.id === reference.memoryId ||
          result.node_id === reference.memoryId ||
          result.mutation?.target === reference.memoryId)
      )
        return {
          ...base,
          status: "pending_review",
          proposalId: result.pid,
          verification,
        };
      if (
        result?.ok !== true ||
        result.committed === false ||
        ![result.id, result.node_id, result.mutation?.target].includes(
          reference.memoryId,
        )
      )
        return { ...base, status: "uncertain" };
      const after = await snapshot(reference, signal);
      const verified =
        action === "correct"
          ? after.value &&
            lingshuContentHash(after.value.content) === verification.contentHash
          : after.value === null;
      return {
        ...base,
        status: verified
          ? action === "correct"
            ? "corrected"
            : "suppressed"
          : "uncertain",
      };
    },
    reconcile: async ({ reference, receipt, signal }) => {
      const s = await snapshot(reference, signal);
      const result = await lingshuCall(
        ctx,
        "lingshu_cg",
        { op: "review", action: "records", pid: receipt.proposalId },
        s.exec,
      );
      const records = Array.isArray(result?.records) ? result.records : [];
      const entry = records.findLast(
        (r) => validId(r.id) && r.tags?.includes("pid:" + receipt.proposalId),
      );
      if (!entry) return { status: "pending_review" };
      const record = await lingshuCall(
        ctx,
        "lingshu_cg",
        { op: "review", action: "verify_record", node_id: entry.id },
        s.exec,
      );
      if (
        record.ok !== true ||
        record.pid !== receipt.proposalId ||
        record.node_id !== entry.id
      )
        return { status: "uncertain" };
      const after = await snapshot(reference, signal);
      if (record.decision === "reject") return { status: "rejected" };
      if (
        record.decision !== "accept" ||
        !["accepted", "committed"].includes(record.status)
      )
        return { status: "uncertain" };
      const matches =
        receipt.action === "forget"
          ? after.value === null
          : after.value &&
            lingshuContentHash(after.value.content) ===
              receipt.verification?.contentHash;
      return {
        status: matches
          ? receipt.action === "forget"
            ? "suppressed"
            : "corrected"
          : "uncertain",
      };
    },
  };
}
export async function writeLingshu(ctx, { args, exec }) {
  const scopeKey = await lingshuScope(ctx, exec);
  const result = await lingshuCall(
    ctx,
    "lingshu_mdcg_remember",
    {
      content: args.content,
      importance: 0.5,
      tags: ["discord-diary", ...(args.tags || []).slice(0, 8)],
      session: exec.agent.session.header.id,
      role: "assistant",
      dedupe: true,
    },
    exec,
  );
  const id = result?.id || result?.node_id;
  if (result?.moved_to === "conflict_deferred")
    return {
      status: "failed",
      ids: [],
      detail: "靈樞的衝突檢查擋下這次寫入，沒有入庫",
    };
  if (result?.committed === false)
    return {
      status: "pending_review",
      ids: validId(id) ? [id] : [],
      detail: "靈樞待審，尚未確認入庫",
    };
  if (result?.ok !== true || !validId(id))
    return { status: "unverified", ids: [], detail: "靈樞未確認精確記憶 ID" };
  if ((await lingshuScope(ctx, exec)) !== scopeKey)
    throw Error("靈樞寫入期間作用域改變");
  const read = await node(ctx, { memoryId: id }, exec);
  if (
    !read ||
    lingshuContentHash(read.content) !== lingshuContentHash(args.content)
  )
    return {
      status: "unverified",
      ids: [id],
      detail: "靈樞讀回不一致，請原插件核對",
    };
  const maintenance = {
    version: 1,
    scopeKey,
    sessionId: exec.agent.session.header.id,
  };
  if (result.deduped === true) {
    // 去重命中既有記憶：只有本插件自己在同一會話寫入的那一筆（逾時重試）才登記維護定位，
    // 否則之後從 Discord 更正或忘記，動到的會是別的來源的記憶。
    const own =
      read.frontmatter.session === exec.agent.session.header.id &&
      Array.isArray(read.frontmatter.tags) &&
      read.frontmatter.tags.includes("discord-diary");
    return own
      ? {
          status: "deduplicated",
          ids: [id],
          maintenance,
          detail: "靈樞已有本插件先前寫入的相同記憶，未重複新增",
        }
      : {
          status: "deduplicated",
          ids: [id],
          detail:
            "靈樞已有相同內容的既有記憶，並非本插件寫入；未新增，也不能從這裡更正或忘記",
        };
  }
  return {
    status: "stored",
    ids: [id],
    maintenance,
    detail: "靈樞精確 ID 與正文讀回已核對",
  };
}
