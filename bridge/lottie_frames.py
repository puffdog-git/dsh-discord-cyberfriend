"""Bounded, vector-only Lottie rendering in the disposable media worker.

No browser, JavaScript evaluation, external assets, or network requests.
The parent process also enforces a six-second deadline and output limit.
"""
import base64
import io
import json
import math
import tempfile


def validate_lottie(data):
    if len(data) > 512 * 1024:
        raise ValueError('INPUT_SIZE')
    try:
        doc = json.loads(data)
    except (ValueError, RecursionError):
        raise ValueError('LOTTIE_INVALID')
    if not isinstance(doc, dict) or not isinstance(doc.get('layers'), list):
        raise ValueError('LOTTIE_INVALID')
    def number(key):
        value = doc.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError('LOTTIE_INVALID')
        return value
    width, height, fps, start, end = [number(k) for k in ('w', 'h', 'fr', 'ip', 'op')]
    if not 1 <= width <= 1024 or not 1 <= height <= 1024:
        raise ValueError('PIXEL_LIMIT')
    if not 1 <= fps <= 60 or not 0 < end - start <= 600 or (end - start) / fps > 10:
        raise ValueError('ANIMATION_LIMIT')
    stack, nodes = [(doc, 0)], 0
    while stack:
        value, depth = stack.pop()
        nodes += 1
        if nodes > 60000 or depth > 64:
            raise ValueError('LOTTIE_COMPLEXITY')
        if isinstance(value, dict):
            # Asset paths and fonts are not needed by Discord's vector stickers.
            # Reject embedded images too, keeping nested decoder inputs out of rlottie.
            if ('p' in value and isinstance(value['p'], str)) or value.get('u') or value.get('fPath'):
                raise ValueError('LOTTIE_EXTERNAL_ASSET')
            if isinstance(value.get('x'), str) and value['x'].strip():
                raise ValueError('LOTTIE_EXPRESSION')
            stack.extend((v, depth + 1) for v in value.values())
        elif isinstance(value, list):
            stack.extend((v, depth + 1) for v in value)
        elif isinstance(value, float) and not math.isfinite(value):
            raise ValueError('LOTTIE_INVALID')
    return doc


def extract_lottie(data, count=4):
    doc = validate_lottie(data)
    try:
        from rlottie_python import LottieAnimation
        from PIL import Image
    except (ImportError, OSError):
        raise ValueError('LOTTIE_RENDERER_UNAVAILABLE')
    try:
        # Even a renderer implementation that consults resource_path sees only
        # a fresh empty directory; no user files are placed there.
        with tempfile.TemporaryDirectory(prefix='dsh-lottie-') as resources:
            with LottieAnimation.from_data(json.dumps(doc), resource_path=resources) as animation:
                # Lottie op is exclusive; rlottie can report an extra blank end frame.
                total = min(animation.lottie_animation_get_totalframe(), math.ceil(doc['op'] - doc['ip']))
                fps = animation.lottie_animation_get_framerate()
                if not 1 <= total <= 600 or not 1 <= fps <= 60:
                    raise ValueError('ANIMATION_LIMIT')
                count = min(total, max(2, min(6, int(count))))
                indices = sorted({round((total - 1) * i / (count - 1)) for i in range(count)}) if count > 1 else [0]
                scale = min(1, 512 / max(doc['w'], doc['h']))
                width, height = max(1, round(doc['w'] * scale)), max(1, round(doc['h'] * scale))
                frames = []
                for index in indices:
                    rgba = animation.render_pillow_frame(frame_num=index, width=width, height=height).convert('RGBA')
                    rgb = Image.new('RGB', rgba.size, 'white')
                    rgb.paste(rgba, mask=rgba.getchannel('A'))
                    output = io.BytesIO()
                    rgb.save(output, 'JPEG', quality=80)
                    frames.append({'data': base64.b64encode(output.getvalue()).decode('ascii'),
                                   'mediaType': 'image/jpeg', 'timeMs': round(index / fps * 1000),
                                   'index': index, 'width': width, 'height': height})
                return {'ok': True, 'frames': frames, 'totalFrames': total,
                        'durationMs': round(total / fps * 1000), 'format': 'LOTTIE',
                        'sampled': len(indices) < total}
    except ValueError:
        raise
    except Exception:
        raise ValueError('LOTTIE_RENDER_FAILED')
