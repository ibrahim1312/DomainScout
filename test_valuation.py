import unittest
from valuation import evaluate

class ValuationTests(unittest.TestCase):
    def test_bounds(self):
        for domain in ("abc.com", "long-domain123.example", "example.ai"):
            result = evaluate(domain)
            self.assertTrue(0 <= result["quality_score"] <= 100)
            self.assertIsNone(result["market_value"])

    def test_clean_name(self):
        self.assertGreater(evaluate("abc.com")["quality_score"], evaluate("a-2.com")["quality_score"])
