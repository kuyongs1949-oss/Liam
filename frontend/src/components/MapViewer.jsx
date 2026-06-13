/**
 * Leaflet 지도 시각화 컴포넌트
 * - 소음원 마커
 * - 수용자별 색상 마커 (소음도에 따라 파랑→노랑→빨강)
 * - 건물 층수 표시
 * - 팝업: 소음도 + 보상금
 */

import React, { useEffect, useRef } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useSelector } from 'react-redux';
import L from 'leaflet';

// Leaflet 기본 아이콘 수정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// 소음도별 색상 함수
function getNoiseColor(db) {
  if (db < 65) return '#2196F3';
  if (db < 70) return '#4CAF50';
  if (db < 72) return '#FFC107';
  if (db < 75) return '#FF9800';
  if (db < 80) return '#F44336';
  return '#9C27B0';
}

// 원형 마커 HTML 생성
function createCircleIcon(color, size, label) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:${color}; border:3px solid white;
        border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.4);
        display:flex; align-items:center; justify-content:center;
        color:white; font-size:9px; font-weight:bold;
      ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// 소음원 마커 (건설현장 아이콘)
function createSourceIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:40px; height:40px; background:#FF5722;
        border:3px solid white; border-radius:8px;
        box-shadow:0 3px 10px rgba(0,0,0,0.5);
        display:flex; align-items:center; justify-content:center;
        font-size:20px;
      ">🏗️</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export default function MapViewer() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  const { multiResult } = useSelector((s) => s.calculation);

  // 지도 초기화
  useEffect(() => {
    if (mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapRef.current, {
      center: [37.4855, 127.0475],
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    layerGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 결과 데이터 → 지도 마커 업데이트
  useEffect(() => {
    if (!mapInstanceRef.current || !multiResult) return;

    layerGroupRef.current.clearLayers();

    const { results, summary } = multiResult;
    if (!results || results.length === 0) return;

    const bounds = [];

    // 소음원 마커
    const sourceFeature = multiResult.geojson?.features?.find(
      (f) => f.properties.type === 'source'
    );
    if (sourceFeature) {
      const [lng, lat] = sourceFeature.geometry.coordinates;
      bounds.push([lat, lng]);

      L.marker([lat, lng], { icon: createSourceIcon() })
        .addTo(layerGroupRef.current)
        .bindPopup(`
          <div style="text-align:center">
            <b style="font-size:14px">🏗️ 건설현장</b><br>
            <small>소음 발생 지점</small><br>
            <b>합산 Lw: ${summary?.lw_total} dB</b>
          </div>
        `);
    }

    // 수용자 마커
    results.forEach((result) => {
      const { map: mapInfo, noise_db, compensation, distance } = result;
      if (!mapInfo) return;

      bounds.push([mapInfo.lat, mapInfo.lng]);

      const color = getNoiseColor(noise_db);
      const size = noise_db >= 80 ? 24 : noise_db >= 75 ? 20 : noise_db >= 70 ? 16 : 13;
      const icon = createCircleIcon(color, size, `${noise_db.toFixed(0)}`);

      const popupContent = `
        <div style="min-width:220px; font-family:sans-serif">
          <div style="background:${color}; color:white; padding:8px 12px; margin:-13px -13px 10px; border-radius:4px 4px 0 0">
            <b>${mapInfo.name}</b>
          </div>
          <small style="color:#666">${mapInfo.address}</small>
          <table style="width:100%; margin-top:8px; font-size:12px; border-collapse:collapse">
            <tr><td style="color:#666">소음도</td>
                <td><b style="color:${color}">${noise_db.toFixed(1)} dB(A)</b></td></tr>
            <tr><td style="color:#666">거리</td><td>${distance}m</td></tr>
            <tr><td style="color:#666">층수</td><td>${mapInfo.floors}층</td></tr>
            <tr><td style="color:#666">세대수</td><td>${compensation.households}세대</td></tr>
            <tr><td style="color:#666">등급</td><td>${compensation.level_description}</td></tr>
            <tr style="border-top:1px solid #eee">
              <td style="color:#666">세대당 보상</td>
              <td><b>₩${compensation.per_household.toLocaleString()}</b></td></tr>
            <tr>
              <td style="color:#666"><b>총 보상금</b></td>
              <td><b style="color:#e53935">₩${compensation.total.toLocaleString()}</b></td></tr>
          </table>
        </div>
      `;

      L.marker([mapInfo.lat, mapInfo.lng], { icon })
        .addTo(layerGroupRef.current)
        .bindPopup(popupContent, { maxWidth: 260 });
    });

    // 범례 추가 (처음 한 번)
    if (!mapInstanceRef.current._legendAdded) {
      const legend = L.control({ position: 'bottomright' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'legend');
        div.style.cssText = 'background:white;padding:10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-size:11px;min-width:120px';
        div.innerHTML = `
          <b style="font-size:12px">소음도 범례</b><br>
          ${[
            ['#4CAF50', '65~70 dB'],
            ['#FFC107', '70~72 dB'],
            ['#FF9800', '72~75 dB'],
            ['#F44336', '75~80 dB'],
            ['#9C27B0', '80+ dB'],
          ].map(([c, l]) =>
            `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
              <div style="width:14px;height:14px;border-radius:50%;background:${c};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>
              ${l}
            </div>`
          ).join('')}
        `;
        return div;
      };
      legend.addTo(mapInstanceRef.current);
      mapInstanceRef.current._legendAdded = true;
    }

    // 뷰 맞춤
    if (bounds.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    } else if (bounds.length === 1) {
      mapInstanceRef.current.setView(bounds[0], 15);
    }
  }, [multiResult]);

  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 450 }}>
      {!multiResult && (
        <Paper
          elevation={0}
          sx={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', p: 3, zIndex: 1000,
            background: 'rgba(255,255,255,0.85)', borderRadius: 2,
          }}
        >
          <Typography variant="h4" mb={1}>🗺️</Typography>
          <Typography color="text.secondary" variant="body2">
            다중 세대 계산을 실행하면<br />지도에 결과가 표시됩니다
          </Typography>
        </Paper>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
    </Box>
  );
}
