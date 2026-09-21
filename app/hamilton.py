"""Hamilton 法（最大余数法）席位分配的精确计算核心。

所有配额与余数均使用 fractions.Fraction 精确分数表示，
余数排名、决胜与席位分配全程不使用浮点数。
"""

from __future__ import annotations

from fractions import Fraction


def exact_decimal(value: Fraction, places: int = 6) -> str:
    """把非负分数四舍五入到 places 位小数（全程整数运算，仅供展示）。"""
    scaled = value.numerator * (10 ** places)
    q, r = divmod(scaled, value.denominator)
    if r * 2 >= value.denominator:
        q += 1
    digits = str(q).rjust(places + 1, "0")
    head, tail = digits[:-places], digits[-places:].rstrip("0")
    return head if not tail else f"{head}.{tail}"


def fraction_str(value: Fraction) -> str:
    """精确分数的字符串形式，分母为 1 时只显示整数。"""
    if value.denominator == 1:
        return str(value.numerator)
    return f"{value.numerator}/{value.denominator}"


def hamilton_allocate(populations: list[int], seats: int) -> dict:
    """对给定人口列表与总席位数，返回 Hamilton 法的完整分配结果。

    返回 {"seats_total", "remaining_seats", "rows"}，每行包含配额、
    整数席位、余数、余数排名、是否获得余数席位与最终席位（Fraction/int）。
    """
    total_population = sum(populations)
    quotas = [Fraction(p * seats, total_population) for p in populations]
    floors = [q.numerator // q.denominator for q in quotas]
    remainders = [q - f for q, f in zip(quotas, floors)]
    remaining = seats - sum(floors)

    # 余数降序；余数相同 -> 人口较多者优先；再相同 -> 录入顺序较早者优先。
    # 排序键只含 Fraction 与 int，绝不引入浮点数。
    order = sorted(
        range(len(populations)),
        key=lambda i: (remainders[i], populations[i], -i),
        reverse=True,
    )
    ranks = [0] * len(populations)
    for rank, idx in enumerate(order, start=1):
        ranks[idx] = rank

    allocation = list(floors)
    awarded = [False] * len(populations)
    for idx in order[:remaining]:
        allocation[idx] += 1
        awarded[idx] = True

    rows = []
    for i, pop in enumerate(populations):
        rows.append(
            {
                "index": i,
                "population": pop,
                "quota": quotas[i],
                "floor": floors[i],
                "remainder": remainders[i],
                "remainder_rank": ranks[i],
                "remainder_awarded": awarded[i],
                "seats": allocation[i],
            }
        )
    return {"seats_total": seats, "remaining_seats": remaining, "rows": rows}


def scan_range(populations: list[int], start: int, end: int) -> tuple[dict, list]:
    """对 [start, end] 内每个总席位数做分配，并扫描阿拉巴马悖论。

    返回 (allocations, paradoxes)：allocations 以总席位数为键；
    paradoxes 记录每次「总席位 +1 后某地区席位反而减少」的事件。
    """
    allocations = {s: hamilton_allocate(populations, s) for s in range(start, end + 1)}
    paradoxes = []
    for s in range(start, end):
        before = allocations[s]["rows"]
        after = allocations[s + 1]["rows"]
        losers = [
            {"index": i, "before": b["seats"], "after": a["seats"]}
            for i, (b, a) in enumerate(zip(before, after))
            if a["seats"] < b["seats"]
        ]
        if losers:
            paradoxes.append({"from_seats": s, "to_seats": s + 1, "losers": losers})
    return allocations, paradoxes
