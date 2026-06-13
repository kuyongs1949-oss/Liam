"""
다중 수용자 병렬 계산 모듈
ThreadPoolExecutor 8 workers 기반 병렬 처리
"""

import math
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

from .noiseCalculator import NoiseCalculator, Equipment, BarrierSpec
from .compensationCalculator import (
    CompensationCalculator,
    CompensationResult,
    ReceptorInfo,
)

logger = logging.getLogger(__name__)

MAX_WORKERS = 8  # 병렬 처리 워커 수


def _calculate_single_receptor(
    args: tuple,
) -> dict:
    """
    단일 수용자 계산 (Worker 함수)
    ThreadPoolExecutor에 의해 병렬 실행됨
    """
    (
        receptor_data,
        lw_total,
        source_lat,
        source_lng,
        barrier,
        suffering_months,
        ground_factor,
    ) = args

    try:
        receptor = ReceptorInfo(**receptor_data)

        # ISO 9613-2 소음도 계산
        noise_result = NoiseCalculator.iso9613_full_calculate(
            lw_total=lw_total,
            source_x=source_lng,
            source_y=source_lat,
            receiver_x=receptor.lng,
            receiver_y=receptor.lat,
            barrier=barrier,
            ground_factor=ground_factor,
        )

        receptor.noise_db = noise_result["L_receiver"]

        # 보상금 계산
        compensation = CompensationCalculator.calculate_per_receptor(
            receptor=receptor,
            suffering_months=suffering_months,
        )

        return {
            "success": True,
            "receptor_id": receptor.receptor_id,
            "noise_db": noise_result["L_receiver"],
            "distance": noise_result["distance"],
            "exceeds_65db": noise_result["L_receiver"] > 65,
            "noise_breakdown": {
                "A_div": noise_result["A_div"],
                "A_atmospheric": noise_result["A_atmospheric"],
                "A_ground": noise_result["A_ground"],
                "A_barrier": noise_result["A_barrier"],
            },
            "compensation": {
                "noise_level": compensation.noise_level.value,
                "level_description": compensation.level_description,
                "base_monthly": compensation.base_monthly,
                "coefficient": compensation.coefficient,
                "per_household": compensation.per_household_compensation,
                "total": compensation.total_compensation,
                "households": compensation.households,
            },
            "map": {
                "lat": receptor.lat,
                "lng": receptor.lng,
                "color": CompensationCalculator.get_noise_color(noise_result["L_receiver"]),
                "name": receptor.name,
                "address": receptor.address,
                "floors": receptor.floors,
            },
        }

    except Exception as e:
        logger.error(f"Receptor {receptor_data.get('receptor_id')} 계산 오류: {e}")
        return {
            "success": False,
            "receptor_id": receptor_data.get("receptor_id"),
            "error": str(e),
        }


class MultiReceptorCalculator:
    """
    다중 수용자 병렬 계산기
    8개 워커로 동시 처리
    """

    def __init__(self, workers: int = MAX_WORKERS):
        self.workers = workers

    def calculate_all(
        self,
        equipments: list[dict],
        source_lat: float,
        source_lng: float,
        receptors: list[dict],
        barrier_config: Optional[dict] = None,
        suffering_months: float = 3.0,
        ground_factor: float = 0.5,
        filter_65db: bool = True,
    ) -> dict:
        """
        전체 수용자 병렬 계산

        Parameters:
            equipments: [{"equipment_id": "excavator", "count": 2}, ...]
            source_lat, source_lng: 소음원 위치
            receptors: 수용자 목록 [{"receptor_id": "r1", "name": "...", ...}, ...]
            barrier_config: 방음벽 설정 (None이면 방음벽 없음)
            suffering_months: 고통 기간 (월)
            filter_65db: True면 65dB 초과 세대만 반환
            ground_factor: 지면 반사 계수

        Returns:
            계산 결과 딕셔너리
        """
        start_time = time.time()

        # 장비 합산 음향파워레벨
        equipment_objs = [
            Equipment(equipment_id=eq["equipment_id"], count=eq.get("count", 1))
            for eq in equipments
            if eq["equipment_id"] in [e.equipment_id for e in [Equipment(eq["equipment_id"])]]
            or True  # validation은 Equipment 클래스에서
        ]

        # 실제 장비 객체 생성 (유효한 것만)
        valid_equipments = []
        for eq in equipments:
            try:
                valid_equipments.append(
                    Equipment(equipment_id=eq["equipment_id"], count=eq.get("count", 1))
                )
            except Exception as e:
                logger.warning(f"장비 {eq.get('equipment_id')} 오류: {e}")

        lw_total = NoiseCalculator.combine_equipment(valid_equipments)

        # 방음벽 객체 생성
        barrier = None
        if barrier_config and barrier_config.get("height", 0) > 0:
            barrier = BarrierSpec(
                height=barrier_config["height"],
                material_loss=barrier_config.get("material_loss", 10.0),
                d1=barrier_config.get("d1", 10.0),
                d2=barrier_config.get("d2", 10.0),
                source_height=barrier_config.get("source_height", 1.5),
                receiver_height=barrier_config.get("receiver_height", 1.5),
            )

        # 병렬 계산 인수 준비
        calc_args = [
            (
                receptor,
                lw_total,
                source_lat,
                source_lng,
                barrier,
                suffering_months,
                ground_factor,
            )
            for receptor in receptors
        ]

        results = []
        errors = []

        # ThreadPoolExecutor로 병렬 처리
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = {
                executor.submit(_calculate_single_receptor, args): args[0].get("receptor_id")
                for args in calc_args
            }

            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    results.append(result)
                else:
                    errors.append(result)

        # 65dB 초과 필터링
        all_results = sorted(results, key=lambda x: x["noise_db"], reverse=True)
        filtered = [r for r in all_results if r["exceeds_65db"]] if filter_65db else all_results

        # 통계
        total_compensation = sum(r["compensation"]["total"] for r in filtered)
        elapsed = time.time() - start_time

        return {
            "summary": {
                "lw_total": round(lw_total, 1),
                "total_receptors": len(receptors),
                "exceeds_65db_count": len([r for r in all_results if r["exceeds_65db"]]),
                "filtered_count": len(filtered),
                "total_compensation": round(total_compensation),
                "calculation_time_ms": round(elapsed * 1000, 1),
                "workers_used": self.workers,
            },
            "equipments": [
                {
                    "id": eq.equipment_id,
                    "name": eq.name,
                    "count": eq.count,
                    "lw": round(eq.combined_lw, 1),
                }
                for eq in valid_equipments
            ],
            "results": filtered,
            "errors": errors,
        }
