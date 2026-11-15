import importlib.util
import io
import pathlib
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location('gif_frames', pathlib.Path(__file__).parents[1] / 'bridge/gif_frames.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def animation(size=(40, 30), durations=None):
    images = [Image.new('RGB', size, color) for color in ['red', 'green', 'blue', 'yellow', 'purple']]
    data = io.BytesIO()
    images[0].save(data, 'GIF', save_all=True, append_images=images[1:],
                   duration=durations or [100] * 5, loop=0, disposal=2)
    return data.getvalue()


class GifFramesTest(unittest.TestCase):
    def test_time_sampling_and_resize(self):
        result = worker.extract(animation((1024, 600), [100, 100, 1000, 100, 100]), 4)
        self.assertEqual(result['totalFrames'], 5)
        self.assertEqual(result['durationMs'], 1400)
        self.assertEqual(result['frames'][0]['index'], 0)
        self.assertEqual(result['frames'][-1]['index'], 4)
        self.assertLessEqual(len(result['frames']), 4)
        self.assertTrue(all(max(f['width'], f['height']) <= 512 for f in result['frames']))

    def test_composited_colors(self):
        import base64
        result = worker.extract(animation(), 6)
        for frame, color in zip(result['frames'], ['red', 'green', 'blue', 'yellow', 'purple']):
            decoded = Image.open(io.BytesIO(base64.b64decode(frame['data'])))
            wanted = Image.new('RGB', (1, 1), color).getpixel((0, 0))
            self.assertTrue(all(abs(a-b) <= 5 for a, b in zip(decoded.getpixel((20, 15)), wanted)))

    def test_transparency_disposal(self):
        import base64
        first = Image.new('RGBA', (20, 20), 'red')
        second = Image.new('RGBA', (20, 20), (0, 0, 0, 0))
        second.paste('blue', (0, 0, 10, 10))
        data = io.BytesIO()
        first.save(data, 'GIF', save_all=True, append_images=[second], disposal=1, duration=100)
        result = worker.extract(data.getvalue())
        decoded = Image.open(io.BytesIO(base64.b64decode(result['frames'][-1]['data'])))
        self.assertGreater(decoded.getpixel((2, 2))[2], 200)
        self.assertGreater(decoded.getpixel((17, 17))[0], 200)

    def test_invalid_oversize_and_static(self):
        for data in [b'', b'not an image', b'x' * (worker.MAX_BYTES + 1)]:
            with self.assertRaises(Exception): worker.extract(data)
        data = io.BytesIO()
        Image.new('RGB', (10, 10), 'white').save(data, 'PNG')
        result = worker.extract(data.getvalue())
        self.assertEqual(result['totalFrames'], 1)
        self.assertEqual(result['durationMs'], 0)

    def test_decoding_budget(self):
        original = worker.MAX_DECODED_PIXELS
        try:
            worker.MAX_DECODED_PIXELS = 2000
            with self.assertRaisesRegex(ValueError, 'ANIMATION_LIMIT'): worker.extract(animation())
        finally: worker.MAX_DECODED_PIXELS = original


if __name__ == '__main__': unittest.main()
