import unittest
from dashboard import render

class DashboardTests(unittest.TestCase):
    def test_escaping(self):
        result = render([{"domain":"<script>", "error":"invalid"}])
        self.assertIn("&lt;script&gt;", result)
        self.assertNotIn("<script>", result)

    def test_report(self):
        self.assertIn("example.com", render([{"domain":"example.com"}]))
