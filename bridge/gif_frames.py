"""Bounded Pillow animation decoding. Raw bytes in; JSON JPEG frames out. No network/login."""
import base64
import io
import json
import sys
import warnings

from PIL import Image

MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 16_000_000
MAX_FRAMES = 300
MAX_DECODED_PIXELS = 200_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
warnings.simplefilter('error', Image.DecompressionBombWarning)


def extract(data, count=4):
    if not data or len(data) > MAX_BYTES:
        raise ValueError('INPUT_SIZE')
    count = max(2, min(6, int(count)))
    if data.lstrip().startswith(b'{'):
        from lottie_frames import extract_lottie
        return extract_lottie(data, count)
    with Image.open(io.BytesIO(data)) as im:
        if im.format not in ('GIF', 'WEBP', 'PNG', 'JPEG'):
            raise ValueError('UNSUPPORTED_FORMAT')
        width, height = im.size
        if width * height > MAX_PIXELS:
            raise ValueError('PIXEL_LIMIT')
        durations = []
        for index in range(MAX_FRAMES + 1):
            try:
                im.seek(index)
            except EOFError:
                break
            if index == MAX_FRAMES or width * height * (index + 1) > MAX_DECODED_PIXELS:
                raise ValueError('ANIMATION_LIMIT')
            durations.append(max(20, min(60000, int(im.info.get('duration', 100)))))
        starts, elapsed = [], 0
        for duration in durations:
            starts.append(elapsed)
            elapsed += duration
        # Sample across animation time, always including its first and last frame.
        targets = [starts[-1] * i / (min(count, len(starts)) - 1)
                   for i in range(min(count, len(starts)))] if len(starts) > 1 else [0]
        indices = sorted({min(range(len(starts)), key=lambda i: abs(starts[i] - t)) for t in targets})
        frames = []
        for index in indices:
            im.seek(index)  # Pillow composites GIF disposal/transparency during seek.
            rgba = im.convert('RGBA')
            edge = 512 if len(starts) > 1 else 1280
            rgba.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            rgb = Image.new('RGB', rgba.size, 'white')
            rgb.paste(rgba, mask=rgba.getchannel('A'))
            output = io.BytesIO()
            rgb.save(output, 'JPEG', quality=80)
            frames.append({'data': base64.b64encode(output.getvalue()).decode('ascii'),
                           'mediaType': 'image/jpeg', 'timeMs': starts[index], 'index': index,
                           'width': rgb.width, 'height': rgb.height})
        return {'ok': True, 'frames': frames, 'totalFrames': len(starts),
                'durationMs': elapsed if len(starts) > 1 else 0, 'format': im.format}


if __name__ == '__main__':
    try:
        result = extract(sys.stdin.buffer.read(MAX_BYTES + 1), sys.argv[1] if len(sys.argv) > 1 else 4)
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) else type(error).__name__
        result = {'ok': False, 'error': code[:80]}
    print(json.dumps(result, separators=(',', ':')))
