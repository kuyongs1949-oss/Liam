"""
소음 계산 모듈 - ISO 9613-2 기준
건설현장 소음영향 평가를 위한 핵심 계산 로직
"""

import math
from dataclasses import dataclass, field
from typing import Optional


# ──────────────────────────────────────────────
# 장비별 음향파워레벨 (dB(A)) - ISO 6395 기준
# ──────────────────────────────────────────────
EQUIPMENT_SOUND_POWER = {
    "dozer": {
        "name": "불도저",
        "Lw": 113,
        "description": "불도저 (D6 급)",
    },
    "excavator": {
        "name": "굴삭기",
        "Lw": 108,
        "description": "굴삭기 (0.5m³ 급)",
    },
    "pump_car": {
        "name": "펌프카",
        "Lw": 105,
        "description": "콘크리트 펌프카",
    },
    "crane": {
        "name": "크레인",
        "Lw": 102,
        "description": "타워크레인",
    },
    "concrete_mixer": {
        "name": "콘크리트믹서",
        "Lw": 107,
        "description": "레미콘 차량",
    },
    "compactor": {
        "name": "다짐기",
        "Lw": 111,
        "description": "진동롤러",
    },
    "pile_driver": {
        "name": "항타기",
        "Lw": 118,
        "description": "디젤 항타기",
    },
    "air_compressor": {
        "name": "에어컴프레서",
        "Lw": 103,
        "description": "이동식 에어컴프레서",
    },
    "generator": {
        "name": "발전기",
        "Lw": 101,
        "description": "이동식 발전기",
    },
    "jackhammer": {
        "name": "잭해머",
        "Lw": 115,
        "description": "전기 잭해머",
    },
}


@dataclass
class Equipment:
    """장비 정보"""
    equipment_id: str
    count: int = 1

    @property
    def unit_lw(self) -> float:
        return EQUIPMENT_SOUND_POWER[self.equipment_id]["Lw"]

    @property
    def combined_lw(self) -> float:
        """다수 장비의 음향파워레벨 합산 (에너지 합산)"""
        if self.count <= 0:
            return 0
        return self.unit_lw + 10 * math.log10(self.count)

    @property
    def name(self) -> str:
        return EQUIPMENT_SOUND_POWER[self.equipment_id]["name"]


@dataclass
class BarrierSpec:
    """방음벽 사양"""
    height: float          # 방음벽 높이 (m)
    material_loss: float   # 재료 감쇠 (dB), 일반 방음벽 = 10~15 dB
    d1: float              # 소음원 → 방음벽 거리 (m)
    d2: float              # 방음벽 → 수음점 거리 (m)
    source_height: float = 1.5   # 소음원 높이 (m)
    receiver_height: float = 1.5 # 수음점 높이 (m)


