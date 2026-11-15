import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { sourceUrl } from './source-url.js';
export { sourceUrl } from './source-url.js';
const STAGES = [
  'video_info',
  'video_download',
  'cover_doctor',
  'cover_separate',
  'cover_shift',
  'cover_convert',
  'cover_mix',
  'cover_verify',
];
const hash = (b) => createHash('sha256').update(b).digest('hex');
async function contained(root, file) {
  const base = await fs.realpath(root),
    real = await fs.realpath(file),
    rel = path.relative(base, real);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('外部插件回傳了工作範圍外的檔案');
  const info = await fs.stat(real);
  if (!info.isFile() || !info.size || info.size > 256 * 1024 * 1024)
    throw Error('音訊檔案為空或超過 256 MiB');
  return real;
}
async function normalize(source, target, preview, signal) {
  await new Promise((resolve, reject) => {
    const p = spawn(
        ffmpeg,
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-i',
          source,
          '-t',
          preview ? '25' : '601',
          '-vn',
          '-ar',
          '44100',
          '-ac',
          '2',
          '-c:a',
          'pcm_f32le',
          '-y',
          target,
        ],
        { windowsHide: true, stdio: 'ignore' },
      ),
      abort = () => p.kill(),
      timer = setTimeout(abort, 120000);
    signal.addEventListener('abort', abort, { once: true });
    const clean = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    p.on('error', (e) => {
      clean();
      reject(e);
    });
    p.on('close', (c) => {
      clean();
      if (signal.aborted) return reject(signal.reason);
      c ? reject(Error('音源正規化失敗')) : resolve();
    });
    if (signal.aborted) abort();
  });
}
export function createSongJobs({ tools, delivery, prepare = normalize, timeoutMs = 1800000 }) {
  const jobs = new Map(),
    creating = new Set();
  let tail = Promise.resolve(),
    closed = false;
  const publicJob = (j) => ({
    id: j.id,
    state: j.state,
    stage: j.stage,
    mode: j.mode,
    delivery: j.destination,
    technicalVerified: !!j.verified,
    listeningAccepted: false,
    error: j.error || null,
  });
  function owned(id, exec) {
    const j = jobs.get(id);
    if (
      !j ||
      j.owner !== (exec.agent?.session?.id || exec.agent?.session?.header?.id) ||
      (j.actorId && j.actorId !== exec.discordActorId && !exec.discordAdmin)
    )
      throw Error('沒有可存取的歌曲工作');
    return j;
  }
  async function tool(j, name, args) {
    j.controller.signal.throwIfAborted();
    delivery.check(j.cap);
    j.stage = name;
    if (tools.executable(name, j.agent) !== j.definitions.get(name))
      throw Error('工作執行期間工具或授權已變更');
    const out = await tools.execute({
      agent: j.agent,
      signal: j.controller.signal,
      calls: [{ type: 'tool-call', id: randomUUID(), name, arguments: JSON.stringify(args) }],
    });
    j.controller.signal.throwIfAborted();
    const result = out.results?.[0]?.result;
    if (!result || result.isError || result.value?.ok === false)
      throw Error('外部 ' + name + ' 未完成，請檢查原插件的設定與執行紀錄');
    return result.value;
  }
  async function artifact(j, result, expected) {
    if (
      result?.phase !== 'executed' ||
      result?.artifactsOk !== true ||
      !result.artifacts?.some((a) => a.exists === true && path.resolve(a.path) === path.resolve(expected))
    )
      throw Error('外部插件未回傳已驗證的本工作成品；預演不算成功');
    return contained(j.root, expected);
  }
  async function run(j) {
    const signal = j.controller.signal,
      timer = setTimeout(() => {
        j.state = 'cancelling';
        j.controller.abort();
      }, timeoutMs);
    timer.unref?.();
    try {
      signal.throwIfAborted();
      j.state = 'running';
      const doctor = await tool(j, 'cover_doctor', {});
      if (doctor.ok !== true) throw Error('翻唱環境未就緒');
      const info = await tool(j, 'video_info', { url: j.url, networkPolicy: 'public-only' });
      if (info.networkPolicy !== 'public-only') throw Error('下載器沒有確認公開網路限制');
      if (!info.title || !info.webpageUrl) throw Error('音源資訊不完整');
      const fields = String(info.duration || '')
        .split(':')
        .map(Number);
      const duration = fields.reduce((a, b) => a * 60 + b, 0);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 600)
        throw Error('音源須為 10 分鐘內的單曲');
      const downloads = path.join(j.root, 'download');
      await fs.mkdir(downloads, { recursive: true });
      const download = await tool(j, 'video_download', {
        url: j.url,
        audioOnly: true,
        audioFormat: 'wav',
        playList: false,
        outdir: downloads,
        networkPolicy: 'public-only',
      });
      if (download.networkPolicy !== 'public-only') throw Error('下載器沒有確認公開網路限制');
      if (download.files?.length !== 1 || !download.files[0]?.path) throw Error('下載必須回傳唯一音訊檔');
      const input = await contained(downloads, download.files[0].path);
      j.sourceHash = hash(await fs.readFile(input));
      if (j.preview && j.preview.sourceHash !== j.sourceHash) throw Error('音源與已確認的試唱不同');
      const inputFolder = path.join(j.root, 'input');
      await fs.mkdir(inputFolder);
      const source = path.join(inputFolder, 'source.wav');
      j.stage = 'prepare-source';
      await prepare(input, source, j.mode === 'preview', signal);
      signal.throwIfAborted();
      if ((await delivery.inspect(j.cap, source)).seconds > 600)
        throw Error('音源實際超過 10 分鐘，不會截斷整曲');
      const separated = path.join(j.root, 'separated'),
        sep = await tool(j, 'cover_separate', { inputFolder, outDir: separated, karaoke: true });
      const inst = await artifact(j, sep, path.join(separated, 'source', 'instrumental.wav'));
      const lead = await artifact(j, sep.karaokeResult, path.join(separated, 'kara', 'source', 'Vocals.wav'));
      const harm = await artifact(
        j,
        sep.karaokeResult,
        path.join(separated, 'kara', 'source', 'instrumental.wav'),
      );
      let accompaniment = inst,
        harmony = harm;
      if (j.key) {
        const shiftDir = path.join(j.root, 'shifted'),
          shift = await tool(j, 'cover_shift', {
            key: j.key,
            instSrc: inst,
            harmSrc: harm,
            outDir: shiftDir,
          });
        accompaniment = await artifact(j, shift, path.join(shiftDir, 'inst.wav'));
        harmony = await artifact(j, shift, path.join(shiftDir, 'harm.wav'));
      }
      const outDir = path.join(j.root, 'converted'),
        mode = j.mode === 'preview' ? 'pilot' : 'full',
        converted = await tool(j, 'cover_convert', {
          src: lead,
          key: j.key,
          outDir,
          mode,
          backend: 'baseline',
          start: 0,
          duration: 25,
          ...(j.voice ? { voice: j.voice } : {}),
        });
      const convertedLead = await artifact(
        j,
        converted,
        path.join(outDir, `lead_${mode}_k${j.key >= 0 ? '+' : ''}${j.key}.wav`),
      );
      const provenance = JSON.parse(
        await fs.readFile(await contained(j.root, convertedLead + '.conversion.json'), 'utf8'),
      );
      j.modelHash = provenance.modelSha256;
      if (typeof j.modelHash !== 'string' || (j.preview && j.preview.modelHash !== j.modelHash))
        throw Error('唱歌模型與已確認的試唱不同或缺少來源資料');
      const master = path.join(j.root, 'master.wav'),
        mixed = await tool(j, 'cover_mix', {
          inst: accompaniment,
          lead: convertedLead,
          harm: harmony,
          out: master,
          profile: 'standard',
        });
      j.output = await artifact(j, mixed, master);
      const verification = path.join(j.root, 'master.verify.json'),
        verified = await tool(j, 'cover_verify', { wav: master, json: verification });
      await artifact(j, verified, verification);
      if (verified.technicalChecksPassed !== true) throw Error('成品技術檢查未通過');
      j.verified = true;
      signal.throwIfAborted();
      delivery.check(j.cap);
      j.stage = 'discord-delivery';
      await delivery.deliver(j.cap, j.output, {
        signal,
        label: j.mode === 'preview' ? '翻唱試唱片段' : '翻唱成品',
      });
      j.state = 'delivered';
    } catch (error) {
      j.state = error.code === 'DELIVERY_UNKNOWN' ? 'unknown' : signal.aborted ? 'cancelled' : 'failed';
      j.error =
        j.state === 'unknown'
          ? 'Discord 送達結果不明，請先確認，系統不會自動重送'
          : signal.aborted
            ? '工作已取消；外部程序結束前不會執行下一步'
            : String(error.message || '歌曲工作失敗').slice(0, 220);
    } finally {
      clearTimeout(timer);
      j.finished = true;
    }
  }
  return {
    async start(args, exec) {
      if (closed) throw Error('唱歌工作橋接已停用');
      const owner = exec.agent?.session?.id || exec.agent?.session?.header?.id;
      if (!owner) throw Error('需要正式會話');
      if (creating.has(owner)) throw Error('此會話正在建立歌曲工作');
      creating.add(owner);
      try {
        exec.signal.throwIfAborted();
        if ([...jobs.values()].some((j) => j.owner === owner && !j.finished))
          throw Error('此會話已有歌曲工作');
        if (jobs.size >= 20) throw Error('已達本次啟動 20 筆工作上限，請先整理成品並重啟橋接');
        const url = sourceUrl(args.url),
          mode = args.mode || 'preview',
          destination = args.destination || 'attachment',
          key = args.key ?? 0,
          voice = String(args.voice || '').trim();
        if (
          !['preview', 'full'].includes(mode) ||
          !['attachment', 'voice-room'].includes(destination) ||
          !Number.isInteger(key) ||
          Math.abs(key) > 12 ||
          voice.length > 100
        )
          throw Error('歌曲參數不正確');
        const preview = mode === 'full' ? owned(args.approvedPreviewId, exec) : null;
        if (
          preview &&
          (!preview.verified ||
            preview.mode !== 'preview' ||
            preview.state !== 'delivered' ||
            preview.url !== url ||
            preview.voice !== voice ||
            preview.key !== key ||
            args.approveFull !== true)
        )
          throw Error('整曲需要使用者確認同音源、音色及移調的試唱');
        const definitions = new Map(STAGES.map((n) => [n, tools.executable(n, exec.agent)]));
        if ([...definitions.values()].some((v) => !v))
          throw Error('翻唱引擎還沒準備好：請先載入並授權翻唱插件（dsh-cover-pipeline）的工具');
        if (
          ['video_info', 'video_download'].some(
            (n) => !definitions.get(n).parameters?.properties?.networkPolicy?.enum?.includes('public-only'),
          )
        )
          throw Error('下載器版本未支援公開網路限制，請先更新；不會退回無保護下載');
        const cap = delivery.capture(exec.agent, destination),
          base = path.join(cap.workspace, '.dsh-song-jobs');
        await fs.mkdir(base, { recursive: true });
        const realBase = await fs.realpath(base),
          workspace = await fs.realpath(cap.workspace);
        if (path.dirname(realBase) !== workspace) throw Error('歌曲工作目錄不能連結到工作區外');
        const id = randomUUID(),
          root = path.join(realBase, id);
        await fs.mkdir(root);
        const j = {
          id,
          root,
          owner,
          actorId: exec.discordActorId,
          agent: exec.agent,
          url,
          voice,
          key,
          mode,
          destination,
          preview,
          cap,
          definitions,
          state: 'queued',
          stage: 'queued',
          controller: new AbortController(),
          finished: false,
        };
        jobs.set(id, j);
        tail = tail.then(() => run(j));
        j.done = tail;
        return publicJob(j);
      } finally {
        creating.delete(owner);
      }
    },
    cancelManaged(id) {
      const j = jobs.get(id);
      if (!j) throw Error('找不到歌曲工作');
      if (!j.finished) {
        j.state = 'cancelling';
        j.controller.abort();
      }
      return publicJob(j);
    },
    summary() {
      return [...jobs.values()].map(publicJob);
    },
    status(id, exec) {
      return publicJob(owned(id, exec));
    },
    cancel(id, exec) {
      const j = owned(id, exec);
      if (!j.finished) {
        j.state = 'cancelling';
        j.controller.abort();
      }
      return publicJob(j);
    },
    async forget(id, exec) {
      const j = owned(id, exec);
      if (!j.finished) throw Error('工作仍在執行，請先取消並等待結束');
      const real = await fs.realpath(j.root);
      if (
        real !== path.resolve(j.root) ||
        path.basename(path.dirname(real)) !== '.dsh-song-jobs' ||
        path.basename(real) !== j.id
      )
        throw Error('工作清理路徑已變更');
      await fs.rm(real, { recursive: true, force: true });
      jobs.delete(id);
      return { ok: true, removed: true };
    },
    async settle(id, exec) {
      await owned(id, exec).done;
      return publicJob(owned(id, exec));
    },
    async close() {
      closed = true;
      for (const j of jobs.values()) if (!j.finished) j.controller.abort();
      await tail;
    },
  };
}
