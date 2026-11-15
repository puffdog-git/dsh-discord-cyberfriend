import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceMixer } from '../src/voice-mixer.js';
const frame = (value) => {
  const b = Buffer.alloc(3840);
  for (let n = 0; n < b.length; n += 2) b.writeInt16LE(value, n);
  return b;
};
async function* frames(value, count) {
  for (let n = 0; n < count; n++) yield frame(value);
}
test('two-track PCM mixes speech, smoothly ducks music, restores it and never wraps clipped samples', async () => {
  const mixer = new VoiceMixer(),
    out = [];
  let speech,
    started = 0;
  const music = mixer.add('music', frames(1000, 24));
  try {
    for await (const b of mixer) {
      out.push(b.readInt16LE(0));
      if (out.length === 3) speech = mixer.add('voice', frames(2000, 10), { onStarted: () => started++ });
    }
    assert.equal((await music).ok, true);
    assert.equal((await speech).ok, true);
    assert.equal(started, 1);
    assert.equal(out[0], 1000);
    assert.ok(out.some((v) => v >= 2190 && v <= 2210));
    assert.equal(out.at(-1), 1000);
    assert.ok(out.slice(3, 8).some((v) => v > 2000));
  } finally {
    mixer.stop();
  }
  const clipping = new VoiceMixer({ duck: 1 });
  clipping.add('music', frames(30000, 3));
  clipping.add('voice', frames(30000, 3));
  try {
    let peak = 0;
    for await (const b of clipping) peak = Math.max(peak, b.readInt16LE(0));
    assert.equal(peak, 32767);
  } finally {
    clipping.stop();
  }
});
test('stopping the speech track keeps music alive; stopping the mixer settles both tracks', async () => {
  const mixer = new VoiceMixer(),
    controller = new AbortController();
  const music = mixer.add('music', frames(1000, 8)),
    speech = mixer.add('voice', frames(2000, 8), { signal: controller.signal });
  let n = 0,
    bytes = 0;
  try {
    for await (const b of mixer) {
      bytes += b.length;
      if (++n === 2) controller.abort();
    }
    assert.equal((await speech).ok, false);
    assert.equal((await music).ok, true);
    assert.equal(bytes, 8 * 3840);
  } finally {
    mixer.stop();
  }
});
test('a stalled consumer keeps producer buffering bounded to one second', async () => {
  let produced = 0;
  const mixer = new VoiceMixer(),
    work = mixer.add(
      'music',
      (async function* () {
        for (let i = 0; i < 500; i++) {
          produced++;
          yield frame(1);
        }
      })(),
    );
  try {
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(produced <= 50);
    mixer.stop();
    assert.equal((await work).ok, false);
  } finally {
    mixer.stop();
  }
});

test('partial pipe chunks are accumulated rather than padded into silent gaps', async () => {
  const expected = Buffer.concat([frame(1000), frame(2000), frame(3000)]),
    m = new VoiceMixer();
  const job = m.add(
    'music',
    (async function* () {
      for (let i = 0; i < expected.length; i += 400) {
        yield expected.subarray(i, i + 400);
        await new Promise((r) => setImmediate(r));
      }
    })(),
  );
  const parts = [];
  for await (const chunk of m) parts.push(chunk);
  assert.deepEqual(Buffer.concat(parts), expected);
  assert.equal((await job).ok, true);
  m.stop();
});