class NoiseCalculator:
    """
    ISO 9613-2 기반 소음 전파 계산기
    """

    @staticmethod
    def combine_equipment(equipments: list[Equipment]) -> float:
        """
        여러 장비의 음향파워레벨 에너지 합산
        L_total = 10 × log10(Σ 10^(Li/10))
        """
        if not equipments:
            return 0.0
        total_power = sum(10 ** (eq.combined_lw / 10) for eq in equipments)
        return 10 * math.log10(total_power)

    @staticmethod
    def geometric_divergence(distance: float) -> float:
        """
        기하학적 발산 감쇠
        A_div = 20×log10(d) + 11  [점음원 구형파 전파]
        """
        if distance <= 0:
            return 0.0
        return 20 * math.log10(distance) + 11

    @staticmethod
    def fresnel_number(barrier: BarrierSpec) -> float:
        """
        Fresnel 수 계산 (ISO 9613-2 방음벽 회절)
        N = 2δ/λ  (λ = 0.25m, 1000Hz 기준)
        δ = 음파 경로차
        """
        d1 = barrier.d1
        d2 = barrier.d2
        h = barrier.height
        hs = barrier.source_height
        hr = barrier.receiver_height

        # 방음벽 상단 경유 경로
        path_over = math.sqrt(d1**2 + (h - hs)**2) + math.sqrt(d2**2 + (h - hr)**2)
        # 직선 경로
        direct_dist = math.sqrt((d1 + d2)**2 + (hs - hr)**2)
        delta = path_over - direct_dist

        wavelength = 0.25  # 1000Hz 기준
        N = 2 * delta / wavelength
        return N

    @staticmethod
    def barrier_insertion_loss(barrier: BarrierSpec) -> float:
        """
        방음벽 삽입손실 계산
        Maekawa 공식 기반 + 재료 감쇠
        IL = 10×log10(3 + 20×N) + A_material  (N > 0)
        """
        N = NoiseCalculator.fresnel_number(barrier)

        if N <= -0.2:
            # 방음벽이 효과 없음 (소음원이 방음벽보다 높음)
            diffraction_loss = 0.0
        elif N < 0:
            diffraction_loss = 0.0
        else:
            diffraction_loss = min(10 * math.log10(3 + 20 * N), 20)  # 최대 20dB

        # 재료 감쇠 (방음벽 투과 차단)
        total_il = diffraction_loss + barrier.material_loss
        return round(total_il, 2)

    @staticmethod
    def atmospheric_absorption(distance: float, frequency: float = 1000) -> float:
        """
        대기 흡수 감쇠 (α, dB/m)
        ISO 9613-1 기반, 표준 대기 조건 (20°C, 70% RH)
        """
        # 1000Hz 기준 α ≈ 0.005 dB/m
        alpha_table = {
            125: 0.0001,
            250: 0.0004,
            500: 0.0015,
            1000: 0.005,
            2000: 0.013,
            4000: 0.031,
        }
        alpha = alpha_table.get(frequency, 0.005)
        return alpha * distance

    @staticmethod
    def quick_calculate(
        lw_total: float,
        d1: float,
        barrier_height: float,
        d2: float,
        barrier_material_loss: float = 10.0,
        source_height: float = 1.5,
        receiver_height: float = 1.5,
    ) -> dict:
        """
        간편 계산 (Quick Mode)
        소음원 → 방음벽 → 수음점 경로 계산

        Parameters:
            lw_total: 합산 음향파워레벨 (dB)
            d1: 소음원→방음벽 거리 (m)
            barrier_height: 방음벽 높이 (m)
            d2: 방음벽→수음점 거리 (m)
            barrier_material_loss: 방음벽 재료 감쇠 (dB)

        Returns:
            계산 결과 딕셔너리
        """
        barrier = BarrierSpec(
            height=barrier_height,
            material_loss=barrier_material_loss,
            d1=d1,
            d2=d2,
            source_height=source_height,
            receiver_height=receiver_height,
        )

        A_d1 = NoiseCalculator.geometric_divergence(d1)
        A_barrier = NoiseCalculator.barrier_insertion_loss(barrier)
        A_d2 = NoiseCalculator.geometric_divergence(d2)
        A_atm = NoiseCalculator.atmospheric_absorption(d1 + d2)

        # 최종 수음점 소음도
        L_receiver = lw_total - A_d1 - A_barrier - A_d2 - A_atm

        return {
            "lw_total": round(lw_total, 1),
            "A_d1": round(A_d1, 2),
            "A_barrier": round(A_barrier, 2),
            "A_d2": round(A_d2, 2),
            "A_atmospheric": round(A_atm, 3),
            "L_receiver": round(L_receiver, 1),
            "fresnel_number": round(NoiseCalculator.fresnel_number(barrier), 3),
            "exceeds_65db": L_receiver > 65,
        }

    @staticmethod
    def iso9613_full_calculate(
        lw_total: float,
        source_x: float,
        source_y: float,
        receiver_x: float,
        receiver_y: float,
        barrier: Optional[BarrierSpec] = None,
        ground_factor: float = 0.5,
    ) -> dict:
        """
        ISO 9613-2 완전 계산 (지도 좌표 기반)
        L_p = L_w + D_c - A_div - A_atm - A_gr - A_bar - A_misc

        Parameters:
            source_x, source_y: 소음원 좌표 (경도, 위도)
            receiver_x, receiver_y: 수음점 좌표
            ground_factor: 지면 반사 계수 (0=하드, 1=소프트)
        """
        # 좌표→거리 변환 (Haversine)
        distance = NoiseCalculator._haversine(
            source_y, source_x, receiver_y, receiver_x
        )
        if distance < 1:
            distance = 1  # 최소 1m

        # 기하학적 발산
        A_div = NoiseCalculator.geometric_divergence(distance)

        # 대기 흡수
        A_atm = NoiseCalculator.atmospheric_absorption(distance)

        # 지면 감쇠 (ISO 9613-2 Annex A)
        A_gr = 4.8 - (2 * 1.5 / distance) * (17 + 300 / distance) * ground_factor
        A_gr = max(0, A_gr)

        # 방음벽 감쇠
        A_bar = 0.0
        if barrier:
            A_bar = NoiseCalculator.barrier_insertion_loss(barrier)

        # 기타 감쇠 (수목, 산업지역 etc.)
        A_misc = 0.0

        # 지향성 보정 (점음원 = 0dB)
        D_c = 0.0

        L_receiver = lw_total + D_c - A_div - A_atm - A_gr - A_bar - A_misc

        return {
            "distance": round(distance, 1),
            "lw_total": round(lw_total, 1),
            "A_div": round(A_div, 2),
            "A_atmospheric": round(A_atm, 3),
            "A_ground": round(A_gr, 2),
            "A_barrier": round(A_bar, 2),
            "L_receiver": round(L_receiver, 1),
            "exceeds_65db": L_receiver > 65,
        }

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """두 좌표 간 거리 계산 (m)"""
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def get_equipment_list() -> list[dict]:
    """등록된 장비 목록 반환"""
    return [
        {"id": k, **v}
        for k, v in EQUIPMENT_SOUND_POWER.items()
    ]
