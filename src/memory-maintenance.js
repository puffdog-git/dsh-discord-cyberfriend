import { MemoryContracts } from "./memory-contracts.js";
import { diagnoseCapabilityFailure } from "./capability-diagnostics.js";
import { redactSensitive } from "./security.js";
import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import { join, resolve, dirname, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const safe = (value) =>
  String(value)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 100);
async function atomic(file, text) {
  const temp = file + "." + randomUUID() + ".tmp";
  await writeFile(temp, text, { flag: "wx" });
  try {
    await rename(temp, file);
  } catch (e) {
    await unlink(temp).catch(() => {});
    throw e;
  }
}

export class MemoryMaintenance {
  constructor({
    history,
    output,
    bridge,
    cancel = () => {},
    ctx,
    getConfig = () => ({}),
    contracts,
    now = Date.now,
  }) {
    Object.assign(this, { history, output, bridge, cancel, now, getConfig });
    this.contracts = contracts || new MemoryContracts({ ctx, now });
    this.externalPlans = new Map();
    this.history.sourcePolicyFor = (channel, id) =>
      this.output.manifest.sourcePolicies?.[channel + ":" + id];
    this.plans = new Map();
    this.receipts = [];
    this.busy = false;
  }
  async init() {
    for (const [key, policy] of Object.entries(
      this.output.manifest.sourcePolicies || {},
    )) {
      const [channel, id] = key.split(":");
      if (policy.action === "forget")
        this.history.invalidate(channel, id, true);
      else {
        const old = this.history.find(channel, id);
        if (old)
          this.history.record(
            { ...old, content: policy.content, edited: true },
            old.transport || "bot",
          );
      }
    }
    await this.history.flush?.();
    try {
      const file = join(this.output.root, "maintenance-receipts.json");
      if ((await stat(file)).size > 1024 * 1024)
        throw Error("記憶維護回執超過上限");
      const rows = JSON.parse(await readFile(file, "utf8"));
      if (!Array.isArray(rows)) throw Error("記憶維護回執格式錯誤");
      this.receipts = rows
        .slice(0, 100)
        .map((r) =>
          r.kind === "external" && ["running", "prepared"].includes(r.status)
            ? {
                ...r,
                status: "uncertain",
                detail: "重啟前的外部操作未確認，請到原插件核對",
              }
            : r,
        );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  async files() {
    const out = [],
      days = await this.output.days();
    if (days.length > 500)
      throw Error("來源超過 500 天，本次不會部分略過；請先分批整理來源");
    for (const day of days) {
      const file = join(this.output.root, "events", day + ".jsonl");
      const size = (await stat(file)).size;
      if (size > 10 * 1024 * 1024) throw Error("來源檔過大，請分批處理");
      out.push({ file, text: await readFile(file, "utf8") });
      if (out.reduce((n, f) => n + f.text.length, 0) > 50 * 1024 * 1024)
        throw Error("來源資料超過本次整理上限");
    }
    return out;
  }
  matches(row, channelId, messageId) {
    return (
      String(row.channelId) === channelId &&
      [row.message?.id, row.messageId, row.target?.id].some(
        (id) => String(id || "") === messageId,
      )
    );
  }
  async preview({ channelId, messageId, action, replacement = "" }) {
    if (
      !/^\d{15,22}$/.test(channelId || "") ||
      !/^\d{15,22}$/.test(messageId || "")
    )
      throw Error("需要有效的頻道與訊息 ID");
    if (!["forget", "correct"].includes(action))
      throw Error("請選擇更正或忘記");
    if (
      action === "correct" &&
      (!replacement.trim() || replacement.length > 6000)
    )
      throw Error("更正文字須為 1–6000 字");
    const files = await this.files(),
      affected = files.filter((f) =>
        f.text
          .split("\n")
          .filter(Boolean)
          .map(JSON.parse)
          .some((row) => this.matches(row, channelId, messageId)),
      );
    const live = this.history.find(channelId, messageId);
    if (!affected.length && !live) throw Error("找不到這則訊息的本插件來源");
    const artifacts = this.output.manifest.artifacts.filter(
      (a) => String(a.channelId) === channelId,
    );
    if (artifacts.some((a) => !/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !a.cwd))
      throw Error("匯出索引不完整，請先修復索引");
    const id = randomUUID(),
      plan = {
        id,
        channelId,
        messageId,
        action,
        replacement,
        until: this.now() + 300000,
        files: affected.map((f) => ({ file: f.file, hash: digest(f.text) })),
        historyHash: digest(JSON.stringify(live || null)),
        artifacts: artifacts.map((a) => ({
          id: a.id,
          sourceHash: a.sourceHash,
        })),
      };
    this.plans.set(id, plan);
    for (const [key, p] of this.plans)
      if (p.until < this.now()) this.plans.delete(key);
    while (this.plans.size > 30)
      this.plans.delete(this.plans.keys().next().value);
    return {
      ok: true,
      id,
      action,
      channelId,
      messageId,
      expiresAt: plan.until,
      layers: [
        { layer: "本插件聊天快取", supported: true, affected: live ? 1 : 0 },
        { layer: "本插件來源紀錄", supported: true, affected: affected.length },
        {
          layer: "本插件匯出／日記檔",
          supported: true,
          affected: artifacts.length,
          note: "受影響頻道的衍生彙整檔會失效並移除，可用其餘來源重新產生；不自動呼叫模型。",
        },
        {
          layer: "DSH 正式會話",
          supported: false,
          note: "不宣稱已從正式會話刪除，請到該會話處理；更正可在後續回覆明確說明。",
        },
        ...artifacts.flatMap((a) =>
          (a.memory?.receipts || [])
            .filter((r) => r.ids?.length)
            .map((r) => ({
              layer: "外部記憶：" + r.writer,
              supported: false,
              ids: r.ids,
              note: "此寫入回執不是刪除契約；不將 memU 歸檔冒稱徹底刪除。",
            })),
        ),
        {
          layer: "Discord 原訊息／收件匣／素材紀錄／其他插件與備份",
          supported: false,
          note: "此操作只處理本插件資料，不撤回 Discord 訊息，也不會假稱其他副本都已消失。",
        },
      ],
    };
  }
  async apply(id) {
    const plan = this.plans.get(id);
    if (!plan || plan.until < this.now()) throw Error("預覽已過期，請重新預覽");
    if (this.busy) throw Error("已有記憶維護工作，請稍後重試");
    this.busy = true;
    this.output.maintenanceBusy = true;
    this.plans.delete(id);
    const receipt = {
      id,
      action: plan.action,
      channelId: plan.channelId,
      messageId: plan.messageId,
      at: this.now(),
      layers: [],
    };
    try {
      await this.output.flush();
      if (
        digest(
          JSON.stringify(
            this.history.find(plan.channelId, plan.messageId) || null,
          ),
        ) !== plan.historyHash
      )
        throw Error("來源已變動，請重新預覽");
      for (const file of plan.files)
        if (digest(await readFile(file.file, "utf8")) !== file.hash)
          throw Error("來源已變動，請重新預覽");
      if (
        digest(
          JSON.stringify(
            this.output.manifest.artifacts
              .filter((a) => String(a.channelId) === plan.channelId)
              .map((a) => ({ id: a.id, sourceHash: a.sourceHash })),
          ),
        ) !== digest(JSON.stringify(plan.artifacts))
      )
        throw Error("匯出已變動，請重新預覽");
      await this.cancel(plan.channelId, plan.messageId);
      await this.output.enqueue(async () => {
        for (const file of plan.files)
          if (digest(await readFile(file.file, "utf8")) !== file.hash)
            throw Error("來源已變動，請重新預覽");
        const policy = {
          action: plan.action,
          at: this.now(),
          ...(plan.action === "correct" ? { content: plan.replacement } : {}),
        };
        this.output.manifest.sourcePolicies ||= {};
        this.output.manifest.sourcePolicies[
          plan.channelId + ":" + plan.messageId
        ] = policy;
        // Persist policy first: an interrupted cleanup cannot silently re-import the old source.
        await atomic(
          join(this.output.root, "manifest.json"),
          JSON.stringify(this.output.manifest, null, 2) + "\n",
        );
        for (const file of plan.files) {
          const rows = (await readFile(file.file, "utf8"))
            .split("\n")
            .filter(Boolean)
            .map(JSON.parse);
          const next = rows.flatMap((row) => {
            if (!this.matches(row, plan.channelId, plan.messageId))
              return [row];
            if (plan.action === "forget") return [];
            for (const key of ["message", "target"])
              if (row[key]?.id === plan.messageId)
                row[key] = {
                  ...row[key],
                  content: plan.replacement,
                  edited: true,
                };
            return [row];
          });
          await atomic(
            file.file,
            next.map((row) => JSON.stringify(row)).join("\n") +
              (next.length ? "\n" : ""),
          );
        }
        receipt.layers.push({
          layer: "本插件來源紀錄",
          status: plan.action === "forget" ? "removed" : "corrected",
        });
        const old = this.history.find(plan.channelId, plan.messageId);
        this.history.invalidate(
          plan.channelId,
          plan.messageId,
          plan.action === "forget",
        );
        if (old && plan.action === "correct")
          this.history.record(
            { ...old, content: plan.replacement, edited: true },
            old.transport || "bot",
          );
        await this.history.flush?.();
        receipt.layers.push({
          layer: "本插件聊天快取",
          status: plan.action === "forget" ? "removed" : "corrected",
        });
        const artifacts = this.output.manifest.artifacts.filter(
          (a) => String(a.channelId) === plan.channelId,
        );
        this.output.manifest.maintenanceReferences = this.references();
        await atomic(
          join(this.output.root, "manifest.json"),
          JSON.stringify(this.output.manifest, null, 2) + "\n",
        );
        for (const a of artifacts) {
          const base = resolve(
              a.cwd,
              "memory",
              "discord",
              safe(plan.channelId),
            ),
            stem = resolve(base, a.date);
          for (const suffix of [
            ".md",
            ".json",
            ".sources.md",
            ".memory.json",
            ".md.candidates.jsonl",
          ]) {
            const file = stem + suffix;
            if (!file.startsWith(base + sep))
              throw Error("匯出路徑超出本插件範圍");
            await unlink(file).catch((e) => {
              if (e.code !== "ENOENT") throw e;
            });
          }
        }
        this.output.manifest.artifacts = this.output.manifest.artifacts.filter(
          (a) => String(a.channelId) !== plan.channelId,
        );
        this.output.messages.delete(plan.channelId + ":" + plan.messageId);
        if (plan.action === "correct") {
          for (const date of await this.output.days())
            for (const row of await this.output.events(date))
              if (
                row.message?.id === plan.messageId &&
                row.channelId === plan.channelId
              )
                this.output.observe(row);
        }
        await atomic(
          join(this.output.root, "manifest.json"),
          JSON.stringify(this.output.manifest, null, 2) + "\n",
        );
        receipt.layers.push({ layer: "本插件衍生匯出", status: "invalidated" });
      });
      receipt.layers.push({
        layer: "DSH 正式會話／外部記憶／其他副本",
        status: "unsupported",
        detail: "未自動刪除或更正，請在各系統核對",
      });
      receipt.status = "partial";
    } catch (error) {
      receipt.status = "failed";
      receipt.error = error.message;
      throw error;
    } finally {
      this.receipts.unshift(receipt);
      this.receipts = this.retainReceipts();
      try {
        await atomic(
          join(this.output.root, "maintenance-receipts.json"),
          JSON.stringify(this.receipts, null, 2) + "\n",
        ).catch(() => {
          throw Error("來源可能已處理，但回執保存失敗；請先核對，勿盲目重試");
        });
      } finally {
        this.busy = false;
        this.output.maintenanceBusy = false;
      }
    }
    return { ok: true, receipt };
  }
  retainReceipts() {
    const unresolved = this.receipts.filter(
      (r) =>
        r.kind === "external" &&
        ["prepared", "running", "uncertain", "pending_review"].includes(
          r.status,
        ),
    );
    return [
      ...unresolved,
      ...this.receipts.filter((r) => !unresolved.includes(r)).slice(0, 30),
    ];
  }
  references() {
    const rows = [
      ...(this.output.manifest.maintenanceReferences || []),
      ...this.contracts.references(this.output.manifest.artifacts),
    ];
    return [...new Map(rows.map((r) => [r.key, r])).values()];
  }
  async persistReceipts() {
    this.receipts = this.retainReceipts();
    await atomic(
      join(this.output.root, "maintenance-receipts.json"),
      JSON.stringify(this.receipts, null, 2) + "\n",
    );
  }
  enabled() {
    const c = this.getConfig();
    if (c.enabled === false || c.dryRun)
      throw Error("插件已停用或為演練模式，不能修改外部記憶");
  }
  blocked(key) {
    const target = this.references().find((r) => r.key === key);
    return this.receipts.some(
      (r) =>
        r.kind === "external" &&
        (r.targetKey === key ||
          (target &&
            r.writer === target.writer &&
            r.scopeKey === target.scopeKey &&
            r.memoryId === target.memoryId)) &&
        ["prepared", "running", "uncertain", "pending_review"].includes(
          r.status,
        ),
    );
  }
  async previewExternal({ targetKey, action, replacement = "" }) {
    this.enabled();
    if (!["correct", "forget", "delete"].includes(action))
      throw Error("請指定更正、忘記或永久刪除");
    if (
      typeof replacement !== "string" ||
      (action === "correct" &&
        (!replacement.trim() || replacement.length > 6000))
    )
      throw Error("外部更正文字須為1–6000字");
    if (
      action === "correct" &&
      redactSensitive(replacement, this.getConfig(), { privateData: true })
        .count
    )
      throw Error("更正文字含敏感資料，請先移除");
    const ref = this.references().find((r) => r.key === targetKey);
    if (!ref) throw Error("找不到本插件持有的外部寫入回執");
    if (this.blocked(ref.key))
      throw Error("此目標上次結果尚未確認，請先到原插件核對");
    if (
      ref.writer === "memu" &&
      action === "correct" &&
      (replacement.length < 50 || replacement.length > 170)
    )
      throw Error("memU記憶正文需為50–170字；請填完整的新記憶內容");
    const view = await this.contracts.inspect(ref, action);
    for (const [id, p] of this.externalPlans)
      if (p.expiresAt < this.now()) this.externalPlans.delete(id);
    if (this.externalPlans.size >= 30)
      throw Error("確認預覽已達上限，請稍後再試");
    const id = randomUUID(),
      plan = {
        id,
        ref: structuredClone(ref),
        digest: digest(JSON.stringify(ref)),
        action,
        replacement: action === "correct" ? replacement : "",
        view,
        expiresAt: this.now() + 300000,
      };
    this.externalPlans.set(id, plan);
    return {
      ok: true,
      id,
      expiresAt: plan.expiresAt,
      target: {
        writer: ref.writer,
        memoryId: ref.memoryId,
        scopeKey: ref.scopeKey,
        sessionId: ref.sessionId,
        cwd: ref.cwd,
        evidenceCount: ref.evidenceIds.length,
      },
      action,
      effect: view.effect,
      replacement: plan.replacement,
      warning:
        "只處理這一筆外部記憶，可能由多個來源共用；更正會替換整筆正文。歸檔不是永久刪除，不處理其他副本。" +
        (ref.writer === "memu"
          ? "memU僅核對目錄快照，不提供正文版本或原子更新保證。"
          : "核對原插件提供的版本；原子更新能力仍由原插件決定。"),
    };
  }
  async applyExternal(id) {
    this.enabled();
    const plan = this.externalPlans.get(id);
    if (!plan || plan.expiresAt < this.now())
      throw Error("確認預覽已到期或已使用");
    if (this.busy) throw Error("已有記憶維護工作，請稍後重試");
    if (this.blocked(plan.ref.key)) throw Error("上次外部操作未確認，請先核對");
    if (
      this.receipts.filter(
        (r) =>
          r.kind === "external" &&
          ["prepared", "running", "uncertain", "pending_review"].includes(
            r.status,
          ),
      ).length >= 70
    )
      throw Error("未確認工作已達上限，請先核對");
    this.externalPlans.delete(id);
    this.busy = true;
    this.output.maintenanceBusy = true;
    let receipt,
      started = false;
    try {
      await this.output.flush();
      const current = this.references().find((r) => r.key === plan.ref.key);
      if (!current || digest(JSON.stringify(current)) !== plan.digest)
        throw Error("原寫入回執已變更，請重新預覽");
      const before = await this.contracts.inspect(current, plan.action);
      if (
        before.adapter !== plan.view.adapter ||
        digest(JSON.stringify(before.snapshot)) !==
          digest(JSON.stringify(plan.view.snapshot))
      )
        throw Error("外部記憶或維護契約已變更，請重新預覽");
      this.enabled();
      this.output.manifest.maintenanceReferences = this.references();
      await atomic(
        join(this.output.root, "manifest.json"),
        JSON.stringify(this.output.manifest, null, 2) + "\n",
      );
      receipt = {
        id: plan.id,
        kind: "external",
        targetKey: current.key,
        writer: current.writer,
        memoryId: current.memoryId,
        scopeKey: current.scopeKey,
        action: plan.action,
        effect: plan.view.effect,
        status: "prepared",
        at: this.now(),
      };
      this.receipts.unshift(receipt);
      await this.persistReceipts();
      receipt.status = "running";
      await this.persistReceipts();
      started = true;
      const result = await this.contracts.execute(
        current,
        plan.action,
        plan.replacement,
        plan.view,
      );
      receipt.status = result.status;
      if (result.proposalId) {
        receipt.proposalId = result.proposalId;
        receipt.verification = result.verification;
      }
      receipt.detail =
        result.status === "pending_review"
          ? "已送至靈樞待審，尚未修改完成；請到原插件審核，再按核對待審結果。"
          : result.status === "rejected"
            ? "靈樞的衝突檢查擋下這次修改，記憶沒有變動；請到原插件處理衝突後再重新預覽。"
            : result.status === "uncertain"
              ? "原插件未提供匹配的操作回執，請先核對"
              : "原插件已明確回報此操作；不代表所有副本均已清除";
      receipt.diagnostic = result.diagnostic;
    } catch (error) {
      if (!receipt) throw error;
      receipt.status = started ? "uncertain" : "failed";
      receipt.diagnostic = diagnoseCapabilityFailure(error);
      receipt.detail = started
        ? "操作可能已執行，結果未確認；先到原插件核對，勿盲目重送"
        : "尚未呼叫外部修改接口";
    } finally {
      try {
        if (receipt)
          try {
            await this.persistReceipts();
          } catch {
            receipt.status = "uncertain";
            receipt.detail = "外部結果回執未能保存，請先到原插件核對";
            throw Error(receipt.detail);
          }
      } finally {
        this.busy = false;
        this.output.maintenanceBusy = false;
      }
    }
    return { ok: true, receipt };
  }
  async reconcileExternal(id) {
    if (this.closed) throw Error("記憶維護服務已卸載");
    if (this.busy) throw Error("維護工作進行中");
    const receipt = this.receipts.find(
      (r) =>
        r.id === id &&
        r.kind === "external" &&
        r.status === "pending_review" &&
        r.writer === "lingshu",
    );
    if (!receipt) throw Error("找不到待審維護回執");
    const ref = this.references().find((r) => r.key === receipt.targetKey);
    if (
      !ref ||
      ref.scopeKey !== receipt.scopeKey ||
      ref.memoryId !== receipt.memoryId ||
      ref.writer !== receipt.writer
    )
      throw Error("原記憶定位已改變，請到原插件核對");
    const adapter = this.contracts.adapters.get(ref.writer);
    if (!adapter?.reconcile || !adapter.available())
      throw Error("靈樞維護接口尚未載入");
    this.busy = true;
    const before = { ...receipt },
      signature = JSON.stringify(this.contracts.signature(ref.writer));
    let signal, onAbort;
    try {
      signal = AbortSignal.timeout(this.contracts.timeoutMs);
      const result = await Promise.race([
        adapter.reconcile({
          reference: ref,
          receipt: structuredClone(receipt),
          signal,
        }),
        new Promise((_, reject) => {
          onAbort = () => reject(Error("核對逾時；保留待審狀態"));
          signal.addEventListener("abort", onAbort, { once: true });
        }),
      ]);
      if (
        this.contracts.adapters.get(ref.writer) !== adapter ||
        JSON.stringify(this.contracts.signature(ref.writer)) !== signature
      )
        throw Error("核對期間介面卡已變更");
      if (this.closed) throw Error("記憶維護服務已卸載，保留待審結果");
      if (
        !["pending_review", "rejected", "uncertain", receipt.effect].includes(
          result?.status,
        )
      )
        throw Error("靈樞核對結果不符");
      receipt.status = result.status;
      receipt.checkedAt = this.now();
      receipt.detail =
        result.status === "pending_review"
          ? "提案尚未完成審核；不重送"
          : result.status === "rejected"
            ? "原插件已拒絕此提案"
            : result.status === "uncertain"
              ? "審核與讀回結果不符，請人工核對"
              : "原插件審核紀錄與精確記憶讀回一致";
      try {
        await this.persistReceipts();
      } catch (error) {
        for (const key of Object.keys(receipt)) delete receipt[key];
        Object.assign(receipt, before);
        throw error;
      }
      return { ok: true, receipt };
    } finally {
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      this.busy = false;
    }
  }
  async acknowledgeExternal(id) {
    if (this.busy) throw Error("維護工作進行中");
    const r = this.receipts.find((r) => r.id === id && r.kind === "external");
    if (!r || !["uncertain", "prepared", "running"].includes(r.status))
      throw Error("沒有可核對的外部工作");
    if (
      this.contracts.activeWrites.has(
        this.contracts.writeKey({
          writer: r.writer,
          scopeKey: r.scopeKey,
          memoryId: r.memoryId,
        }),
      )
    )
      throw Error("原外部呼叫仍未結束，暫不能解除鎖定");
    const before = { ...r };
    r.status = "acknowledged";
    r.detail = "操作者已自行核對原插件；此標記不代表插件驗證成功";
    r.reviewedAt = this.now();
    try {
      await this.persistReceipts();
    } catch {
      Object.keys(r).forEach((k) => delete r[k]);
      Object.assign(r, before);
      throw Error("核對標記保存失敗，仍保留重試鎖定");
    }
    return { ok: true, receipt: r };
  }
  status() {
    return {
      busy: this.busy,
      receipts: this.receipts,
      contracts: this.contracts.catalog(),
      targets: this.references().map((r) => ({
        ...r,
        blocked: this.blocked(r.key),
        scopeVerified: !!r.scopeKey,
        note: !r.scopeKey
          ? "舊回執缺少原記憶庫作用域，請到原插件操作"
          : r.evidenceIds.length > 1
            ? "此記憶含多筆來源，操作影響整筆記憶"
            : "只操作回執指定的記憶ID",
      })),
    };
  }
  close() {
    this.closed = true;
    this.externalPlans.clear();
    this.plans.clear();
  }
}
