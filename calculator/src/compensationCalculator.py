"""
환경부 보상금 산출 모듈
환경분쟁조정위원회 기준 (2024년 기준)
"""

import math
from dataclasses import dataclass
from typing import Optional
from enum import Enum


class NoiseLevel(Enum):
    """소음 등급"""
    SAFE = "safe"           # < 65dB
    LEVEL1 = "level1"       # 65~70dB
    LEVEL2 = "level2"       # 70~75dB
    LEVEL3 = "level3"       # 75~80dB
    LEVEL4 = "level4"       # >= 80dB


# ──────────────────────────────────────────────
# 환경부 소음 보상금 기준표 (환경분쟁조정 기준)
# ──────────────────────────────────────────────
COMPENSATION_STANDARDS = {
    NoiseLevel.SAFE: {
        "range": "65dB 미만",
        "base_monthly": 0,
        "coefficient": 0.0,
        "description": "보상 대상 아님",
    },
    NoiseLevel.LEVEL1: {
        "range": "65~70dB",
        "base_monthly": 300_000,
        "coefficient": 0.5,
        "description": "생활 방해 (경미)",
    },
    NoiseLevel.LEVEL2: {
        "range": "70~75dB",
        "base_monthly": 600_000,
        "coefficient": 1.0,
        "description": "생활 방해 (보통)",
    },
    NoiseLevel.LEVEL3: {
        "range": "75~80dB",
        "base_monthly": 1_000_000,
        "coefficient": 1.5,
        "description": "생활 방해 (심각)",
    },
    NoiseLevel.LEVEL4: {
        "range": "80dB 이상",
        "base_monthly": 1_200_000,
        "coefficient": 2.0,
        "description": "생활 방해 (매우 심각)",
    },
}


@dataclass
class ReceptorInfo:
    """수용자(세대) 정보"""
    receptor_id: str
    name: str
    address: str
    lat: float
    lng: float
    floors: int = 1           # 건물 층수
    households: int = 1       # 세대 수
    noise_db: float = 0.0     # 계산된 소음도 (dB)


@dataclass
class CompensationResult:
    """보상금 계산 결과"""
    receptor_id: str
    name: str
    address: str
    lat: float
    lng: float
    floors: int
    households: int
    noise_db: float
    noise_level: NoiseLevel
    base_monthly: int
    coefficient: float
    suffering_months: float
    total_compensation: float
    per_household_compensation: float
    exceeds_threshold: bool
    level_description: str


class CompensationCalculator:
    """
    환경부 보상금 계산기
    환경분쟁조정위원회 기준 적용
    """

    @staticmethod
    def classify_noise_level(noise_db: float) -> NoiseLevel:
        """소음도 → 등급 분류"""
        if noise_db < 65:
            return NoiseLevel.SAFE
        elif noise_db < 70:
            return NoiseLevel.LEVEL1
        elif noise_db < 75:
            return NoiseLevel.LEVEL2
        elif noise_db < 80:
            return NoiseLevel.LEVEL3
        else:
            return NoiseLevel.LEVEL4

    @staticmethod
    def calculate_per_receptor(
        receptor: ReceptorInfo,
        suffering_months: float,
    ) -> CompensationResult:
        """
        단일 수용자 보상금 계산

        최종보상금 = 기본금액 × 계수 × 고통기간(월) × 세대수
        """
        level = CompensationCalculator.classify_noise_level(receptor.noise_db)
        standard = COMPENSATION_STANDARDS[level]

        base_monthly = standard["base_monthly"]
        coefficient = standard["coefficient"]

        # 세대당 보상금
        per_household = base_monthly * coefficient * suffering_months

        # 전체 세대 보상금
        total = per_household * receptor.households

        return CompensationResult(
            receptor_id=receptor.receptor_id,
            name=receptor.name,
            address=receptor.address,
            lat=receptor.lat,
            lng=receptor.lng,
            floors=receptor.floors,
            households=receptor.households,
            noise_db=receptor.noise_db,
            noise_level=level,
            base_monthly=base_monthly,
            coefficient=coefficient,
            suffering_months=suffering_months,
            total_compensation=round(total),
            per_household_compensation=round(per_household),
            exceeds_threshold=level != NoiseLevel.SAFE,
            level_description=standard["description"],
        )

    @staticmethod
    def get_noise_color(noise_db: float) -> str:
        """소음도에 따른 지도 색상 반환 (파랑→노랑→빨강)"""
        if noise_db < 65:
            return "#2196F3"    # 파랑 (안전)
        elif noise_db < 70:
            return "#4CAF50"    # 초록 (경미)
        elif noise_db < 72:
            return "#FFC107"    # 노랑 (주의)
        elif noise_db < 75:
            return "#FF9800"    # 주황 (경고)
        elif noise_db < 80:
            return "#F44336"    # 빨강 (위험)
        else:
            return "#9C27B0"    # 보라 (매우 위험)

    @staticmethod
    def format_compensation(amount: float) -> str:
        """보상금 포맷팅 (원 단위)"""
        if amount == 0:
            return "해당 없음"
        return f"₩{amount:,.0f}"

    @staticmethod
    def get_standards_table() -> list[dict]:
        """보상금 기준표 반환"""
        return [
            {
                "level": level.value,
                "range": std["range"],
                "base_monthly": std["base_monthly"],
                "coefficient": std["coefficient"],
                "description": std["description"],
                "example_3months": std["base_monthly"] * std["coefficient"] * 3,
            }
            for level, std in COMPENSATION_STANDARDS.items()
            if level != NoiseLevel.SAFE
        ]
