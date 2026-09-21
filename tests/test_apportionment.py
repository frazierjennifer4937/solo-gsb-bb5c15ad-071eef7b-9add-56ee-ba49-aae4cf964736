import unittest
from fractions import Fraction

from app.apportionment import hamilton, scan, validate_inputs


class HamiltonApportionmentTests(unittest.TestCase):
    def test_example_has_reproducible_alabama_paradox(self):
        result = scan([5, 3, 1], ["甲", "乙", "丙"], 3, 5)

        self.assertEqual(result["paradoxCount"], "1")
        paradox = result["paradoxes"][0]
        self.assertEqual(paradox["fromSeats"], "4")
        self.assertEqual(paradox["toSeats"], "5")
        self.assertEqual(paradox["losingIndexes"], [2])
        self.assertEqual(
            [region["seats"] for region in paradox["before"]["regions"]],
            ["2", "1", "1"],
        )
        self.assertEqual(
            [region["seats"] for region in paradox["after"]["regions"]],
            ["3", "2", "0"],
        )

    def test_all_quantities_are_exact_fractions(self):
        result = hamilton([5, 3, 1], ["甲", "乙", "丙"], 3)
        quota = result["regions"][0]["quota"]

        self.assertEqual(Fraction(int(quota["numerator"]), int(quota["denominator"])), Fraction(15, 9))
        self.assertEqual(quota["numerator"], "5")
        self.assertEqual(quota["denominator"], "3")

    def test_equal_remainder_prefers_larger_population(self):
        # At four seats, populations 5 and 3 have quotas 5/2 and 3/2.
        # Both remainders are 1/2, so population 5 wins the leftover seat.
        result = hamilton([5, 3], ["大", "小"], 4)

        self.assertEqual(result["regions"][0]["seats"], "3")
        self.assertEqual(result["regions"][1]["seats"], "1")
        self.assertTrue(all(region["remainderTied"] for region in result["regions"]))
        self.assertEqual(result["awardOrder"], ["0", "1"])

    def test_equal_remainder_and_population_prefers_earlier_input(self):
        result = hamilton([2, 2], ["先", "后"], 1)

        self.assertEqual(result["regions"][0]["seats"], "1")
        self.assertEqual(result["regions"][1]["seats"], "0")
        self.assertEqual(result["awardOrder"], ["0", "1"])

    def test_three_way_equal_remainder_uses_tie_breakers(self):
        result = hamilton([2, 2, 2], ["先", "中", "后"], 1)

        self.assertEqual(result["awardOrder"], ["0", "1", "2"])
        self.assertEqual([region["seats"] for region in result["regions"]], ["1", "0", "0"])
        self.assertTrue(all(region["remainderTied"] for region in result["regions"]))

    def test_scan_span_limit_is_inclusive(self):
        validate_inputs([1, 1], 1, 501)  # span = 500

        with self.assertRaisesRegex(ValueError, "不能超过 500"):
            validate_inputs([1, 1], 1, 502)


if __name__ == "__main__":
    unittest.main()
