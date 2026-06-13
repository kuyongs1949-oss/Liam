"""
지도 시각화 모듈 - GeoJSON 생성
Leaflet 지도에 사용할 GeoJSON 데이터 생성
"""

import json
from typing import Optional
from .compensationCalculator import CompensationCalculator


class MapVisualizer:
    """GeoJSON 기반 지도 데이터 생성기"""

    @staticmethod
    def results_to_geojson(
        results: list[dict],
        source_lat: float,
        source_lng: float,
        source_name: str = "건설현장",
    ) -> dict:
        """
        계산 결과를 GeoJSON FeatureCollection으로 변환

        Returns:
            Leaflet에서 사용 가능한 GeoJSON 객체
        """
        features = []

        # 소음원 마커
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [source_lng, source_lat],
            },
            "properties": {
                "type": "source",
                "name": source_name,
                "icon": "construction",
                "color": "#FF5722",
                "popup": f"<b>🏗️ {source_name}</b><br>소음 발생 지점",
            },
        })

        # 수용자 마커
        for result in results:
            noise_db = result["noise_db"]
            comp = result["compensation"]
            map_info = result["map"]

            color = CompensationCalculator.get_noise_color(noise_db)
            exceeds = result["exceeds_65db"]

            # 팝업 HTML
            popup_html = f"""
<div style="min-width:200px">
  <b>{map_info['name']}</b><br>
  <small>{map_info['address']}</small><hr>
  <table style="width:100%;font-size:12px">
    <tr><td>소음도</td><td><b style="color:{color}">{noise_db:.1f} dB</b></td></tr>
    <tr><td>층수</td><td>{map_info['floors']}층</td></tr>
    <tr><td>세대수</td><td>{comp['households']}세대</td></tr>
    <tr><td>등급</td><td>{comp['level_description']}</td></tr>
    <tr><td>세대당 보상금</td><td>₩{comp['per_household']:,.0f}</td></tr>
    <tr><td><b>총 보상금</b></td><td><b>₩{comp['total']:,.0f}</b></td></tr>
  </table>
</div>
""".strip()

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [map_info["lng"], map_info["lat"]],
                },
                "properties": {
                    "type": "receptor",
                    "receptor_id": result["receptor_id"],
                    "name": map_info["name"],
                    "address": map_info["address"],
                    "floors": map_info["floors"],
                    "noise_db": noise_db,
                    "color": color,
                    "exceeds_65db": exceeds,
                    "total_compensation": comp["total"],
                    "per_household": comp["per_household"],
                    "households": comp["households"],
                    "noise_level": comp["noise_level"],
                    "popup": popup_html,
                    "radius": MapVisualizer._get_circle_radius(noise_db),
                },
            })

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "total_features": len(features),
                "receptor_count": len(results),
                "source_location": {"lat": source_lat, "lng": source_lng},
            },
        }

    @staticmethod
    def create_noise_contours(
        source_lat: float,
        source_lng: float,
        lw_total: float,
        levels: list[float] = [65, 70, 75, 80],
    ) -> dict:
        """
        소음 등치선 (Isoline) GeoJSON 생성
        원형 근사로 각 dB 레벨별 영향 반경 계산

        L_receiver ≈ L_w - 20×log10(r) - 11
        → r = 10^((L_w - L - 11) / 20)
        """
        features = []
        colors = ["#FFC107", "#FF9800", "#F44336", "#9C27B0"]
        labels = ["65dB", "70dB", "75dB", "80dB"]

        for level, color, label in zip(levels, colors, labels):
            radius_m = 10 ** ((lw_total - level - 11) / 20)
            if radius_m > 5000:
                continue  # 5km 초과 등치선 제외

            # 원형 GeoJSON Polygon 생성 (36각형 근사)
            coords = []
            for i in range(37):
                angle = math.radians(i * 10)
                dlat = (radius_m / 111320) * math.cos(angle)
                dlng = (radius_m / (111320 * math.cos(math.radians(source_lat)))) * math.sin(angle)
                coords.append([source_lng + dlng, source_lat + dlat])

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords],
                },
                "properties": {
                    "type": "contour",
                    "noise_level": level,
                    "radius_m": round(radius_m),
                    "color": color,
                    "label": label,
                    "fill_opacity": 0.1,
                },
            })

        return {"type": "FeatureCollection", "features": features}

    @staticmethod
    def _get_circle_radius(noise_db: float) -> int:
        """소음도에 따른 마커 크기"""
        if noise_db < 65:
            return 8
        elif noise_db < 70:
            return 10
        elif noise_db < 75:
            return 13
        elif noise_db < 80:
            return 16
        else:
            return 20


import math  # 파일 하단 import (create_noise_contours에서 사용)
