import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import Worker


class PluginMessageIdTests(unittest.TestCase):
    def test_oldest_sent_id_is_evicted_first(self):
        # PY2：超過上限時要淘汰最舊的，不能隨機丟掉剛送出的訊息 ID（會被誤判成手動發話）。
        w = Worker()
        w.plugin_message_limit = 5
        for i in range(8):
            w.remember_plugin_message(1000 + i)
        self.assertEqual(len(w.plugin_message_ids), 5)
        for recent in ('1003', '1004', '1005', '1006', '1007'):
            self.assertIn(recent, w.plugin_message_ids)
        for old in ('1000', '1001', '1002'):
            self.assertNotIn(old, w.plugin_message_ids)
        self.assertEqual(Worker().plugin_message_limit, 10000)


if __name__ == '__main__':
    unittest.main()
