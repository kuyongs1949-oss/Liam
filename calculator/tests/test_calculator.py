"""
소음 계산기 단위 테스트
pytest tests/test_calculator.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from src.noiseCalculator import NoiseCalculator, Equipment, BarrierSpec, get_equipment_list
from src.compensationCalculator import CompensationCalculator, ReceptorInfo, NoiseLevel
from src.multiReceptorCalculator import MultiReceptorCalculator


class TestEquipment:
    def test_single_equipment_lw(self):
        eq = Equipment("excavator", count=1)
        assert eq.combined_lw == 108.0

    def test_multiple_equipment_energy_sum(self):
        eq = Equipment("excavator", count=2)
        expected = 108 + 10 * pytest.approx(0.301, 0.01)
        assert eq.combined_lw == pytest.approx(111.0, abs=0.5)

    def test_combine_different_equipments(self):
        eqs = [Equipment("excavator", 1), Equipment("dozer", 1)]
        lw = NoiseCalculator.combine_equipment(eqs)
        assert lw > 113  # 가장 큰 값보다 커야 함


class TestNoiseCalculator:
    def test_geometric_divergence_10m(self):
        """10m 거리에서 기하학적 감쇠"""
        a = NoiseCalculator.geometric_divergence(10)
        assert a == pytest.approx(31.0, abs=0.1)

    def test_geometric_divergence_distance_doubling(self):
        """거리 2배 → 6dB 증가"""
        a10 = NoiseCalculator.geometric_divergence(10)
        a20 = NoiseCalculator.geometric_divergence(20)
        assert (a20 - a10) == pytest.approx(6.0, abs=0.1)

    def test_quick_calculate_no_barrier(self):
        """방음벽 없을 때 계산"""
        result = NoiseCalculator.quick_calculate(
            lw_total=108,
            d1=10,
            barrier_height=0,
            d2=50,
        )
        assert "L_receiver" in result
        assert result["L_receiver"] < 108  # 감쇠 후 낮아야 함

    def test_quick_calculate_with_barrier(self):
        """방음벽 있을 때 더 낮아야 함"""
        no_barrier = NoiseCalculator.quick_calculate(108, 10, 0, 50)
        with_barrier = NoiseCalculator.quick_calculate(108, 10, 4, 50)
        assert with_barrier["L_receiver"] < no_barrier["L_receiver"]

    def test_barrier_insertion_loss_positive(self):
        barrier = BarrierSpec(height=4, material_loss=10, d1=5, d2=30)
        il = NoiseCalculator.barrier_insertion_loss(barrier)
        assert il > 0


class TestCompensationCalculator:
    def test_classify_below_65(self):
        assert CompensationCalculator.classify_noise_level(60) == NoiseLevel.SAFE

    def test_classify_level1(self):
        assert CompensationCalculator.classify_noise_level(67) == NoiseLevel.LEVEL1

    def test_classify_level4(self):
        assert CompensationCalculator.classify_noise_level(82) == NoiseLevel.LEVEL4

    def test_compensation_amount_level2(self):
        receptor = ReceptorInfo("r1", "테스트", "서울", 37.5, 127.0, noise_db=72.0, households=10)
        result = CompensationCalculator.calculate_per_receptor(receptor, suffering_months=3)
        # 70~75dB: 600,000 × 1.0 × 3 = 1,800,000 per household
        assert result.per_household_compensation == pytest.approx(1_800_000)
        assert result.total_compensation == pytest.approx(18_000_000)

    def test_no_compensation_below_65(self):
        receptor = ReceptorInfo("r2", "안전", "서울", 37.5, 127.0, noise_db=60.0)
        result = CompensationCalculator.calculate_per_receptor(receptor, 3)
        assert result.total_compensation == 0

    def test_color_coding(self):
        assert CompensationCalculator.get_noise_color(60) == "#2196F3"
        assert CompensationCalculator.get_noise_color(72) != "#2196F3"


class TestMultiReceptorCalculator:
    def test_parallel_calculation(self):
        calc = MultiReceptorCalculator(workers=4)
        result = calc.calculate_all(
            equipments=[{"equipment_id": "excavator", "count": 2}],
            source_lat=37.5665,
            source_lng=126.9780,
            receptors=[
                {
                    "receptor_id": f"r{i}",
                    "name": f"건물{i}",
                    "address": f"서울 {i}번지",
                    "lat": 37.5665 + i * 0.001,
                    "lng": 126.9780 + i * 0.001,
                    "floors": 5,
                    "households": 20,
                    "noise_db": 0,
                }
                for i in range(1, 6)
            ],
            suffering_months=3.0,
            filter_65db=False,
        )
        assert result["summary"]["total_receptors"] == 5
        assert len(result["results"]) > 0

    def test_filter_65db(self):
        calc = MultiReceptorCalculator(workers=2)
        result = calc.calculate_all(
            equipments=[{"equipment_id": "excavator", "count": 1}],
            source_lat=37.5665,
            source_lng=126.9780,
            receptors=[
                {
                    "receptor_id": "far",
                    "name": "먼건물",
                    "address": "서울 먼곳",
                    "lat": 37.5665 + 0.05,   # 약 5km
                    "lng": 126.9780 + 0.05,
                    "floors": 1,
                    "households": 1,
                    "noise_db": 0,
                }
            ],
            filter_65db=True,
        )
        # 멀리 있으면 65dB 미만 → 필터링 됨
        assert result["summary"]["filtered_count"] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
