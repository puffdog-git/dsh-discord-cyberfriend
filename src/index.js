import { MemeImages } from './meme-images.js';
import { prepareDataDir, installedAsPackage } from './data-location.js';
import { ensureFfmpeg } from './ffmpeg-ensure.js';
import { createYtdlpRunner } from './ytdlp/runner.js';
import { createYtdlpInstaller } from './ytdlp/installer.js';
import { createPythonSetup } from './python-setup.js';
import { createVideoTools } from './ytdlp/video-tools.js';
import { FFMPEG } from './voice-audio.js';
import { createYoutubeMusic } from './ytdlp/youtube-music.js';
import { ConversationDesk } from './conversation-desk.js';
import { parseConversationAction } from './conversation-time.js';
import { CapabilityDiagnostics } from './capability-diagnostics.js';
import { musicTools } from './music-tools.js';
import { MusicProviders } from './music-providers.js';
import { youtubeMusicProvider } from './music-youtube.js';
import { CompanionControls } from './companion-controls.js';
import { createSongWorkflow } from './song-workflow/index.js';
import { MemoryMaintenance } from './memory-maintenance.js';
import { createSongDelivery } from './song-delivery.js';
import { registerDiscordSkills } from './skills.js';
import { createConfigVault } from './config-vault.js';
import { createVoiceOverview } from './voice-overview.js';
import { DiscordVoice } from './voice.js';
import { VoiceMessages } from './voice-messages.js';
import { validateTranscriptConfig } from './transcript-normalization.js';
import { TokenBudget, registerTokenBudget } from './token-budget.js';
import { UserBehavior } from './user-behavior.js';
import { UserReview } from './user-review.js';
import { UserInbox } from './user-inbox.js';
import { UserTakeover } from './user-takeover.js';
import { USER_PRESENCE_KEYS, userPresence, validatePresence } from './user-presence.js';
import { audienceConfig } from './config.js';
import { trustedAdmin, toolConfigRejection } from './security.js';
import { MediaCulture } from './media-culture.js';
import { MemoryOutput } from './memory-output.js';
import { AdminJournal } from './admin-journal.js';
import { DiscordSessions } from './session-bridge.js';
/**
 * src/index.js — dsh-discord-cyberfriend 主體（Cordis 插件）
 * ============================================================================
 * 把「使用者帳號 (Python Token 測試)」與「機器人 (Bot)」兩個 Discord 介面整合在同一個插件，
 * 共用一套：回覆策略、閒聊插話、表情反應、GIF、歷史紀錄、日誌與模型設定。
 *
 * 對外提供：
 *   - REST  /api/discord-cyberfriend/*     （給 web UI 用）
 *   - Tools discord_* / discord_cyberfriend_* （給 Agent 用）
 *   - 服務 globalThis.__DSH_DISCORD_PYSELF_LAB__（給其他插件取用目前狀態）
 * ============================================================================
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApiHandler, API_PREFIX, LEGACY_API_PREFIX } from './api.js';
import {
  buildConfigSchema,
  DEFAULTS,
  publicConfig,
  sanitizeConfig,
  SECRET_KEYS,
  tokenFingerprint,
  interactionHelpText,
} from './config.js';
import { ReplyGate } from './features/gate.js';
import { createReactionEngine } from './features/reactions.js';
import { FeiyuMoodAdapter } from './mood-adapter.js';
import { TurnCoordinator, DeliveryTrace } from './features/turn-coordinator.js';
import { createResponder } from './features/responder.js';
import { createSlangTone } from './features/slang-tone.js';
import { createSlangPreview } from './features/slang-preview.js';
import { threadCandidate, shouldCreateThread, threadOptions } from './features/thread-policy.js';
import { ConfigHistory } from './config-history.js';
import { FollowupWindow } from './features/followup.js';
import { createControls } from './features/controls.js';
import { createMessageSync } from './features/message-sync.js';
import { accessReason, classifyMessage } from './features/message-policy.js';
import { HistoryStore } from './history.js';
import { Ledger } from './ledger.js';
import { HubLogger } from './logger.js';
import { describeRichContent } from './persona.js';
import { createToolDefinitions } from './tools.js';
import { TransportManager } from './transports.js';
import { MemberNames } from './member-names.js';
import { channelLookupTools } from './channel-lookup.js';
import { ChannelActions } from './channel-actions.js';
import { NativeInteractions } from './native-interactions.js';
import { Semaphore, truncate } from './util.js';

export const name = 'discord-cyberfriend';
export const inject = ['webServer', 'tools'];

/** DSH 設定 schema：由 config.js 的欄位表推導（與 frontend 共用同一份宣告）。 */
let loadSchemasteryPromise;
function loadSchemastery() {
  if (!loadSchemasteryPromise) {
    loadSchemasteryPromise = import('@deepseek-ai/schemastery')
      .catch(() => import('schemastery'))
      .catch(() => null);
  }
  return loadSchemasteryPromise;
}

const zInstance = await loadSchemastery();
const configSchema = (() => {
  if (!zInstance) return undefined;
  try {
    return buildConfigSchema(zInstance.default ?? zInstance);
  } catch (error) {
    console.warn('[dsh-discord-cyberfriend] 建立設定 schema 失敗，改用純 JS 設定：', error?.message);
    return undefined;
  }
})();
export const Config = configSchema;

/** 這些設定改變後需要重啟對應的連線。 */
const RECONNECT_KEYS = {
  user: ['userPythonExecutable', 'userToken', 'userEnabled', 'userReconnect'],
  // 只有「必須重新建立 Gateway 連線」的欄位才放這裡；活動狀態與斜線指令
  // 都能在既有連線上即時套用，不必把連線踢掉重連。
  bot: ['botToken', 'botProxyUrl', 'botMessageContentIntent', 'botMembersIntent', 'botEnabled'],
};

/** 不需要重連、但要即時生效的設定。 */
const LIVE_KEYS = {
  bot: ['botActivityType', 'botActivityText', 'botSlashCommands', 'botNativeInteractions'],
};

/**
 * 改名前的工具名稱（discord_pyself_lab_*）可能存在已儲存的工具白名單裡；讀取設定時換成新名稱，
 * 否則白名單會對不上改名後的工具。只處理字串清單，其他值原樣保留。
 */
export function migrateLegacyToolNames(saved) {
  if (!saved || typeof saved !== 'object') return saved;
  const next = { ...saved };
  for (const [key, value] of Object.entries(next))
    if (Array.isArray(value) && value.some((item) => typeof item === 'string' && item.startsWith('discord_pyself_lab_')))
      next[key] = value.map((item) =>
        typeof item === 'string' ? item.replace(/^discord_pyself_lab_/, 'discord_cyberfriend_') : item,
      );
  return next;
}

