import prism from 'prism-media';
import { SpeechActivity } from './voice-activity.js';
// User-specific Opus subscriptions; no shared microphone or recording files.
export function attachVoiceReceiver(
  connection,
  lib,
  { allowed, onAudio, onSpeech, onError, maxSeconds = 15, threshold = 0.015, minSpeechMs = 400 } = {},
) {
  const active = new Map();
  let closed = false;
  const start = (id) => {
    if (closed || active.has(id) || active.size >= 2 || !allowed(id)) return;
    let input, decoder;
    try {
      input = connection.receiver.subscribe(id, {
        end: { behavior: lib.EndBehaviorType.AfterSilence, duration: 800 },
      });
      decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    } catch {
      input?.destroy();
      onError?.('語音 Opus 解碼器未就緒');
      return;
    }
    const parts = [],
      activity = new SpeechActivity({ threshold, minSpeechMs });
    let bytes = 0,
      speechContext,
      failed = false,
      finished = false,
      cleaned = false;
    const stop = () => {
        failed = true;
        input.destroy();
        decoder.destroy();
      },
      timer = setTimeout(() => {
        input.unpipe(decoder);
        input.destroy();
        decoder.end();
      }, maxSeconds * 1000);
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timer);
      active.delete(id);
      input.destroy();
      decoder.destroy();
    };
    active.set(id, { stop });
    input.on('error', () => {
      failed = true;
      decoder.destroy();
    });
    input.on('close', () => {
      if (!input.readableEnded) decoder.end();
    });
    decoder.on('error', () => {
      failed = true;
      cleanup();
    });
    decoder.on('close', cleanup);
    decoder.on('data', (pcm) => {
      if (closed || !allowed(id)) {
        stop();
        cleanup();
        return;
      }
      bytes += pcm.length;
      if (bytes > maxSeconds * 192000) {
        input.unpipe(decoder);
        input.destroy();
        decoder.end();
        return;
      }
      parts.push(pcm);
      const evidence = activity.push(pcm);
      if (evidence.newlyConfirmed) speechContext = onSpeech?.(id, evidence);
    });
    decoder.on('end', () => {
      if (finished) return;
      finished = true;
      const audio =
        !closed && !failed && allowed(id) && activity.voicedMs >= 200 ? Buffer.concat(parts) : null;
      cleanup();
      if (audio)
        Promise.resolve(onAudio?.(id, audio, { speechContext, voicedMs: activity.voicedMs })).catch(() =>
          onError?.('語音辨識或回覆未完成'),
        );
    });
    input.pipe(decoder);
  };
  connection.receiver.speaking.on('start', start);
  return () => {
    closed = true;
    connection.receiver.speaking.off('start', start);
    for (const job of active.values()) job.stop();
    active.clear();
  };
}
