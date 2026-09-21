import unittest

try:
    from fastapi.testclient import TestClient

    from app.main import app

    HAS_API_DEPENDENCIES = True
except ImportError:  # Allow the repository's stdlib-only core test environment.
    HAS_API_DEPENDENCIES = False


@unittest.skipUnless(HAS_API_DEPENDENCIES, "FastAPI test dependencies are not installed")
class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_calculate_reports_example_paradox(self):
        response = self.client.post(
            "/api/calculate",
            json={
                "regions": [
                    {"name": "甲地区", "population": "5"},
                    {"name": "乙地区", "population": "3"},
                    {"name": "丙地区", "population": "1"},
                ],
                "houseStart": "3",
                "houseEnd": "5",
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["paradoxCount"], "1")
        self.assertEqual(data["paradoxes"][0]["fromSeats"], "4")
        self.assertEqual(data["paradoxes"][0]["toSeats"], "5")

    def test_scan_span_limit_rejected(self):
        response = self.client.post(
            "/api/calculate",
            json={
                "regions": [
                    {"name": "甲", "population": "1"},
                    {"name": "乙", "population": "1"},
                ],
                "houseStart": "1",
                "houseEnd": "502",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("500", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
