import { VoiceMixer } from './voice-mixer.js';
import { musicPcm } from './voice-stream.js';
import { attachVoiceReceiver } from './voice-receive.js';
// Shares the authenticated Gateway; the voice SDK owns encryption and DAVE sessions.
export class BotVoice {
  constructor(
    transport,
    {
      load = () => import('@discordjs/voice'),
      readyTimeout = 20000,
      recoveryMs = 5000,
      maxReconnects = 3,
    } = {},
  ) {
    Object.assign(this, { transport, load, readyTimeout, recoveryMs, maxReconnects });
    transport.voiceOutput = this;
    this.supportsMixing = true;
    this.phase = 'idle';
    this.reconnects = 0;
    this.generation = 0;
  }
  async join({ guildId, channelId, receive, onUnavailable }) {
    const v = await this.load();
    this.lib = v;
    this.receiveStop = receive?.onStop;
    this.receiveOptions = receive;
    this.onUnavailable = onUnavailable;
    this.life = new AbortController();
    this.generation++;
    this.phase = 'connecting';
    this.failed = false;
    const channel = await this.transport.rest('GET', `/channels/${channelId}`);
    if (channel.type !== 2 || channel.guild_id !== guildId) throw Error('請選擇同一伺服器的一般語音頻道');
    const gateway = (type, data) => {
      if (this.life?.signal.aborted) return;
      if (String(data.guild_id) !== guildId) return;
      if (type === 'VOICE_SERVER_UPDATE') this.methods?.onVoiceServerUpdate(data);
      else if (type === 'VOICE_STATE_UPDATE' && data.user_id === this.transport.selfId) {
        if (data.channel_id !== channelId) {
          this.terminal('已被移出原語音房間，請重新確認目的地');
          return;
        }
        if (data.mute === true || data.suppress === true) {
          this.terminal('伺服器限制發話，已停止音訊；請確認權限後重新加入');
          return;
        }
        this.methods?.onVoiceStateUpdate(data);
      }
    };
    const connection = v.joinVoiceChannel({
      guildId,
      channelId,
      group: 'dsh-discord-cyberfriend',
      selfDeaf: !receive,
      selfMute: false,
      daveEncryption: true,
      adapterCreator: (methods) => {
        this.methods = methods;
        this.transport.voiceGateway = gateway;
        return {
          sendPayload: (payload) => this.transport.ready && this.transport.sendSocket(payload),
          destroy: () => {
            if (this.transport.voiceGateway === gateway) this.transport.voiceGateway = null;
          },
        };
      },
    });
    this.connection = connection;
    this.gateway = gateway;
    this.stateListener = (_old, state) => {
      if (this.life?.signal.aborted) return;
      if (state.status === v.VoiceConnectionStatus.Ready) {
        this.failed = false;
        this.phase = 'connected';
        this.attachReceiver();
      } else if (state.status === v.VoiceConnectionStatus.Disconnected)
        void this.recover(state.closeCode === 4014);
      else if (state.status === v.VoiceConnectionStatus.Destroyed) {
        this.terminal('語音連線已結束');
      }
    };
    this.errorListener = () => {
      void this.recover(false);
    };
    connection.on('stateChange', this.stateListener);
    connection.on('error', this.errorListener);
    try {
      await this.waitReady(this.life.signal);
      this.player = v.createAudioPlayer({
        behaviors: { noSubscriber: v.NoSubscriberBehavior.Stop, maxMissedFrames: 250 },
      });
      this.player.on('error', () => {});
      connection.subscribe(this.player);
      this.phase = 'connected';
      this.attachReceiver();
      return { ok: true };
    } catch {
      await this.leave();
      throw Error('Bot 語音連線失敗，請檢查房間權限與語音網路');
    }
  }
  attachReceiver() {
    if (this.player && this.connected && this.receiveOptions && !this.receiveClose)
      this.receiveClose = attachVoiceReceiver(this.connection, this.lib, this.receiveOptions);
  }
  unavailable(reason) {
    this.receiveClose?.();
    this.receiveClose = null;
    this.receiveStop?.();
    this.onUnavailable?.(reason);
    this.interrupt(reason);
  }
  get connected() {
    return (
      !!this.connection &&
      !this.failed &&
      this.connection.state.status === this.lib.VoiceConnectionStatus.Ready
    );
  }
  get status() {
    return {
      phase: this.phase,
      recovering: !!this.recovering,
      reconnects: this.reconnects,
      lastFailure: this.lastFailure || null,
    };
  }
  async waitReady(signal) {
    if (this.connected) return;
    const combined = AbortSignal.any([
      ...(signal ? [signal] : []),
      this.life.signal,
      AbortSignal.timeout(this.readyTimeout),
    ]);
    await this.lib.entersState(this.connection, this.lib.VoiceConnectionStatus.Ready, combined);
    combined.throwIfAborted();
    if (!this.connected) throw Error('語音連線尚未恢復');
  }
  interrupt(reason) {
    this.mixer?.stop();
    this.mixer = null;
    this.activeFinish?.(false, reason);
    this.player?.stop(true);
  }
  terminal(reason) {
    if (this.failed && this.life?.signal.aborted) return;
    this.failed = true;
    this.lastFailure = reason;
    this.phase = 'disconnected';
    this.life?.abort();
    this.unavailable(reason);
    if (this.connection && this.connection.state.status !== this.lib.VoiceConnectionStatus.Destroyed)
      this.connection.destroy();
  }
  async recover(serverMove) {
    if (this.recovering || this.life?.signal.aborted || !this.connection) return;
    this.recovering = true;
    this.phase = 'reconnecting';
    this.unavailable('語音連線中斷，已停止舊音訊與待播佇列，不自動重播');
    const connection = this.connection,
      generation = this.generation;
    try {
      for (let attempt = 0; attempt < this.maxReconnects; attempt++) {
        if (this.life.signal.aborted || generation !== this.generation) return;
        if (this.connected) {
          this.phase = 'connected';
          this.attachReceiver();
          return;
        }
        if (!serverMove && this.transport.ready && attempt > 0) {
          this.reconnects++;
          connection.rejoin();
        }
        try {
          await this.lib.entersState(
            connection,
            this.lib.VoiceConnectionStatus.Ready,
            AbortSignal.any([this.life.signal, AbortSignal.timeout(this.recoveryMs)]),
          );
          if (this.connected) {
            this.phase = 'connected';
            return;
          }
        } catch {}
      }
      if (!this.life.signal.aborted && generation === this.generation)
        this.terminal('語音重連逾時；請確認權限後重新加入');
    } finally {
      if (generation === this.generation) this.recovering = false;
    }
  }
  async play(input, { signal, durationMs, raw = false, onStarted } = {}) {
    if (!this.connected) throw Error('Bot 語音已斷線');
    if (this.mixer?.accepting) {
      if (raw) return this.mixer.add('voice', input, { signal, onStarted });
      const pcm = musicPcm(input, signal);
      try {
        const result = await this.mixer.add('voice', pcm.stream, { signal, onStarted });
        if (result.ok) await pcm.done;
        return result;
      } finally {
        await pcm.remove();
      }
    }
    const { createAudioResource, StreamType, AudioPlayerStatus } = this.lib,
      player = this.player;
    return new Promise((resolve) => {
      let started = false,
        settled = false,
        resource;
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        player.off('stateChange', change);
        player.off('error', fail);
        if (this.activeFinish === finish) this.activeFinish = null;
        resolve({ ok, started, ...(error ? { error } : {}), interrupted: !!signal?.aborted });
      };
      const abort = () => {
          finish(false, '播放已停止');
          player.stop(true);
        },
        change = (_, s) => {
          if (s.status === AudioPlayerStatus.Playing && !started) {
            started = true;
            onStarted?.();
          }
          if (s.status === AudioPlayerStatus.Idle) {
            const complete = resource?.ended !== false && !(raw && input?.readableEnded === false);
            finish(
              started && this.connected && complete,
              !complete
                ? '音訊來源尚未結束，播放提前停止；不自動重播'
                : started && this.connected
                  ? undefined
                  : '沒有開始播放或連線已中斷',
            );
          }
        },
        fail = () => {
          finish(false, 'Discord 語音播放失敗');
          player.stop(true);
        },
        timer = setTimeout(
          () => {
            finish(false, '語音播放逾時');
            player.stop(true);
          },
          (durationMs || 180000) + 15000,
        );
      this.activeFinish = finish;
      signal?.addEventListener('abort', abort, { once: true });
      player.on('stateChange', change);
      player.once('error', fail);
      if (signal?.aborted) return abort();
      try {
        resource = createAudioResource(input, { inputType: raw ? StreamType.Raw : StreamType.OggOpus });
        player.play(resource);
      } catch {
        fail();
      }
    });
  }
  async playMusic(path, { signal, durationMs, duck = 0.2 } = {}) {
    if (!this.connected || this.mixer?.accepting) throw Error('Bot 混音連線尚未準備好');
    const mixer = new VoiceMixer({ duck });
    this.mixer = mixer;
    const pcm = musicPcm(path, signal);
    const result = mixer.add('music', pcm.stream, { signal });
    this.player.play(this.lib.createAudioResource(mixer, { inputType: this.lib.StreamType.Raw }));
    const timer = setTimeout(() => mixer.stop(), (durationMs || 3600000) + 15000);
    const playerError = () => mixer.stop(),
      cleanup = () => {
        if (this.mixer === mixer) this.mixer = null;
        this.player.off('error', playerError);
      };
    this.player.on('error', playerError);
    mixer.once('end', cleanup);
    mixer.once('close', cleanup);
    try {
      const value = await result;
      if (value.ok) await pcm.done;
      return value;
    } finally {
      clearTimeout(timer);
      await pcm.remove();
      if (!mixer.accepting) this.player.off('error', playerError);
    }
  }
  playStream(stream, options) {
    return this.play(stream, { ...options, raw: true });
  }
  async stop() {
    this.interrupt('播放已停止');
    return { ok: true };
  }
  async leave() {
    this.receiveStop?.();
    this.receiveClose?.();
    this.receiveClose = null;
    this.generation++;
    this.life?.abort();
    this.recovering = false;
    await this.stop();
    const connection = this.connection;
    if (connection) {
      connection.off('stateChange', this.stateListener);
      connection.off('error', this.errorListener);
      if (connection.state.status !== this.lib.VoiceConnectionStatus.Destroyed) connection.destroy();
    }
    if (this.transport.voiceGateway === this.gateway) this.transport.voiceGateway = null;
    this.connection = null;
    this.phase = 'idle';
    return { ok: true };
  }
}
