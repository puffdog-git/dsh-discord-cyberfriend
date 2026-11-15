import base64
import importlib.util
import io
import json
import pathlib
import unittest
from PIL import Image
spec = importlib.util.spec_from_file_location('lottie_frames', pathlib.Path(__file__).parents[1] / 'bridge/lottie_frames.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
def document():
    return {'v':'5.7.4','fr':30,'ip':0,'op':30,'w':64,'h':64,'layers':[{'ddd':0,'ind':1,'ty':1,'nm':'solid','sw':64,'sh':64,'sc':'#ff0000','ks':{'o':{'a':0,'k':100},'r':{'a':0,'k':0},'p':{'a':0,'k':[0,0,0]},'a':{'a':0,'k':[0,0,0]},'s':{'a':0,'k':[100,100,100]}},'ip':0,'op':30,'st':0,'bm':0}]}
class LottieFramesTest(unittest.TestCase):
    def test_real_renderer_produces_sampled_red_pixels(self):
        result=worker.extract_lottie(json.dumps(document()).encode(),4)
        self.assertEqual(result['format'],'LOTTIE')
        self.assertEqual(len(result['frames']),4)
        self.assertEqual(result['frames'][-1]['index'],29)
        for frame in result['frames']:
            image=Image.open(io.BytesIO(base64.b64decode(frame['data'])))
            red,green,blue=image.getpixel((32,32))
            self.assertGreater(red,240)
            self.assertLess(green,15)
            self.assertLess(blue,15)
    def test_rejects_external_embedded_assets_fonts_and_expressions(self):
        for extra in [{'p':'file:///secret.png'}, {'p':'data:image/png;base64,AAA'}, {'u':'https://example.com/'}, {'fPath':'C:/secret'}, {'x':'fetch("secret")'}]:
            doc=document();doc['assets']=[extra]
            with self.assertRaisesRegex(ValueError,'LOTTIE_(EXTERNAL_ASSET|EXPRESSION)'):
                worker.validate_lottie(json.dumps(doc).encode())
    def test_bounds_dimensions_duration_fps_and_depth(self):
        for key,value in [('w',100000),('h',0),('fr',1000),('op',100000),('fr',float('nan'))]:
            doc=document();doc[key]=value
            with self.assertRaises(ValueError):worker.validate_lottie(json.dumps(doc).encode())
        doc=document();nested=[];doc['assets']=nested
        for _ in range(80):child=[];nested.append(child);nested=child
        with self.assertRaisesRegex(ValueError,'LOTTIE_COMPLEXITY'):worker.validate_lottie(json.dumps(doc).encode())
    def test_invalid_root_and_oversize(self):
        for data in [b'not-json',b'[]',b'{"layers":[]}',b'x'*524289]:
            with self.assertRaises(ValueError):worker.validate_lottie(data)
if __name__=='__main__':unittest.main()