export async function apply(ctx, userConfig = {}) {
  registerDiscordSkills(ctx);
  const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  // 資料放在套件目錄之外（~/.dsh/data/dsh-discord-cyberfriend），更新套件時才不會被清掉；
  // 舊位置的 data/ 第一次啟動時複製過來，原檔保留。搬遷失敗時這次仍用舊位置。
  const dataLocation = await prepareDataDir({ pluginRoot });
  const dataDir = dataLocation.dir;
  await mkdir(dataDir, { recursive: true });
  const configFile = join(dataDir, 'config.json');

  let credentials;
  try {
    credentials = ctx.get?.('credentials');
  } catch {}
  const vault = createConfigVault({ file: configFile, credentials });
  const saved = migrateLegacyToolNames(await vault.read());
  let activeConfig = sanitizeConfig({ ...userConfig, ...saved });
  // Atomically migrate legacy plaintext before starting any transports.
  await vault.save(activeConfig);
  // 設定復原紀錄：只記非機密欄位改了什麼，最多十筆。
  const configHistory = new ConfigHistory({ file: join(dataDir, 'config-history.json') });
  await configHistory.init();

  // ------------------------------------------------------------------ 基礎設施 ---
  const logger = new HubLogger({ dir: join(dataDir, 'logs') });
  logger.configure(activeConfig);
  await logger.init();
  logger.info('plugin.start', 'dsh-discord-cyberfriend 啟動', {
    primaryTransport: activeConfig.primaryTransport,
    userEnabled: activeConfig.userEnabled,
    botEnabled: activeConfig.botEnabled,
    dryRun: activeConfig.dryRun,
  });
  // 市集安裝不會執行依賴的安裝腳本，FFmpeg 可能還沒下載；背景補一次，不擋啟動。
  ensureFfmpeg().then((ffmpegState) => {
    if (ffmpegState.downloaded) logger.info('ffmpeg.downloaded', '已下載語音與影片處理需要的 FFmpeg');
    else if (!ffmpegState.ok)
      logger.warn('ffmpeg.missing', '找不到 FFmpeg，語音、語音訊息與影片抽幀暫時無法使用', {
        reason: ffmpegState.reason,
        error: ffmpegState.error,
      });
  });
  if (dataLocation.migrated)
    logger.info('data.migrated', '資料已複製到新的資料位置，舊資料夾保留為備份', {
      from: dataLocation.legacyDir,
      to: dataLocation.dir,
    });
  if (dataLocation.fallback)
    logger.warn('data.migrate_failed', '資料搬遷失敗，這次仍使用套件目錄內的資料；下次啟動會再試', {
      error: dataLocation.error,
    });

  const ledger = new Ledger({ file: join(dataDir, 'ledger.json'), log: logger });
  await ledger.load();
  ledger.configure(activeConfig);
  const history = new HistoryStore({
    file: join(dataDir, 'history.json'),
    log: logger,
    config: activeConfig,
  });
  await history.load();

  const getConfig = () => activeConfig;
  const tokenBudget = new TokenBudget({ file: join(dataDir, 'token-budget.json'), getConfig });
  await tokenBudget.init();
  const releaseMeter = registerTokenBudget(ctx, tokenBudget);
  ctx.effect(() => () => {
    releaseMeter();
    void tokenBudget.flush();
  });
  const memberNames = new MemberNames({ getConfig, history });
  const threadDecisions = new Map();
  const followups = new FollowupWindow();
  const moodAdapter = new FeiyuMoodAdapter({ checkpointFile: join(dataDir, 'mood-checkpoints.json') });
  const deliveryTrace = new DeliveryTrace();
  const semaphore = new Semaphore(Math.max(1, Number(activeConfig.maxConcurrentReplies) || 2));

  const saveConfig = async (patch = {}) => {
    const next = sanitizeConfig({ ...activeConfig, ...patch });
    const changed = Object.keys(patch).filter(
      (key) => JSON.stringify(activeConfig[key]) !== JSON.stringify(next[key]),
    );
    await vault.save(next);
    activeConfig = next;
    if (changed.includes('proactiveEnabled') && !next.proactiveEnabled) await companion.stopCheckins();
    logger.configure(activeConfig);
    ledger.configure?.(activeConfig);
    semaphore.setLimit(Math.max(1, Number(activeConfig.maxConcurrentReplies) || 2));
    history.configure(activeConfig);
    gate.configure(activeConfig);
    manager.configure(activeConfig);
    if (
      !activeConfig.enabled ||
      !activeConfig.userEnabled ||
      !activeConfig.userAutoReply ||
      activeConfig.userReceiveOnly ||
      activeConfig.dryRun
    )
      responder.cancel(undefined, undefined, undefined, manager.byKind.user);
    return { next, changed };
  };

  // ------------------------------------------------------------------- 功能層 ---
  const manager = new TransportManager({
    log: logger,
    history,
    onMemberUpdate: (event, transport) => memberNames.update(event, transport),
    onOwnMessage: async (message) => {
      if (!getConfig().userAutoTakeoverEnabled) return;
      const current = takeover.active(message.channelId);
      if (current?.until === null) return;
      const seconds = Math.max(
        (getConfig().userAutoTakeoverMinutes || 30) * 60,
        current ? Math.ceil((current.until - Date.now()) / 1000) : 0,
      );
      await takeover.pause(message.channelId, {
        seconds,
        label: 'Discord 人工發話 · ' + (message.channelName || message.channelId),
      });
    },
    onMessage: (message, transport, raw) => receiveMessage(message, transport, raw),
    onReaction: (event, transport) => handleReaction(event, transport),
    onInteraction: (payload, transport) => handleInteraction(payload, transport),
    onMessageChange: async (event, transport) => {
      if (event.event !== 'message_preview')
        turns.cancelPending({ channelId: event.channelId, messageId: event.messageId, transport });
      await memoryOutput.recordChange(event, transport).catch(() => {});
      await syncMessage(event, transport);
      if (transport.kind === 'user') {
        await inbox.change(event, history.find(event.channelId, event.messageId));
        if (['message_edit', 'message_delete'].includes(event.event))
          await review.invalidate(event.messageId);
        if (event.event === 'message_edit' && inbox.items.get(event.messageId)?.phase === 'draft')
          await inbox.mark(event.messageId, 'pending', '來源已修改，舊草稿失效，可重新產生');
      }
    },
    onConnectionLost: (transport) => {
      turns.cancelPending({ transport });
      responder.cancel(undefined, undefined, undefined, transport);
    },
  });
  manager.configure(activeConfig);

  const gate = new ReplyGate({ config: activeConfig, ledger, log: logger });
  gate.configure(activeConfig);
  const sessionBridge = new DiscordSessions({
    ctx,
    file: join(dataDir, 'session-bindings.json'),
    // 從市集／npm 安裝時套件在 node_modules 裡，預設工作區改放資料目錄，避免跟著套件被換掉；
    // 本機來源安裝維持原本的位置，既有會話的工作區不變。
    workspace: installedAsPackage(pluginRoot) ? join(dataDir, 'workspace') : dirname(dirname(pluginRoot)),
    getConfig,
    log: logger,
  });
  await sessionBridge.init();
  ctx.effect(() => () => sessionBridge.dispose());
  const memoryOutput = new MemoryOutput({
    root: activeConfig.memoryOutputDirectory
      ? resolve(activeConfig.memoryOutputDirectory)
      : join(sessionBridge.workspace, 'discord-memory-output'),
    getConfig,
    bridge: sessionBridge,
    ctx,
    log: logger,
  });
  await memoryOutput.init();
  const diaryTimer = setInterval(() => void memoryOutput.tick(), 60000);
  diaryTimer.unref?.();
  ctx.effect(() => () => {
    clearInterval(diaryTimer);
    void memoryOutput.dispose();
    void memoryOutput.flush();
  });
  void memoryOutput.tick();
  const culture = new MediaCulture({
    file: join(dataDir, 'media-culture.json'),
    getConfig,
    memoryOutput,
    ctx,
    log: logger,
    getSelfIds: () =>
      Object.values(manager.byKind)
        .map((t) => t.selfId)
        .filter(Boolean),
  });
  await culture.init();
  ctx.effect(() => () => void culture.flush());
  const behavior = new UserBehavior({
    file: join(dataDir, 'user-behavior.json'),
    getConfig,
    setConfig: (patch) => apiSetConfig(patch, 'preset'),
  });
  await behavior.init();
  ctx.effect(() => () => void behavior.flush());
  const musicProviders = new MusicProviders({
    ctx,
    scopeFor: ({ kind, session }) => {
      const binding = sessionBridge.bindings[kind + ':' + session.selfId + ':' + session.textChannelId];
      return {
        workspace: binding?.cwd,
        agent: sessionBridge.live.get(binding?.sessionId)?.agent,
        channelId: session.textChannelId,
        guildId: session.guildId,
      };
    },
  });
  ctx.provide?.('discordMusic', musicProviders);
  // 內建的 YouTube 音樂來源。yt-dlp 執行檔不隨插件附送：啟動時在背景找一次，
  // 沒有的話在第一次點歌（或使用者在語音頁按下載）時從官方發行頁下載。
  const ytdlpInstaller = createYtdlpInstaller({ log: logger });
  // 使用者帳號需要的 Python 環境：只在使用者於設定頁按「一鍵安裝」時才執行。
  const pythonSetup = createPythonSetup({ getConfig, log: logger });
  ctx.effect(() => () => pythonSetup.close());
  const ytdlp = createYtdlpRunner({ getConfig, install: () => ytdlpInstaller.install() });
  const ytdlpAutoInstall = () =>
    ytdlpInstaller.status().supported && !String(getConfig().musicYtdlpPath || '').trim();
  const builtinYoutube = {
    service: createYoutubeMusic(ytdlp.runYt),
    // 還沒下載但可以自動下載時也算可用，第一次使用會多等一下。
    ready: () => ytdlp.ready() || ytdlpAutoInstall(),
  };
  const ytdlpControl = {
    status: () => ({ ...ytdlp.status(), install: ytdlpInstaller.status(), autoInstall: ytdlpAutoInstall() }),
    install: async () => {
      const result = await ytdlpInstaller.install();
      if (result.ok) await ytdlp.probe(true);
      return { ok: result.ok, error: result.error, ...ytdlp.status() };
    },
  };
  ytdlp.probe().then((found) => {
    if (found.bin) logger.info('ytdlp.ready', 'YouTube 點歌可用：已找到 yt-dlp', { version: found.version });
  });
  ctx.effect(() => musicProviders.register(youtubeMusicProvider(ctx, builtinYoutube)));
  const voice = new DiscordVoice({
    ctx,
    musicProviders,
    getConfig,
    getManager: () => manager,
    file: join(dataDir, 'voice-usage.json'),
    log: logger,
    scopeForChannel: (s) =>
      sessionBridge.bindings[s.kind + ':' + s.selfId + ':' + s.textChannelId]?.sessionId,
    onTranscript: async (row, s) => {
      const t = manager.byKind[s.kind],
        selfId = t.selfId,
        epoch = t.epoch,
        generation = t.connectionGeneration;
      const author = await memberNames.resolve(t, row.userId, s.guildId);
      row.authorName = author.name;
      const cfg = getConfig();
      if (
        voice.sessions.get(s.kind) !== s ||
        !s.receiving ||
        !cfg.voiceReceiveEnabled ||
        !cfg.voiceReceiveConsent ||
        !cfg.voiceReceiveAutoReply ||
        !cfg.voiceReceiveUserIds.includes(row.userId) ||
        selfId !== t.selfId ||
        epoch !== t.epoch ||
        generation !== t.connectionGeneration
      )
        return;
      return handleMessage(
        {
          id: row.id,
          channelId: s.textChannelId,
          guildId: s.guildId,
          author,
          content: row.text,
          ts: new Date(row.at).toISOString(),
          attachments: [],
          stickers: [],
          embeds: 0,
          reactions: [],
          mentions: [],
          isDm: false,
          isMention: true,
          voiceInput: true,
          voiceTiming: row.voiceTiming,
        },
        t,
        { source: 'voice' },
      );
    },
    onInputCandidate: (id, s) => responder.capture(s.textChannelId, id, manager.byKind[s.kind]),
    onInputInterrupt: (_id, _s, target) => responder.cancelCaptured(target),
  });
  await voice.init();
  const songDelivery = createSongDelivery({ getConfig, getManager: () => manager, sessionBridge, voice });
  ctx.provide?.('discordSongDelivery', songDelivery);
  const songWorkflow = createSongWorkflow({
    ctx,
    delivery: songDelivery,
    getConfig,
    // 翻唱的音源下載與歌名搜尋改用內建的 yt-dlp，不必另外安裝下載插件。
    builtinTools: createVideoTools({ runYt: ytdlp.runYt, ffmpegPath: FFMPEG }),
    searchSongs: (query, options) => builtinYoutube.service.search(query, options),
    scopeFor: (agent) => {
      const state = sessionBridge.live.get(agent?.session?.id || agent?.id);
      return state?.inFlight ? { actorId: state.options.actorId, message: state.message } : null;
    },
  });
  ctx.effect(() => () => void songWorkflow.close());
  ctx.effect(() => () => void voice.dispose());
  const voiceOverview = createVoiceOverview({ ctx, voice, sessionBridge, tokenBudget, getConfig });
  const voiceMessages = new VoiceMessages({ ctx, voice, getConfig });
  ctx.effect(() => () => voiceMessages.close());
  const memeImages = new MemeImages({ ctx, root: join(dataDir, 'meme-outbox') });
  ctx.provide?.('discordMemeImages', memeImages);
  // 語氣樣本（鄉民語氣）：樣本由其他插件提供，這裡只負責判斷每一則要不要附。
  const slangTone = createSlangTone({ history, log: logger });
  const responder = createResponder({
    slangTone,
    memberNames,
    memeImages,
    ctx,
    getConfig,
    history,
    ledger,
    log: logger,
    semaphore,
    sessionBridge,
    memoryOutput,
    culture,
    voiceMessages,
    speechDiagnostic: (reason) => {
      voice.lastIncremental = { at: Date.now(), reason };
    },
    speechExpected: (m, t) => Boolean(companion.policy(m, t).speech && voice.expectsSpeech(m, t)),
    beginSpeech: (m, t, options) =>
      companion.policy(m, t).speech
        ? voice.beginIncremental(m, t, { ...options, validate: () => companion.policy(m, t).speech })
        : null,
    speakOnly: (m, t, text, meta) =>
      companion.policy(m, t).speech && voice.expectsSpeech(m, t)
        ? voice.speak({
            kind: t.kind,
            text,
            automatic: true,
            sourceChannelId: m.channelId,
            speechDirection: meta.speech,
            spokenText: meta.spokenText,
            sessionId: meta.sessionId,
          })
        : null,
    onTextDelivered: (m, t, text, meta) =>
      !meta.earlySpeech && companion.policy(m, t).speech ? voice.autoSpeak(m, t, text, meta) : undefined,
    moodAdapter,
    conversationConfig: (c, m, t) => companion.apply(behavior.apply(c, m, t.kind), m, t),
    stageDraft: (data) => review.stage(data),
    onDeliveryState: async (m, t, phase, reason, topic) => {
      conversation?.phase(topic, phase);
      turns.phase(m, t, phase, reason);
      if (t.kind === 'user') await inbox.mark(m.id, phase, reason);
    },
  });
  const inbox = new UserInbox({ file: join(dataDir, 'user-inbox.json') });
  await inbox.init();
  ctx.effect(() => () => void inbox.flush());
  const review = new UserReview({
    file: join(dataDir, 'user-review.json'),
    getTransport: () => manager.byKind.user,
    getConfig,
    validate: async (r, _c, { keepMedia = true } = {}) => {
      if (r.replyOptions?.memeImage && keepMedia)
        await memeImages.validate(
          r.replyOptions.memeImage,
          audienceConfig(getConfig(), r.source.author?.id, r.source.isDm && !r.source.isGroupDm),
        );
      if (r.conversationTopic && !conversation.allowsDraft(r.conversationTopic))
        throw Error('此話題已結束或已重新安排，舊草稿不可送出');
      const denied = accessReason(
        r.source,
        audienceConfig(getConfig(), r.source.author?.id, r.source.isDm && !r.source.isGroupDm),
      );
      if (denied) throw Error(denied);
    },
    onDiscard: (r) => memeImages.release(r.replyOptions?.memeImage),
    onSent: async (r, result, options) => {
      await memeImages.release(r.replyOptions?.memeImage);
      conversation?.settle(r.conversationTopic, result);
      await inbox.resolve(r.source.id, 'approved', result.messageId);
      ledger.record(r.kind, {
        userId: r.source.author?.id,
        transport: 'user',
        channelId: r.source.channelId,
      });
      const record = {
        id: result.messageId,
        channelId: r.source.channelId,
        guildId: r.source.guildId,
        ts: Date.now(),
        author: { id: manager.byKind.user.selfId, name: manager.byKind.user.selfName },
        content: options.content || '[貼圖]',
        stickers: (options.stickerIds || []).map((id) => ({ id, name: '核准草稿貼圖' })),
        selfAuthored: true,
        isDm: r.source.isDm,
        transport: 'user',
      };
      history.record(record, 'user');
      await memoryOutput.recordMessage(record, manager.byKind.user, {
        source: 'outgoing',
        adminConversation: r.source.author?.id === getConfig().adminUserId,
      });
      await voice.autoSpeak(r.source, manager.byKind.user, options.content || '', {
        speech: options.content === r.speechOriginal ? r.speech : undefined,
        spokenText: options.content === r.speechOriginal ? r.spokenText : undefined,
        sessionId: r.sessionId,
      });
    },
  });
  await review.init();
  ctx.effect(() => () => void review.flush());
  const turns = new TurnCoordinator({
    trace: deliveryTrace,
    dispatch: (message, transport, turn) => processMessage(message, transport, { turn }),
    cancel: (message, transport) => responder.cancel(message.channelId, message.id, undefined, transport),
  });
  const companion = new CompanionControls({
    file: join(dataDir, 'companion-controls.json'),
    ctx,
    getConfig,
    getManager: () => manager,
    bridge: sessionBridge,
    dispatch: processMessage,
    onMode: async (channelId, t, actorId) => {
      turns.cancelPending({ channelId, transport: t, actorId });
      responder.cancel(channelId, undefined, actorId, t);
      const room = voice.sessions.get(t.kind);
      if (room?.textChannelId === channelId) await voice.stop(t.kind);
    },
  });
  await companion.init();
  ctx.provide?.('discordCompanion', companion);
  const conversation = new ConversationDesk({
    file: join(dataDir, 'conversation-topics.json'),
    getConfig,
    getManager: () => manager,
    history,
    bridge: sessionBridge,
    companion,
    sourcePolicy: (channel, id) => memoryOutput.manifest.sourcePolicies?.[channel + ':' + id],
    dispatch: processMessage,
    validate: (m, t) => {
      const c = audienceConfig(getConfig(), m.author?.id, m.isDm && !m.isGroupDm),
        denied = accessReason(m, c);
      if (
        denied ||
        !c.enabled ||
        c.dryRun ||
        !c[t.kind + 'Enabled'] ||
        (t.kind === 'user' && (c.userReceiveOnly || !c.userAutoReply)) ||
        t.isPaused?.(m.channelId) ||
        (m.isDm && !m.isGroupDm && !c.dmReplyEnabled) ||
        ((!m.isDm || m.isGroupDm) && !c.mentionReplyEnabled)
      )
        throw Error(denied || '目前權限、模式或回覆開關禁止此操作');
    },
    cancelReply: async (row) => {
      const source = manager.byKind[row.kind],
        target = manager.byKind[row.replyKind || row.kind];
      for (const id of row.sourceIds) {
        turns.cancelPending({
          channelId: row.channelId,
          messageId: id,
          transport: source,
          actorId: row.userId,
        });
        responder.cancel(row.targetChannelId || row.channelId, id, row.userId, target);
      }
      let uncertain = false;
      for (const draft of review.rows.values())
        if (row.sourceIds.includes(draft.source.id) && draft.accountId === (row.replySelfId || row.selfId)) {
          if (review.locks.has(draft.id) || ['sending', 'uncertain'].includes(draft.state)) {
            uncertain = true;
            continue;
          }
          if (['pending', 'failed', 'stale'].includes(draft.state))
            await review.discard(draft.id, draft.version);
        }
      return { uncertain };
    },
  });
  await conversation.init();
  ctx.provide?.('discordConversation', conversation);
  ctx.effect(() => () => conversation.close());
  ctx.effect(() => ctx.tools.guard?.((exec) => companion.guard(exec)));
  const takeover = new UserTakeover({
    file: join(dataDir, 'user-takeover.json'),
    onPause: (channelId) => responder.cancel(channelId, undefined, undefined, manager.byKind.user),
  });
  await takeover.init();
  manager.byKind.user.isPaused = (channelId) => !!takeover.active(channelId);
  ctx.effect(() => () => void takeover.flush());
  const reactions = createReactionEngine({
    ctx,
    getConfig,
    history,
    ledger,
    log: logger,
    semaphore,
    responder,
    gate,
  });
  const controls = createControls({ getConfig, responder, history, gate, log: logger });
  const syncMessage = createMessageSync({ history, responder, log: logger });

  const adminJournal = new AdminJournal({
    file: join(dataDir, 'manager-inbox.json'),
    bridge: sessionBridge,
    getConfig,
    log: logger,
  });
  await adminJournal.init();
  const archiveTimer = setInterval(() => void adminJournal.drain(), 10000);
  archiveTimer.unref?.();
  ctx.effect(() => () => clearInterval(archiveTimer));

  // ------------------------------------------------------------------ 訊息處理 ---
  const processing = new Set();
  const recentReplies = new Map();
  let simulateSeq = 0;

  function kindOf(message, transport) {
    return classifyMessage(
      message,
      transport?.selfId || '',
      recentReplies.get(`${transport.kind}:${message.channelId}`) || [],
    );
  }

  async function receiveMessage(message, transport, raw) {
    if (!message) return null;
    memberNames.observe(message, transport);
    if (getConfig().userInboxEnabled !== false && raw?.source !== 'simulation')
      await inbox
        .record(message, transport)
        .catch((e) => logger.warn('user.inbox', '收件匣寫入失敗', { error: e.message }));
    await memoryOutput
      .recordMessage(message, transport, { source: raw?.source === 'simulation' ? 'simulation' : 'gateway' })
      .catch(() => {});
    await culture
      .observe(message, transport, history, { simulation: raw?.source === 'simulation' })
      .catch((e) => logger.warn('culture.observe', '群內用法紀錄失敗', { error: e.message }));
    if (message.memoryOnly && transport.kind === 'user')
      await inbox.mark(
        message.id,
        'blocked',
        !getConfig().enabled
          ? '插件已停用'
          : getConfig().userReceiveOnly
            ? '僅觀察模式'
            : !getConfig().userAutoReply
              ? 'AI 自動回覆已關閉'
              : '僅作紀錄',
      );
    const routed = await voiceMessages.routeIncoming(message, transport);
    return adminJournal.capture(message, transport, () =>
      !routed || (routed.memoryOnly && (routed.simulated || !culture.chorus(routed)))
        ? null
        : handleMessage(routed, transport, raw),
    );
  }

  async function handleMessage(message, transport, raw) {
    if (!message) return null;
    const config = behavior.apply(
      audienceConfig(getConfig(), message.author?.id, message.isDm && !message.isGroupDm),
      message,
      transport.kind,
    );
    const sourcePolicy = memoryOutput.manifest.sourcePolicies?.[message.channelId + ':' + message.id];
    if (sourcePolicy?.action === 'forget')
      return { ok: true, skipped: true, reason: '此來源已由使用者要求忘記，不重新匯入' };
    if (sourcePolicy?.action === 'correct')
      message = { ...message, content: sourcePolicy.content, edited: true };
    const own = Object.values(manager.byKind)
      .filter(Boolean)
      .map((t) => String(t.selfId));
    if (!config.enabled || own.includes(String(message.author?.id))) return null;
    const earlyDenied = accessReason(message, config);
    if (earlyDenied) {
      logger.info('reply.skip', earlyDenied, {
        channelId: message.channelId,
        messageId: message.id,
        transport: transport.kind,
      });
      deliveryTrace.mark(message, transport, 'blocked', earlyDenied);
      if (transport.kind === 'user') await inbox.mark(message.id, 'blocked', earlyDenied);
      return null;
    }
    if (message.memoryOnly) return null;
    if (transport.kind === 'user' && (config.userReceiveOnly || !config.userAutoReply)) return null;
    if (!(transport.kind === 'user' ? config.userEnabled : config.botEnabled)) return null;
    if (companion.observe(message, transport, { simulation: raw?.source === 'simulation' }))
      return { ok: true, control: true };
    const action = conversation.parse(message, transport, {
      directed: kindOf(message, transport) !== 'cochat',
    });
    if (action?.action === 'ignore') return null;
    if (action)
      return turns.accept({ ...message, __conversationControl: action }, transport, {
        config,
        kind: kindOf(message, transport) === 'dm' ? 'dm' : 'mention',
        identity: config.replyOwnership === 'separate' ? transport.kind + ':' + transport.selfId : 'shared',
      });
    if (
      config.conversationControlEnabled &&
      own.some((id) => parseConversationAction(message.content, { selfId: id })) &&
      message.mentions?.some((m) => own.includes(String(m.id)))
    )
      return null;
    if (!companion.policy(message, transport).reply) {
      if (kindOf(message, transport) !== 'cochat') {
        const ticket = conversation.begin(message, transport, { turnId: 'blocked:' + message.id });
        conversation.update(ticket, 'blocked', '目前只聽或已有延後工作，本題未自動排程');
      }
      deliveryTrace.mark(
        message,
        transport,
        'blocked',
        companion.policy(message, transport).deferred
          ? '已安排延後回覆，暫不產生新答案'
          : '只聽模式，不產生 AI 回覆',
      );
      return null;
    }
    if (
      config.voiceReplayEnabled &&
      message.replyTo &&
      /^(剛才沒聽清楚|刚才没听清楚|再說一次|再说一次|重播剛才語音)$/.test(
        String(message.content || '').trim(),
      )
    ) {
      if (!companion.policy(message, transport).speech) return null;
      try {
        if (voice.replays.list().some((row) => row.id === message.replyTo && row.delivery === 'room'))
          return voice.replay({ kind: transport.kind, id: message.replyTo });
        return await voiceMessages.replay(message, transport);
      } catch (e) {
        deliveryTrace.mark(message, transport, 'blocked', e.message);
        return { ok: false, error: e.message };
      }
    }
    const kind = kindOf(message, transport),
      inFollowup = kind === 'cochat' && followups.active(message, transport, config);
    // A mention of our other account is duplicate ingress, not unrelated cochat.
    // Keep its batching window without giving it the actual recipient's priority.
    const shadowMention =
      config.replyOwnership !== 'separate' && kind === 'cochat' &&
      message.mentions?.some((m) => String(m.id) !== String(transport.selfId) && own.includes(String(m.id)));
    return turns.accept(message, transport, {
      config,
      kind: shadowMention ? 'shadow-mention' : inFollowup ? 'followup' : kind,
      identity: config.replyOwnership === 'separate' ? transport.kind + ':' + transport.selfId : 'shared',
    });
  }

  async function onControlDelivery(message, transport) {
    const c = audienceConfig(getConfig(), message.author?.id, message.isDm && !message.isGroupDm);
    if (
      accessReason(message, c) ||
      !c.enabled ||
      c.dryRun ||
      !transport.ready ||
      c[transport.kind + 'Enabled'] === false ||
      (transport.kind === 'user' && (c.userReceiveOnly || c.userAutoReply === false)) ||
      transport.isPaused?.(message.channelId)
    )
      throw Error('控制回執交付前的權限已變更');
    deliveryTrace.mark(message, transport, 'sending', '傳送對話控制回執');
  }
  async function processMessage(message, transport, raw) {
    if (!message) return null;
    if (raw?.turn?.signal?.aborted) return { ok: true, cancelled: true };
    const policy = memoryOutput.manifest.sourcePolicies?.[message.channelId + ':' + message.id];
    if (policy?.action === 'forget') return { ok: true, skipped: true, reason: '來源已要求忘記' };
    if (policy?.action === 'correct') message = { ...message, content: policy.content, edited: true };
    const config = behavior.apply(
      audienceConfig(getConfig(), message.author?.id, message.isDm && !message.isGroupDm),
      message,
      transport.kind,
    );
    let topic;
    const skip = async (reason) => {
      conversation.update(topic, 'blocked', reason);
      deliveryTrace.mark(message, transport, 'blocked', reason);
      if (transport.kind === 'user') await inbox.mark(message.id, 'blocked', reason);
      return null;
    };
    if (!config.enabled) return skip('插件已停用');
    if (transport.kind === 'user' && (config.userReceiveOnly || !config.userAutoReply))
      return skip(config.userReceiveOnly ? '僅觀察模式' : 'AI 自動回覆已關閉');
    const denied = accessReason(message, config);
    if (message.author?.id === transport.selfId || denied) {
      if (denied)
        logger.info('reply.skip', denied, {
          channelId: message.channelId,
          messageId: message.id,
          transport: transport.kind,
        });
      return skip(denied || '自己送出的訊息');
    }
    const key = `${transport.kind}:${message.id}:${raw?.turn?.turnId || ''}:${raw?.turn?.revision || 0}`;
    if (processing.has(key)) return null;
    processing.add(key);
    try {
      if (config.historyEnabled) history.record(message, transport.kind);

      if (transport.kind === 'user' && takeover.active(message.channelId)) {
        logger.info('user.takeover', '此對話由人工接管，跳過 AI 與自動反應', {
          channelId: message.channelId,
        });
        return skip('人工接管中，恢復後可手動重試');
      }
      if (message.__conversationControl) {
        const controlSelfId = transport.selfId;
        const admitted = gate.control(message, {
          selfId: transport.selfId,
          transportEnabled: config[transport.kind + 'Enabled'],
          transport: transport.kind,
          effectiveConfig: config,
        });
        if (!admitted.ok) return skip(admitted.reason);
        if (message.simulated || config.dryRun || raw?.turn?.signal?.aborted)
          return { ok: true, control: true, dryRun: true, reason: '模擬控制只解析，不建立排程或外送' };
        let response;
        try {
          response = await conversation.handle(message, transport, message.__conversationControl);
        } catch (error) {
          response = { ok: false, message: error.message };
        }
        if (response.messageId && !response.plan) return response;
        const suffix = response.plan?.dueAt
          ? '\n時間：' +
            new Intl.DateTimeFormat('zh-Hant', {
              timeZone: 'Asia/Taipei',
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(response.plan.dueAt) +
            '（Asia/Taipei）'
          : '';
        const content = String(response.message || '已處理').slice(0, 1500) + suffix;
        if (raw?.turn?.signal?.aborted) return { ok: true, cancelled: true };
        if (transport.selfId !== controlSelfId) throw Error('控制回執的帳號已變更');
        await onControlDelivery(message, transport);
        const sent = await semaphore.run(() =>
          transport.sendMessage(message.channelId, {
            content,
            autoReply: true,
            replyToMessageId: message.id,
            mention: false,
            simulateTyping: false,
            expectedSelfId: controlSelfId,
            allowedMentions: [],
          }),
        );
        return {
          ...response,
          ok: response.ok !== false && sent?.ok !== false,
          control: true,
          messageId: sent?.messageId,
          uncertain: sent?.uncertain || response.uncertain,
          error: sent?.ok === false ? '控制回執未確認送達' : undefined,
        };
      }
      const transportEnabled = transport.kind === 'user' ? config.userEnabled : config.botEnabled;
      let kind = kindOf(message, transport);
      const chorus = kind === 'cochat' ? culture.chorus(message) : null;
      if (chorus?.claimed) return null;
      const inFollowup = !chorus && kind === 'cochat' && followups.active(message, transport, config);
      if (inFollowup) {
        if (!config.mentionReplyEnabled || (message.author?.bot && !config.replyToBots)) return null;
        const decision = await followups.decide(
          ctx,
          config,
          message,
          history.contextText(message.channelId, 12),
          transport,
        );
        if (raw?.turn?.signal?.aborted) return { ok: true, cancelled: true };
        logger.info('reply.followup', decision.relevant ? '延續窗口內的對話' : '窗口內訊息未延續對話', {
          channelId: message.channelId,
          transport: transport.kind,
          reason: decision.reason,
        });
        if (!decision.relevant) return null;
        kind = 'mention';
      }
      let effectiveKind = kind;
      if (['dm', 'mention'].includes(kind))
        topic = conversation.begin(message, transport, {
          turnId: raw?.turn?.turnId || message.id,
          topicId: raw?.conversationTopicId,
        });
      let gateResult;

      if (kind === 'cochat') {
        if (!chorus) {
          const candidate = gate.shouldConsiderCoChat(message, config);
          if (!candidate.ok) {
            logger.debug('cochat.skip', candidate.reason, { channelId: message.channelId });
            return null;
          }
          // 群組至少要有 N 則歷史，模型才有足夠上下文插話（coChatMinHistoryMessages）。
          const minHistory = Math.max(0, Number(config.coChatMinHistoryMessages) || 0);
          if (minHistory > 0) {
            const depth = history.recent(message.channelId, minHistory).length;
            if (depth < minHistory) {
              logger.debug('cochat.skip', `上下文不足（${depth}/${minHistory}）`, {
                channelId: message.channelId,
              });
              return null;
            }
          }
        }
        gateResult = gate.check(message, 'cochat', {
          selfId: transport.selfId,
          transportEnabled,
          transport: transport.kind,
          effectiveConfig: config,
          admission: raw?.turn?.turnId,
        });
      } else {
        gateResult = gate.check(message, kind, {
          selfId: transport.selfId,
          transportEnabled,
          transport: transport.kind,
          effectiveConfig: config,
          admission: raw?.turn?.turnId,
        });
      }

      if (!gateResult.ok) {
        logger.info('reply.skip', `${kind}: ${gateResult.reason}`, {
          channelId: message.channelId,
          messageId: message.id,
          transport: transport.kind,
        });
        return skip(gateResult.reason);
      }

      const replyTransport = manager.replyTransportFor(transport);
      if (!replyTransport?.ready) {
        logger.warn('reply.skip', '沒有可用的回覆介面', { preferred: config.replyTransport });
        // 話題已建立：要走 skip 才會結束話題、標記收件匣並留下傳遞紀錄。
        return skip('沒有可用的回覆帳號');
      }

      // Reactions share admission with replies: unrelated, disabled, unmonitored
      // or rate-limited messages must not produce an independent side effect.
      if (
        !message.voiceInput &&
        config.autoReactionEnabled &&
        !(transport.kind === 'user' && config.replyDeliveryMode === 'review')
      ) {
        reactions
          .autoReact(message, transport, { decision: gateResult, effectiveConfig: config })
          .catch((error) => {
            logger.debug('reaction.auto', '自動表情失敗', { error: error.message });
          });
      }

      if (chorus && !culture.claim(message)) return null;
      if (chorus)
        logger.info('culture.chorus', '多人接龍已取得單次參與機會', {
          channelId: message.channelId,
          users: chorus.users,
        });

      // 機器人介面：在伺服器頻道被 @ 時，依設定開一個討論串並在裡面回覆，
      // 避免把主頻道洗版（botAutoCreateThreads / botThreadNameTemplate / botThreadArchiveMinutes）。
      if (effectiveKind === 'mention') followups.remember(message, transport, config, { pending: true });
      let targetMessage = message;
      const threadPrefix = replyTransport.kind,
        threadSettings = threadOptions(config, threadPrefix);
      if (
        !message.voiceInput &&
        !message.interactionInput &&
        !voiceMessages.admitted(message, effectiveKind) &&
        threadSettings.enabled &&
        typeof replyTransport.createThread === 'function' &&
        effectiveKind === 'mention' &&
        !config.dryRun &&
        threadCandidate(message) &&
        Date.now() - (threadDecisions.get(message.channelId) || 0) > 30 * 60 * 1000
      ) {
        threadDecisions.set(message.channelId, Date.now());
        if (threadDecisions.size > 400) threadDecisions.delete(threadDecisions.keys().next().value);
        try {
          const channel =
            threadPrefix === 'bot'
              ? await replyTransport.rest('GET', `/channels/${message.channelId}`, {
                  signal: AbortSignal.timeout(5000),
                })
              : await replyTransport.getThreadParent(message.channelId);
          if (
            ![0, 5].includes(channel?.type) ||
            !(await shouldCreateThread(ctx, config, message)) ||
            raw?.turn?.signal?.aborted ||
            !getConfig().enabled ||
            !threadOptions(getConfig(), threadPrefix).enabled ||
            getConfig().dryRun
          ) {
            logger.debug('reply.thread', '保留在原頻道回覆：不需要新討論串');
          } else {
            const name = String(threadSettings.name || '{topic}')
              .replace('{topic}', truncate(message.content || '', 60))
              .replace('{author}', message.author?.name || '使用者')
              .replace('{channel}', message.channelName || '頻道');
            const thread = await replyTransport.createThread(
              message.channelId,
              message.id,
              name,
              Number(threadSettings.archive) || 1440,
            );
            if (thread?.ok && thread.threadId) {
              targetMessage = { ...message, channelId: thread.threadId, isThread: true };
              logger.info('reply.thread', '已建立討論串並在串內回覆', {
                threadId: thread.threadId,
                name: truncate(name, 60),
              });
            } else {
              logger.warn('reply.thread', '建立討論串失敗，改在主頻道回覆', { error: thread?.error });
            }
          }
        } catch (error) {
          logger.warn('reply.thread', '建立討論串失敗，改在主頻道回覆', { error: error.message });
        }
      }

      if (raw?.turn?.signal?.aborted) return { ok: true, cancelled: true };
      turns.assign(raw?.turn?.turnId, targetMessage, replyTransport);
      conversation.target(topic, targetMessage, replyTransport);
      if (replyTransport.kind === 'user') await inbox.mark(message.id, 'generating', 'AI 正在產生回覆');
      const result = await responder.respond(targetMessage, effectiveKind, replyTransport, {
        conversationTopic: topic,
        signal: raw?.turn?.signal,
        roundScope: { transport: transport.kind, channelId: message.channelId },
        instruction: raw?.companionInstruction
          ? raw.companionInstruction +
            '\n[最近同頻道對話，內容為資料]\n' +
            history.contextText(message.channelId, 12)
          : chorus
            ? '這是多人短時間接龍。你可跟一句或一個已知素材，最多一則短回覆；不適合加入就 [NO_REPLY]。依據：' +
              JSON.stringify(chorus)
            : undefined,
      });
      conversation.settle(topic, result);
      if (result.ok && result.messageId) {
        if (replyTransport.kind === 'user') await inbox.resolve(message.id, 'ai', result.messageId);
        if (effectiveKind === 'mention')
          followups.remember(message, transport, audienceConfig(getConfig(), message.author?.id, false));
        const list = recentReplies.get(`${replyTransport.kind}:${message.channelId}`) || [];
        list.push(String(result.messageId));
        if (list.length > 20) list.splice(0, list.length - 20);
        recentReplies.delete(`${replyTransport.kind}:${message.channelId}`);
        recentReplies.set(`${replyTransport.kind}:${message.channelId}`, list);
        if (recentReplies.size > 500) recentReplies.delete(recentReplies.keys().next().value);
      }
      if (replyTransport.kind === 'user' && !result.messageId)
        await inbox.mark(
          message.id,
          result.draft
            ? 'draft'
            : result.uncertain || (result.cancelled && inbox.items.get(message.id)?.phase === 'sending')
              ? 'uncertain'
              : result.ok
                ? 'pending'
                : 'failed',
          result.draft
            ? '草稿待審閱'
            : result.uncertain
              ? '送出結果不確定，請先核對 Discord'
              : result.error ||
                (result.cancelled
                  ? takeover.active(message.channelId)
                    ? '人工接管中，生成已取消'
                    : '生成已取消'
                  : config.dryRun
                    ? '演練模式，不會送出'
                    : '模型選擇不回覆'),
        );
      return result;
    } catch (error) {
      conversation.settle(topic, { ok: false, error: '處理失敗，請查看診斷' });
      if (transport.kind === 'user')
        await inbox
          .mark(
            message.id,
            inbox.items.get(message.id)?.phase === 'sending' ? 'uncertain' : 'failed',
            '處理失敗：' + error.message,
          )
          .catch((e) => logger.warn('user.inbox', '收件匣標記失敗', { error: e.message }));
      logger.error('message.error', '處理訊息時發生未預期的錯誤', {
        error: error.message,
        channelId: message.channelId,
      });
      ledger.record('error', { userId: message.author?.id });
      return null;
    } finally {
      processing.delete(key);
    }
  }

  async function handleReaction(event, transport) {
    const config = getConfig();
    if (!config.enabled) return;
    await memoryOutput.recordReaction(event, transport).catch(() => {});
    if (transport.kind === 'user' && (config.userReceiveOnly || !config.userAutoReply)) return;
    if (config.reactionIntelEnabled) reactions.recordIntel(event);
    if (transport.kind === 'user' && takeover.active(event.channelId)) return;
    if (event.userId === transport.selfId) return;
    // 跟著按表情：不影響下面的表情指令與操作，失敗只記錄。
    if (!event.removed)
      reactions
        .followReaction(event, transport)
        .catch((error) => logger.debug('reaction.follow', '跟著按表情失敗', { error: error.message }));
    try {
      if (transport.kind === 'user') return await controls.handle(event, transport);
      if (event.removed) return;
      await reactions.handleReaction(event, transport);
    } catch (error) {
      logger.warn('reaction.error', '表情指令失敗', { error: error.message });
    }
  }

  async function handleInteraction(payload, transport) {
    if (!payload) return;
    if (await nativeInteractions.handle(payload, transport)) return;
    const config = getConfig();
    // 本插件註冊的是 cyberfriend-* 指令；改名前的 pyself-lab-* 與不帶前綴的名稱也接受。
    const rawName = String(payload.data?.name || '').trim();
    const commandName = rawName.replace(/^(?:cyberfriend|pyself-lab)-/, '');
    const reply = async (content) => transport.replyInteraction(payload.id, payload.token, content, true);
    if (commandName === 'help') {
      await reply(interactionHelpText(config, payload.member?.user?.id || payload.user?.id));
      return;
    }
    if (commandName === 'status') {
      if (!trustedAdmin(config, payload.member?.user?.id || payload.user?.id)) {
        await reply('Bot 連線正常；詳細帳號與用量僅提供管理者。');
        return;
      }
      const status = manager.status();
      const stats = ledger.getDailyStats();
      await reply(
        [
          `**連線狀態**`,
          `使用者帳號：${status.user.state}${status.user.user ? ` (${status.user.user.tag})` : ''}`,
          `機器人：${status.bot.state}${status.bot.user ? ` (${status.bot.user.tag})` : ''}`,
          '',
          `今日：其他人 @ ${stats.mentionReplies} / 其他人私訊 ${stats.dmReplies} / 管理者 ${stats.adminReplies || 0} / 閒聊 ${stats.coChats} / 表情 ${stats.reactions} / 錯誤 ${stats.errors}`,
        ].join('\n'),
      );
      return;
    }
    if (commandName === 'reset') {
      if (!trustedAdmin(config, payload.member?.user?.id || payload.user?.id)) {
        await reply('只有已綁定的管理者可以重置會話。');
        return;
      }
      const channelId = String(payload.channel_id || '');
      responder.cancel(channelId, undefined, undefined, transport);
      const key = sessionBridge.identity({ channelId }, transport);
      if (sessionBridge.bindings[key]) {
        try {
          await sessionBridge.reset(key);
        } catch {
          await reply('回覆正在停止，請稍後再試一次重置。');
          return;
        }
      }
      history.clear(channelId);
      await reply('已重置這個頻道的對話記憶；下次建立新會話，原 DSH 歷史保留。');
      return;
    }
    await reply('未知的指令，請使用 /cyberfriend-help。');
  }

  // ------------------------------------------------------------------ REST API ---
  /**
   * 模擬一則「進來的外部訊息」走完整回覆管線（gate → prompt → LLM → 送出）。
   * 用途：在只有一個機器人帳號可用時，仍能端到端驗證回覆流程。
   */
  async function simulateInbound(spec = {}) {
    const transportKind = spec.transport === 'user' || spec.transport === 'bot' ? spec.transport : 'bot';
    const transport = manager.get(transportKind);
    if (!transport) throw new Error(`未知的介面：${transportKind}`);
    if (!transport.ready) throw new Error(`${transportKind} 介面尚未登入，無法模擬訊息`);
    const channelId = String(spec.channelId || '').trim();
    if (!channelId) throw new Error('缺少 channelId');
    if (spec.event === 'reaction') {
      const event = {
        channelId,
        messageId: String(spec.messageId || ''),
        guildId: spec.guildId,
        dm: Boolean(spec.isDm),
        userId: String(spec.authorId || ''),
        emoji: String(spec.emoji || ''),
        removed: Boolean(spec.removed),
      };
      if (spec.archiveOnly) await memoryOutput.recordReaction(event, transport, { source: 'simulation' });
      else await handleReaction(event, transport);
      return { ok: true, replied: false, event };
    }
    const now = Date.now();
    // Discord 只接受合法的 snowflake 當 message_reference，`sim-xxx` 會回
    // 400 Invalid Form Body。這裡用「現在時間 + 遞增序號」組出合法且唯一的
    // snowflake；需要引用真實訊息（例如要建立討論串）時由呼叫端指定 messageId。
    let messageId = String(spec.messageId || '').trim();
    if (!/^\d{5,}$/.test(messageId)) {
      simulateSeq += 1;
      messageId = String(((BigInt(now) - 1420070400000n) << 22n) + BigInt(simulateSeq % 4096));
    }
    const message = {
      id: messageId,
      channelId,
      channelName: spec.channelName,
      guildId: spec.guildId,
      transport: transportKind,
      author: {
        id: String(spec.authorId || '900000000000000001'),
        name: spec.authorName || '測試使用者',
        tag: spec.authorName || 'tester',
        bot: Boolean(spec.authorBot),
      },
      content: String(spec.content || '你好'),
      ts: new Date(now).toISOString(),
      replyTo: spec.replyTo,
      attachments: [],
      stickers: [],
      embeds: 0,
      reactions: [],
      mentions: [],
      isDm: Boolean(spec.isDm),
      isMention: spec.isMention !== false,
      edited: false,
      memoryOnly: spec.archiveOnly === true,
      simulated: true,
      stickerText: '',
    };
    const result = await receiveMessage(message, transport, { source: 'simulation' });
    return {
      ok: true,
      replied: Boolean(result?.ok && !result?.skipped && !result?.dryRun && result?.messageId),
      result,
      message,
    };
  }

  const channelActions = new ChannelActions({
    file: join(dataDir, 'channel-actions.json'),
    sourcePolicy: (channel, id) => memoryOutput.manifest.sourcePolicies?.[channel + ':' + id],
    getConfig,
    getManager: () => manager,
    bridge: sessionBridge,
  });
  await channelActions.init();
  const nativeInteractions = new NativeInteractions({
    getConfig,
    getManager: () => manager,
    actions: channelActions,
    conversation,
    voice,
    musicProviders,
    submit: (m, t) => handleMessage(m, t, { source: 'interaction' }),
  });
  ctx.effect(() => () => nativeInteractions.close());
  ctx.effect(() => () => channelActions.close());
  const memoryMaintenance = new MemoryMaintenance({
    ctx,
    getConfig,
    history,
    output: memoryOutput,
    bridge: sessionBridge,
    cancel: (channelId, messageId) => {
      turns.cancelPending({ channelId, messageId });
      responder.cancel(channelId);
    },
  });
  await memoryMaintenance.init();
  ctx.provide?.('discordMemoryMaintenance', memoryMaintenance);
  ctx.effect(() => () => memoryMaintenance.close());
  const capabilities = new CapabilityDiagnostics({
    ctx,
    getConfig,
    voice,
    diaryAgent: memoryOutput.diaryAgent,
    musicProviders,
    moodAdapter,
    companion,
  });
  await capabilities.init();
  ctx.provide?.('discordCapabilities', capabilities);
  ctx.effect(() => () => capabilities.close());
  const api = createApiHandler({
    slangTone,
    slangPreview: createSlangPreview({
      ctx,
      getConfig,
      slangTone,
      selfName: () => manager.byKind.bot?.selfName || manager.byKind.user?.selfName || '',
    }),
    ytdlp: ytdlpControl,
    pythonSetup,
    channelActions,
    memberNames,
    memeImages,
    capabilities,
    conversation,
    musicProviders,
    companion,
    songWorkflow,
    memoryMaintenance,
    voice,
    turns,
    moodAdapter,
    deliveryTrace,
    takeover,
    inbox,
    review,
    behavior,
    tokenBudget,
    retryInbox: async (id) =>
      inbox.retry(id, async (item) => {
        if (
          [...review.rows.values()].some(
            (r) => r.source.id === id && ['pending', 'failed', 'sending', 'uncertain'].includes(r.state),
          )
        ) {
          await inbox.mark(id, 'draft', '此訊息已有待處理草稿，請先審閱或捨棄');
          throw Error('此訊息已有待處理草稿，請先審閱或捨棄');
        }
        const t = manager.byKind.user;
        const original = await t.getMessage(item.channelId, item.id);
        if (!original.ok) {
          await inbox.mark(id, 'failed', '無法讀取來源訊息，可能已刪除或失去權限');
          return original;
        }
        if (original.message.author?.id !== item.authorId) throw Error('來源作者不一致');
        return { ok: true, result: await handleMessage(original.message, t, { source: 'retry' }) };
      }),
    voiceOverview,
    sessionBridge,
    memoryOutput,
    culture,
    ctx,
    getConfig,
    setConfig: (patch, options = {}) => applyPatch(patch, options),
    configHistory,
    getManager: () => manager,
    getLedger: () => ledger,
    getHistory: () => history,
    getLogger: () => logger,
    publicConfigFn: () => publicConfig(activeConfig),
    simulateInbound,
  });

  const apiRouteHandler = (req, res) => {
      api(req, res).catch((error) => {
        logger.error('api.error', 'API 處理失敗', { error: error.message });
        try {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: error.message }));
        } catch {
          /* 連線已關閉 */
        }
      });
  };
  // 新路徑與改名前的路徑都註冊；兩者進到同一個處理函式、同一套驗證。
  const unregisterRoutes = [API_PREFIX, LEGACY_API_PREFIX].map((path) =>
    ctx.webServer.register({ kind: 'prefix', path, handler: apiRouteHandler }),
  );
  const unregisterRoute = () => {
    for (const off of unregisterRoutes) if (typeof off === 'function') off();
  };

  // ------------------------------------------------------------------- Tools ---
  const disposeTools = registerTools(ctx, {
    channelDefinitions: [
      ...channelLookupTools({
        bridge: sessionBridge,
        getManager: () => manager,
        getConfig,
        sourcePolicy: (channel, id) => memoryOutput.manifest.sourcePolicies?.[channel + ':' + id],
      }),
      ...channelActions.definitions(),
    ],
    musicDefinitions: musicTools({
      providers: musicProviders,
      voice,
      bridge: sessionBridge,
      getManager: () => manager,
    }),
    companion,
    songWorkflow,
    ctx,
    memoryOutput,
    culture,
    getManager: () => manager,
    getConfig,
    setConfig: async (patch) => {
      const result = await apiSetConfig(patch, 'tool');
      return result;
    },
    getLedger: () => ledger,
    getHistory: () => history,
    getLogger: () => logger,
    log: logger,
    publicConfig: () => publicConfig(activeConfig),
  });

  /**
   * 統一的設定更新入口：過濾未知欄位、保護機密欄位不被空字串覆蓋、
   * 需要時重啟對應的 Discord 連線。
   */
  async function applyPatch(patch, options = {}) {
    if (options.source === 'tool') {
      const denied = toolConfigRejection(patch);
      if (denied.length)
        return { ok: false, error: '這些欄位只能由管理者在設定介面修改：' + denied.join('、') };
    }
    const allowed = {};
    const ignoredSecrets = [];
    for (const [key, value] of Object.entries(patch || {})) {
      if (!(key in DEFAULTS)) continue;
      const isSecret = SECRET_KEYS.includes(key);
      if (isSecret) {
        // 前端會把機密欄位以空字串回傳（只帶 <key>__set），空字串代表「不要改」
        if (typeof value === 'string' && !value.trim()) {
          ignoredSecrets.push(key);
          continue;
        }
      }
      allowed[key] = value;
    }
    if (!Object.keys(allowed).length) {
      return {
        ok: false,
        error: ignoredSecrets.length ? '機密欄位沒有填寫新值（維持原設定）' : '沒有可更新的欄位',
      };
    }
    if (USER_PRESENCE_KEYS.some((key) => key in allowed)) {
      const candidate = sanitizeConfig({ ...activeConfig, ...allowed });
      if (candidate.userPresenceEnabled) {
        try {
          validatePresence(userPresence(candidate));
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
    }
    if (Object.keys(allowed).some((key) => key.startsWith('voiceTranscript'))) {
      try {
        validateTranscriptConfig({ ...activeConfig, ...allowed });
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    const beforeSave = activeConfig;
    const { changed } = await saveConfig(allowed);
    configHistory.record(beforeSave, activeConfig, changed, options.source || 'ui');
    if (changed.includes('enabled') && !activeConfig.enabled) await manager.stopAll();
    const restarted = [];
    for (const kind of ['user', 'bot']) {
      if (options.skipRestart) break;
      const needsRestart = changed.some((key) => RECONNECT_KEYS[kind].includes(key));
      if (needsRestart && (manager.byKind[kind].ready || (kind === 'user' && manager.byKind.user.process))) {
        try {
          if (
            activeConfig.enabled === false ||
            activeConfig[kind === 'user' ? 'userEnabled' : 'botEnabled'] === false
          )
            await manager.stop(kind);
          else await manager.restart(kind, activeConfig);
          restarted.push(kind);
        } catch (error) {
          logger.warn('config.restart', `${kind} 重新連線失敗`, { error: error.message });
        }
      }
    }
    // 即時套用不需要重連的設定（活動狀態、斜線指令）。
    const live = [];
    const liveResults = {};
    if (
      activeConfig.userPresenceEnabled &&
      (USER_PRESENCE_KEYS.some((key) => changed.includes(key)) || changed.includes('userReceiveOnly'))
    ) {
      const user = manager.get('user');
      liveResults.userPresence = user?.ready
        ? await user.applyPresence()
        : { ok: false, pending: true, error: '尚未連線；登入後套用' };
      live.push(
        'userPresence:' +
          (liveResults.userPresence.ok ? 'ok' : liveResults.userPresence.pending ? 'pending' : 'fail'),
      );
    }
    try {
      const bot = manager.get('bot');
      if (bot?.ready) {
        if (changed.some((key) => ['botActivityType', 'botActivityText'].includes(key))) {
          await bot.setActivity?.();
          live.push('botActivity');
        }
        if (changed.includes('botSlashCommands') || changed.includes('botNativeInteractions')) {
          const result = activeConfig.botSlashCommands
            ? await bot.registerSlashCommands()
            : await bot.clearSlashCommands();
          live.push(`slashCommands:${result?.ok ? 'ok' : 'fail'}`);
        }
      }
    } catch (error) {
      logger.warn('config.live', '即時套用設定失敗', { error: error.message });
    }
    if (!options.silent) {
      logger.info('config.save', '設定已更新', {
        keys: changed,
        restarted,
        live,
        source: options.source || 'ui',
        fingerprints:
          changed.includes('userToken') || changed.includes('botToken')
            ? { user: tokenFingerprint(activeConfig.userToken), bot: tokenFingerprint(activeConfig.botToken) }
            : undefined,
      });
    }
    return {
      ok: true,
      changed,
      restarted,
      live,
      liveResults,
      ignoredSecrets,
      config: publicConfig(activeConfig),
    };
  }

  async function apiSetConfig(patch, source) {
    const result = await applyPatch(patch, { source });
    return result.ok ? result : { ok: false, error: result.error };
  }

  // --------------------------------------------------------------- 對外服務 ---
  globalThis.__DSH_DISCORD_PYSELF_LAB__ = {
    version: '1.0.6',
    registerMusicProvider: (provider) => musicProviders.register(provider),
    musicProviders: () => musicProviders.catalog(),
    culture: {
      status: () => culture.status(),
      lookup: (message) => culture.lookup(message),
      registerRecallProvider: (id, lookup) => culture.registerRecallProvider(id, lookup),
    },
    registerMemoryMaintenanceAdapter: (adapter) => memoryMaintenance.contracts.register(adapter),
    memoryOutput: {
      registerMemoryWriter: (id, write) => memoryOutput.diaryAgent.registerMemoryWriter(id, write),
      status: () => memoryOutput.status(),
      read: (id, format) => memoryOutput.read(id, format),
      exportDay: (date, options) => memoryOutput.exportDay(date, options),
    },
    status: () => manager.status(),
    config: () => activeConfig,
    sendMessage: (channelId, options, transportKind) =>
      manager.resolve(transportKind).sendMessage(channelId, options),
    recordMessage: (message, transportKind) => history.record(message, transportKind || 'user'),
    simulateInbound,
    logs: (limit) => logger.recent(limit),
  };

  // ----------------------------------------------------------------- 自動啟動 ---
  const autoStart = async () => {
    if (!activeConfig.enabled) return;
    const results = await manager.startEnabled(activeConfig).catch((error) => ({ error: error.message }));
    if (results.error) logger.warn('transport.autostart', '自動連線失敗', results);
    for (const [kind, result] of Object.entries(results)) {
      if (result?.ok)
        logger.info(
          'transport.autostart',
          result.pending ? `${kind} 已開啟，等待 Python 登入完成` : `${kind} 已自動連線`,
        );
      else if (result?.error)
        logger.warn('transport.autostart', `${kind} 自動連線失敗`, { error: truncate(result.error, 200) });
    }
  };
  const autoStartTimer = setTimeout(() => {
    autoStart().catch((error) =>
      logger.warn('transport.autostart', '自動連線例外', { error: error.message }),
    );
  }, 800);
  ctx.effect(() => () => clearTimeout(autoStartTimer));

  // -------------------------------------------------------------------- 清理 ---
  ctx.effect?.(() => () => {
    logger.info('plugin.stop', 'dsh-discord-cyberfriend 關閉');
    try {
      if (typeof unregisterRoute === 'function') unregisterRoute();
    } catch {
      /* 已卸載 */
    }
    try {
      disposeTools?.();
    } catch {
      /* 已卸載 */
    }
    turns.close();
    void companion.close();
    manager.stopAll().catch(() => {});
    history.flush?.().catch(() => {});
    ledger.flush?.().catch(() => {});
    logger.flush?.();
    delete globalThis.__DSH_DISCORD_PYSELF_LAB__;
  });
}

/** 註冊 Agent 工具（容錯：不同版本 DSH 的註冊 API 略有差異）。 */
function registerTools(ctx, deps) {
  const disposers = [];
  const definitions = [
    ...createToolDefinitions(deps),
    ...(deps.songWorkflow?.definitions || []),
    ...(deps.companion?.definitions() || []),
    ...(deps.musicDefinitions || []),
    ...(deps.channelDefinitions || []),
  ];
  const tools = (typeof ctx.get === 'function' ? ctx.get('tools') : undefined) || ctx.tools;
  if (!tools) {
    deps.log?.warn('tools.missing', '找不到 tools 服務，Agent 工具未註冊');
    return () => {};
  }
  const output = {
    schema: { type: 'object' },
    render: (_args, value) => [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2),
      },
    ],
  };
  for (const definition of definitions) {
    const enriched = { ...definition, output };
    try {
      if (typeof tools.register === 'function') {
        const disposer = tools.register(enriched);
        if (typeof disposer === 'function') disposers.push(disposer);
        else if (disposer?.dispose) disposers.push(() => disposer.dispose());
        continue;
      }
      if (typeof tools.define === 'function') {
        const disposer = tools.define(enriched);
        if (typeof disposer === 'function') disposers.push(disposer);
        continue;
      }
      if (typeof ctx.tool === 'function') {
        const disposer = ctx.tool(enriched);
        if (typeof disposer === 'function') disposers.push(disposer);
        continue;
      }
      deps.log?.warn('tools.unsupported', '這個版本的 DSH 不支援工具註冊');
      break;
    } catch (error) {
      deps.log?.warn('tools.register', `工具 ${definition.name} 註冊失敗`, { error: error.message });
    }
  }
  deps.log?.info('tools.ready', 'Agent 工具已註冊', { count: definitions.length });
  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        /* 已釋放 */
      }
    }
  };
}

export { buildConfigSchema };

export async function getSharedHub() {
  return globalThis.__DSH_DISCORD_PYSELF_LAB__;
}

export function describeMessage(message) {
  return describeRichContent(message?.content, message?.stickers);
}
