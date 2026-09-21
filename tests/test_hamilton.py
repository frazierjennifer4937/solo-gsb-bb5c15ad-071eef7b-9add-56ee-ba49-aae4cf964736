"""Hamilton 核心逻辑的单元测试，可用 `python -m pytest tests/` 运行。"""

from fractions import Fraction

from app.hamilton import exact_decimal, fraction_str, hamilton_allocate, scan_range


def seats_of(populations, seats):
    return [row["seats"] for row in hamilton_allocate(populations, seats)["rows"]]


def test_builtin_example_paradox():
    # 内置示例：人口 44/43/7/6，总席位 10 -> 11 时丁区（索引 3）由 1 席降为 0 席
    allocations, paradoxes = scan_range([44, 43, 7, 6], 8, 14)
    assert len(paradoxes) == 1
    p = paradoxes[0]
    assert (p["from_seats"], p["to_seats"]) == (10, 11)
    assert p["losers"] == [{"index": 3, "before": 1, "after": 0}]
    assert [r["seats"] for r in allocations[10]["rows"]] == [4, 4, 1, 1]
    assert [r["seats"] for r in allocations[11]["rows"]] == [5, 5, 1, 0]


def test_classic_minimal_paradox():
    # 经典最小例子：人口 6/6/2，总席位 3 -> 4 时丙由 1 席降为 0 席
    assert seats_of([6, 6, 2], 3) == [1, 1, 1]
    assert seats_of([6, 6, 2], 4) == [2, 2, 0]
    _, paradoxes = scan_range([6, 6, 2], 3, 4)
    assert paradoxes[0]["losers"] == [{"index": 2, "before": 1, "after": 0}]


def test_tie_break_by_population():
    # 余数同为 1/2：人口 3 的地区优先于人口 1 的地区
    assert seats_of([6, 3, 1], 5) == [3, 2, 0]


def test_tie_break_by_input_order():
    # 余数与人口都相同：录入顺序较早者优先
    assert seats_of([3, 2, 2], 2) == [1, 1, 0]


def test_quota_and_remainder_are_exact_fractions():
    result = hamilton_allocate([44, 43, 7, 6], 10)
    rows = result["rows"]
    assert rows[0]["quota"] == Fraction(22, 5)
    assert rows[0]["remainder"] == Fraction(2, 5)
    assert rows[2]["remainder"] == Fraction(7, 10)
    assert result["remaining_seats"] == 2
    # 余数排名：丙(7/10) > 丁(3/5) > 甲(2/5) > 乙(3/10)
    assert [r["remainder_rank"] for r in rows] == [3, 4, 1, 2]


def test_seat_conservation():
    for s in range(1, 60):
        assert sum(seats_of([44, 43, 7, 6], s)) == s


def test_exact_decimal():
    assert exact_decimal(Fraction(1, 3)) == "0.333333"
    assert exact_decimal(Fraction(2, 7)) == "0.285714"
    assert exact_decimal(Fraction(1, 2)) == "0.5"
    assert exact_decimal(Fraction(22, 5)) == "4.4"
    assert exact_decimal(Fraction(121, 25)) == "4.84"
    assert exact_decimal(Fraction(4, 1)) == "4"


def test_fraction_str():
    assert fraction_str(Fraction(22, 5)) == "22/5"
    assert fraction_str(Fraction(4, 1)) == "4"
