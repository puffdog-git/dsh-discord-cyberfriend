import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bridge'))
from worker import error_details
import discord
from curl_cffi import CurlError


class ErrorDetailsTest(unittest.TestCase):
    def test_dns_error_is_not_a_gateway_close(self):
        self.assertEqual(error_details(CurlError('private request details', 6)),
                         {'code': 'CurlError', 'curlCode': 6})

    def test_gateway_close_has_its_own_code(self):
        self.assertEqual(error_details(discord.ConnectionClosed(4004, 'private reason')),
                         {'code': 'ConnectionClosed', 'closeCode': 4004})

    def test_unknown_error_does_not_expose_exception_text(self):
        self.assertEqual(error_details(RuntimeError('private token')), {'code': 'RuntimeError'})


if __name__ == '__main__':
    unittest.main()
