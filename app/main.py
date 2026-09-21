from __future__ import annotations

from pathlib import Path
import re
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from .apportionment import MAX_REGIONS, scan

app = FastAPI(
    title="最大余数席位分配悖论核查工具",
    description="使用 Hamilton 法精确扫描阿拉巴马悖论。",
    version="1.0.0",
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
POSITIVE_INTEGER = re.compile(r"^[1-9][0-9]*$")


class RegionInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    population: str = Field(..., min_length=1, max_length=19)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("地区名称不能为空。")
        return name

    @field_validator("population")
    @classmethod
    def validate_population(cls, value: str) -> str:
        population_text = value.strip()
        if not POSITIVE_INTEGER.fullmatch(population_text):
            raise ValueError("人口必须为正整数。")
        return population_text


class CalculationRequest(BaseModel):
    regions: list[RegionInput] = Field(..., min_length=2, max_length=MAX_REGIONS)
    house_start: str = Field(..., alias="houseStart", min_length=1, max_length=10)
    house_end: str = Field(..., alias="houseEnd", min_length=1, max_length=10)

    @field_validator("house_start", "house_end")
    @classmethod
    def validate_seat_value(cls, value: str) -> str:
        seat_text = value.strip()
        if not POSITIVE_INTEGER.fullmatch(seat_text):
            raise ValueError("席位值必须为正整数。")
        return seat_text

    model_config = {"populate_by_name": True, "extra": "forbid"}


@app.get("/api/health")
def health() -> dict[str, Literal["ok"]]:
    return {"status": "ok"}


@app.post("/api/calculate")
def calculate(request: CalculationRequest) -> dict[str, object]:
    names = [region.name for region in request.regions]
    populations = [int(region.population) for region in request.regions]
    house_start = int(request.house_start)
    house_end = int(request.house_end)

    try:
        return scan(populations, names, house_start, house_end)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
