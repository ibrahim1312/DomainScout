import unittest
from market_valuation import report

class MarketTests(unittest.TestCase):
    def test_missing(self):
        r = report("example.com", [], [])
        self.assertIsNone(r["observed_comparable_median_usd"])
        self.assertIsNone(r["market_value"])

    def test_evidence(self):
        sales = [{"domain":"sample.com","price_usd":"100","source":"test fixture"},{"domain":"sample.ai","price_usd":"900","source":"test fixture"}]
        r = report("example.com", sales, [{"website":"https://example.org"},{"website":"https://example.org/"}], 100, 2)
        self.assertEqual(r["observed_comparable_median_usd"], 100)
        self.assertEqual(r["candidate_buyer_count"], 1)
        self.assertEqual(r["search_commercial_proxy_usd"], 200)
