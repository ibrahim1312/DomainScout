import unittest
from domainscout import analyze

class DomainTests(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(analyze("Example.COM.")["domain"], "example.com")

    def test_features(self):
        self.assertTrue(analyze("test-2.com")["contains_digits"])
        self.assertTrue(analyze("test-2.com")["contains_hyphen"])

    def test_invalid(self):
        for name in ("localhost", "-bad.com", "a..com", "https://example.com"):
            with self.assertRaises(ValueError):
                analyze(name)

if __name__ == "__main__":
    unittest.main()
