"""Bounded PCM handoff to discord.py-self's audio player thread."""
import queue
import time
import threading
import discord


class PcmSource(discord.AudioSource):
    def __init__(self, max_seconds=180):
        self.queue = queue.Queue(maxsize=25)
        self.buffer = bytearray()
        self.closed = threading.Event()
        self.ended = False
        self.complete = False
        self.started = False
        self.on_started = lambda: None
        self.bytes = 0
        self.max_bytes = max_seconds * 192000
        self.sequence = 0
        self.idle_deadline = time.monotonic() + 15

    def feed(self, data, sequence):
        if self.closed.is_set() or self.ended or sequence != self.sequence or not data or len(data) > 38400 or len(data) % 4:
            raise ValueError('invalid_pcm_stream_chunk')
        if self.bytes + len(data) > self.max_bytes:
            raise ValueError('pcm_stream_duration_limit')
        # A nonblocking bound provides explicit backpressure to the Node writer.
        try:
            self.queue.put_nowait(bytes(data))
        except queue.Full:
            return False
        self.bytes += len(data)
        self.sequence += 1
        self.idle_deadline = time.monotonic() + 15
        return True

    def read(self):
        while len(self.buffer) < 3840 and not self.closed.is_set():
            try:
                self.buffer.extend(self.queue.get(timeout=.02))
            except queue.Empty:
                if self.ended and self.queue.empty():
                    if self.buffer:
                        frame = bytes(self.buffer) + bytes(3840 - len(self.buffer))
                        self.buffer.clear()
                        if not self.started:
                            self.on_started()
                        self.started = True
                        return frame
                    self.complete = self.bytes > 0
                    return b''
                if time.monotonic() > self.idle_deadline:
                    self.closed.set()
                    return b''
                if self.started:
                    return bytes(3840)
        if self.closed.is_set():
            return b''
        frame = bytes(self.buffer[:3840])
        del self.buffer[:3840]
        if not self.started:
            self.on_started()
        self.started = True
        return frame

    def cleanup(self):
        self.closed.set()
        self.buffer.clear()
