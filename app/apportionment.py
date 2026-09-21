"""Exact Hamilton apportionment calculations.

All quantities are either Python integers or :class:`fractions.Fraction`.
In particular, remainder ordering never uses floating-point values.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from fractions import Fraction
from typing import Sequence

MAX_REGIONS = 100
MAX_HOUSE_SIZE = 1_000_000
MAX_SCAN_SPAN = 500
MAX_POPULATION = 10**18


@dataclass(frozen=True)
class RegionResult:
    index: int
    name: str
    population: int
    quota: Fraction
    integer_seats: int
    remainder: Fraction
    remainder_rank: int | None
    remainder_tied: bool
    awarded: bool
    seats: int


def _fraction(value: Fraction) -> dict[str, str]:
    return {
        "numerator": str(value.numerator),
        "denominator": str(value.denominator),
    }


def validate_inputs(
    populations: Sequence[int],
    house_start: int,
    house_end: int,
) -> None:
    """Validate shared numeric limits used by the API and by direct callers."""
    region_count = len(populations)
    if region_count < 2:
        raise ValueError("至少需要录入两个地区。")
    if region_count > MAX_REGIONS:
        raise ValueError(f"地区数量不能超过 {MAX_REGIONS} 个。")
    if any(population <= 0 for population in populations):
        raise ValueError("所有地区人口必须为正整数。")
    if any(population > MAX_POPULATION for population in populations):
        raise ValueError(f"单个人口不能超过 {MAX_POPULATION}。")
    if house_start < 1:
        raise ValueError("起始席位数必须为正整数。")
    if house_end < house_start:
        raise ValueError("结束席位数不能小于起始席位数。")
    if house_end > MAX_HOUSE_SIZE:
        raise ValueError(f"席位总数不能超过 {MAX_HOUSE_SIZE}。")
    if house_end - house_start > MAX_SCAN_SPAN:
        raise ValueError(
            f"扫描跨度（结束席位 - 起始席位）不能超过 {MAX_SCAN_SPAN}。"
        )


def hamilton(
    populations: Sequence[int],
    names: Sequence[str],
    total_seats: int,
) -> dict[str, object]:
    """Compute one Hamilton apportionment with exact arithmetic.

    Remainders are ordered by:
      1. greater remainder;
      2. greater population for equal remainders;
      3. earlier input order when remainder and population both tie.

    Fraction comparison is exact; tuple comparisons involving Fraction use
    cross-multiplication internally, with no binary floating-point values.
    """
    if total_seats < 1:
        raise ValueError("席位总数必须为正整数。")
    if len(names) != len(populations):
        raise ValueError("地区名称和人口数量不一致。")

    total_population = sum(populations)
    quotas: list[Fraction] = []
    integer_seats: list[int] = []
    remainders: list[Fraction] = []

    for population in populations:
        quota = Fraction(population * total_seats, total_population)
        integer_part = quota.numerator // quota.denominator
        quotas.append(quota)
        integer_seats.append(integer_part)
        remainders.append(quota - integer_part)

    # Negate within each criterion so ascending order is:
    # greater remainder, greater population, then earlier index.  A single
    # reverse=True would incorrectly mix Fraction and integer magnitudes.
    award_order = sorted(
        range(len(populations)),
        key=lambda i: (-remainders[i], -populations[i], i),
    )
    leftover_seats = total_seats - sum(integer_seats)
    winners = set(award_order[:leftover_seats])
    ranks = {index: rank + 1 for rank, index in enumerate(award_order)}
    remainder_counts = Counter(remainders)
    tied_remainders = {
        remainder
        for remainder, count in remainder_counts.items()
        if count > 1
    }

    results: list[RegionResult] = []
    for i, (population, name) in enumerate(zip(populations, names)):
        awarded = i in winners
        results.append(
            RegionResult(
                index=i,
                name=name,
                population=population,
                quota=quotas[i],
                integer_seats=integer_seats[i],
                remainder=remainders[i],
                remainder_rank=ranks[i],
                remainder_tied=remainders[i] in tied_remainders,
                awarded=awarded,
                seats=integer_seats[i] + (1 if awarded else 0),
            )
        )

    return {
        "totalSeats": str(total_seats),
        "totalPopulation": str(total_population),
        "leftoverSeats": str(leftover_seats),
        "awardOrder": [str(index) for index in award_order],
        "regions": [
            {
                "index": region.index,
                "name": region.name,
                "population": str(region.population),
                "quota": _fraction(region.quota),
                "integerSeats": str(region.integer_seats),
                "remainder": _fraction(region.remainder),
                "remainderRank": region.remainder_rank,
                "remainderTied": region.remainder_tied,
                "awarded": region.awarded,
                "seats": str(region.seats),
            }
            for region in results
        ],
    }


def scan(
    populations: Sequence[int],
    names: Sequence[str],
    house_start: int,
    house_end: int,
) -> dict[str, object]:
    """Scan consecutive house sizes and mark Alabama paradox transitions."""
    validate_inputs(populations, house_start, house_end)

    allocations = [
        hamilton(populations, names, seats)
        for seats in range(house_start, house_end + 1)
    ]
    paradoxes: list[dict[str, object]] = []

    for previous, current in zip(allocations, allocations[1:]):
        previous_regions = previous["regions"]
        current_regions = current["regions"]
        changes = []
        losing_indexes = []

        for before, after in zip(previous_regions, current_regions):
            before_seats = int(before["seats"])
            after_seats = int(after["seats"])
            change = after_seats - before_seats
            changes.append(str(change))
            if after_seats < before_seats:
                losing_indexes.append(before["index"])

        if losing_indexes:
            paradoxes.append(
                {
                    "fromSeats": previous["totalSeats"],
                    "toSeats": current["totalSeats"],
                    "changes": changes,
                    "losingIndexes": losing_indexes,
                    "before": previous,
                    "after": current,
                }
            )

    return {
        "houseStart": str(house_start),
        "houseEnd": str(house_end),
        "scanSpan": str(house_end - house_start),
        "allocationCount": str(len(allocations)),
        "paradoxCount": str(len(paradoxes)),
        "allocations": allocations,
        "paradoxes": paradoxes,
    }
