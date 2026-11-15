// PCM16LE/48 kHz/stereo. An energy gate is evidence of sound, not echo cancellation.
export class SpeechActivity {
  constructor({ threshold = 0.015, minSpeechMs = 400, gapMs = 120 } = {}) {
    Object.assign(this, { threshold, minSpeechMs, gapMs });
    this.voicedMs = 0;
    this.runMs = 0;
    this.silenceMs = 0;
    this.confirmed = false;
    this.window = [];
    this.windowMs = 0;
    this.windowVoiced = 0;
  }
  push(pcm) {
    let square = 0;
    for (let at = 0; at + 1 < pcm.length; at += 2) {
      const value = pcm.readInt16LE(at) / 32768;
      square += value * value;
    }
    const ms = pcm.length / 192,
      rms = Math.sqrt(square / Math.max(1, pcm.length / 2));
    const voiced = rms >= this.threshold;
    this.window.push({ ms, voiced });
    this.windowMs += ms;
    this.windowVoiced += voiced ? ms : 0;
    while (this.windowMs > Math.max(600, this.minSpeechMs / 0.65) && this.window.length > 1) {
      const first = this.window.shift();
      this.windowMs -= first.ms;
      this.windowVoiced -= first.voiced ? first.ms : 0;
    }
    if (voiced) {
      this.voicedMs += ms;
      this.runMs += ms;
      this.silenceMs = 0;
    } else {
      this.silenceMs += ms;
      if (this.silenceMs > this.gapMs) this.runMs = 0;
    }
    const newlyConfirmed =
      !this.confirmed && this.runMs >= this.minSpeechMs && this.windowVoiced / this.windowMs >= 0.65;
    if (newlyConfirmed) this.confirmed = true;
    return { newlyConfirmed, voicedMs: this.voicedMs, continuousMs: this.runMs };
  }
}

const fold = (text) =>
  String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
export function resemblesPlayback(transcript, spoken) {
  const a = fold(transcript),
    b = fold(spoken);
  if (a.length < 4 || b.length < 4) return false;
  if (b.includes(a) || (a.includes(b) && b.length / a.length >= 0.8)) return true;
  const grams = new Set();
  for (let i = 0; i < b.length - 1; i++) grams.add(b.slice(i, i + 2));
  let matches = 0;
  for (let i = 0; i < a.length - 1; i++) if (grams.has(a.slice(i, i + 2))) matches++;
  return matches / (a.length - 1) >= 0.85;
}
