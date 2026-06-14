import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE   = 'https://tiles.openfreemap.org/styles/bright';
const EMPTY   = { type: 'FeatureCollection', features: [] };
const R_EARTH = 6371000;

/* ── 지구 기하 ── */
function calcBearing(srcLat, srcLng, dstLat, dstLng) {
  const dl = (dstLng - srcLng) * Math.PI / 180;
  const φ1 = srcLat * Math.PI / 180, φ2 = dstLat * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function makeArc(lng, lat, radiusM, bearingDeg, halfSpread = 45, steps = 28) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const b = (bearingDeg - halfSpread + (2 * halfSpread * i / steps)) * Math.PI / 180;
    const dlat = (radiusM / R_EARTH) * Math.cos(b) * (180 / Math.PI);
    const dlng = (radiusM / R_EARTH) * Math.sin(b) / Math.cos(lat * Math.PI / 180) * (180 / Math.PI);
    coords.push([lng + dlng, lat + dlat]);
  }
  return coords;
}

function getPolyCentroid(feature) {
  try {
    const ring = feature.geometry.coordinates[0];
    const n = ring.length - 1;
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
    return [x / n, y / n];
  } catch { return null; }
}

function makeCircle(lng, lat, r, steps = 64) {
  const coords = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return [
      lng + (r / R_EARTH) * (180 / Math.PI) * Math.sin(a) / Math.cos(lat * Math.PI / 180),
      lat + (r / R_EARTH) * (180 / Math.PI) * Math.cos(a),
    ];
  });
  return { type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }] };
}

function haversineM(lng1, lat1, lng2, lat2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ════════════════════════════════════════════
 * 캔버스에 방음벽 라인 그리기
 * segments: [[lng,lat],[lng,lat]][]
 * preview:  { x1,y1,x2,y2 } | null  (드래그 중 미리보기, 화면 픽셀)
 * ════════════════════════════════════════════ */
function drawBarriersOnCanvas(canvas, map, segments, preview) {
  if (!canvas || !map) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // lng/lat → 캔버스 픽셀 (map.project 사용)
  const proj = ([lng, lat]) => { const p = map.project([lng, lat]); return [p.x, p.y]; };

  // ── 영구 방음벽 라인들 ──
  for (const seg of (segments || [])) {
    const [p1, p2] = seg.map(proj);
    const [x1, y1] = p1, [x2, y2] = p2;

    // 외곽 흰 테두리
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.setLineDash([]);
    ctx.stroke();

    // 파란 실선
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#0068C3';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.stroke();

    // 시작점 원
    ctx.beginPath(); ctx.arc(x1, y1, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.strokeStyle = '#0068C3'; ctx.lineWidth = 2.5; ctx.stroke();

    // 끝점 원
    ctx.beginPath(); ctx.arc(x2, y2, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#0068C3'; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();

    // 거리 + 높이 라벨 (d₁/d₂ 표기 위치 — 선 중간)
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dist = haversineM(seg[0][0], seg[0][1], seg[1][0], seg[1][1]);
    const distLabel = dist >= 1000 ? `${(dist/1000).toFixed(2)}km` : `${Math.round(dist)}m`;
    const label = `방음벽 ${distLabel}`;
    ctx.font = 'bold 11px Arial, sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,60,140,0.88)';
    ctx.fillRect(mx - tw/2 - 7, my - 22, tw + 14, 18);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my - 13);
  }

  // ── 드래그 미리보기 ──
  if (preview) {
    const { x1, y1, x2, y2, s, d } = preview;

    // 흰 테두리
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 점선 파란 실선
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#0099FF';
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 시작점
    ctx.beginPath(); ctx.arc(x1, y1, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.strokeStyle = '#0068C3'; ctx.lineWidth = 3; ctx.stroke();

    // 끝점
    ctx.beginPath(); ctx.arc(x2, y2, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0099FF'; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2.5; ctx.stroke();

    // 거리 라벨
    if (s && d) {
      const dist = haversineM(s[0], s[1], d[0], d[1]);
      const label = dist >= 1000 ? `${(dist/1000).toFixed(2)} km` : `${Math.round(dist)} m`;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 18;
      ctx.font = 'bold 12px Arial, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,60,140,0.88)';
      ctx.fillRect(mx - tw/2 - 8, my - 12, tw + 16, 18);
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my - 3);
    }
  }
}

/* ════════════════════════════════════════════
 * 컴포넌트
 * ════════════════════════════════════════════ */
export default function MapLibre3D({
  sourceLocation,
  barrierCoords,
  buildingGeoJSON,
  drawMode,
  barrierHeight = 3,
  flyToLocation,
  selectedBuilding,
  onSourceSet,
  onBarrierComplete,
  onBuildingSelect,
}) {
  const containerRef  = useRef(null);
  const overlayRef    = useRef(null);
  const drawCanvasRef = useRef(null);
  const mapRef        = useRef(null);
  const loadedRef     = useRef(false);
  const pendingRef    = useRef({});
  const animRef       = useRef(null);

  // 항상 최신값 참조용 refs
  const barrierCoordsRef   = useRef(barrierCoords || []);
  const previewRef         = useRef(null);    // 드래그 중 미리보기 상태
  const sourceMarkerRef    = useRef(null);    // HTML 소음원 마커
  const onBarrierCompleteRef = useRef(onBarrierComplete);
  const onSourceSetRef       = useRef(onSourceSet);
  const onBuildingSelectRef  = useRef(onBuildingSelect);

  useEffect(() => { barrierCoordsRef.current = barrierCoords || []; }, [barrierCoords]);
  useEffect(() => { onBarrierCompleteRef.current = onBarrierComplete; }, [onBarrierComplete]);
  useEffect(() => { onSourceSetRef.current       = onSourceSet; },       [onSourceSet]);
  useEffect(() => { onBuildingSelectRef.current  = onBuildingSelect; },  [onBuildingSelect]);

  const setSource = useCallback((id, data) => {
    if (!loadedRef.current) { pendingRef.current[id] = data; return; }
    mapRef.current?.getSource(id)?.setData(data);
  }, []);

  // 캔버스 재렌더링 (지도 이동/줌/방음벽 변경 시 호출)
  const redrawCanvas = useCallback(() => {
    drawBarriersOnCanvas(drawCanvasRef.current, mapRef.current, barrierCoordsRef.current, previewRef.current);
  }, []);

  /* ══════════════════════════════════════════
   * 지도 초기화
   * ══════════════════════════════════════════ */
  useEffect(() => {
    if (mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [126.978, 37.5665],
      zoom: 15, pitch: 50, antialias: true,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    // 지도 이동/줌할 때마다 방음벽 캔버스 재렌더
    map.on('move',   () => redrawCanvas());
    map.on('zoom',   () => redrawCanvas());
    map.on('rotate', () => redrawCanvas());
    map.on('pitch',  () => redrawCanvas());

    map.on('load', () => {
      /* 동심 호 파장 */
      map.addSource('noise-arcs', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'noise-arcs-glow', type: 'line', source: 'noise-arcs',
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'glowWidth'],
          'line-opacity': ['get', 'glowOpacity'], 'line-blur': 4 } });
      map.addLayer({ id: 'noise-arcs-line', type: 'line', source: 'noise-arcs',
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'lineWidth'],
          'line-opacity': ['get', 'lineOpacity'], 'line-cap': 'round' } });

      /* 건물 */
      map.addSource('noise-buildings', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'noise-buildings-3d', type: 'fill-extrusion', source: 'noise-buildings',
        paint: {
          'fill-extrusion-color': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
            ['coalesce', ['get', 'color'], '#FA5B0F'], '#78909C'],
          'fill-extrusion-height': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
            ['+', ['coalesce', ['get', 'height'], 9],
              ['*', ['max', ['-', ['coalesce', ['get', 'max_noise_db'], 0], 65], 0], 2]],
            ['coalesce', ['get', 'height'], 9]],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1], 0.92, 0.3],
        },
      });
      map.addLayer({ id: 'noise-label', type: 'symbol', source: 'noise-buildings',
        filter: ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
        layout: {
          'text-field': ['concat', ['to-string', ['round', ['get', 'max_noise_db']]], 'dB'],
          'text-size': 13, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center', 'text-allow-overlap': false, 'text-offset': [0, -1],
        },
        paint: { 'text-color': ['coalesce', ['get', 'color'], '#FA5B0F'],
          'text-halo-color': 'rgba(255,255,255,0.96)', 'text-halo-width': 2.5 },
      });

      /* 소음원 마커 */
      map.addSource('source-loc', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'source-halo', type: 'circle', source: 'source-loc',
        paint: { 'circle-radius': 22, 'circle-color': '#FA5B0F', 'circle-opacity': 0.15,
          'circle-stroke-color': '#FA5B0F', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.5 } });
      map.addLayer({ id: 'source-circle', type: 'circle', source: 'source-loc',
        paint: { 'circle-radius': 12, 'circle-color': '#FA5B0F',
          'circle-stroke-color': 'white', 'circle-stroke-width': 3 } });
      map.addLayer({ id: 'source-label', type: 'symbol', source: 'source-loc',
        layout: { 'text-field': '🔊', 'text-size': 16, 'text-anchor': 'center', 'text-allow-overlap': true } });

      /* 탐색 반경 */
      map.addSource('radius-ring', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-ring',
        paint: { 'fill-color': '#FA5B0F', 'fill-opacity': 0.04 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius-ring',
        paint: { 'line-color': '#FA5B0F', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.5 } });

      /* 선택된 건물 하이라이트 — noise-buildings-3d 위에 추가 */
      map.addSource('selected-building', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'selected-building-fill', type: 'fill-extrusion', source: 'selected-building',
        paint: {
          'fill-extrusion-color': '#FBBC04',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
        },
      });
      map.addLayer({
        id: 'selected-building-outline', type: 'line', source: 'selected-building',
        paint: { 'line-color': '#FA5B0F', 'line-width': 5, 'line-opacity': 1 },
      });

      /* 클릭 이벤트 */
      map.on('click', 'noise-buildings-3d', (e) => {
        if (e.features?.length) onBuildingSelectRef.current?.(e.features[0].properties);
      });
      map.on('mouseenter', 'noise-buildings-3d', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'noise-buildings-3d', () => { map.getCanvas().style.cursor = 'grab'; });
      map.on('click', (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['noise-buildings-3d'] });
        if (hit.length > 0) return;
        onSourceSetRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      });

      loadedRef.current = true;
      for (const [id, data] of Object.entries(pendingRef.current)) map.getSource(id)?.setData(data);
      pendingRef.current = {};
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [redrawCanvas]);

  /* ══════════════════════════════════════════
   * 방음벽 그리기 모드
   * ══════════════════════════════════════════ */
  useEffect(() => {
    const overlay   = overlayRef.current;
    const container = containerRef.current;
    if (!overlay || !container) return;

    if (drawMode !== 'barrier') {
      overlay.style.pointerEvents   = 'none';
      overlay.style.cursor          = 'default';
      container.style.pointerEvents = '';
      const map = mapRef.current;
      if (map) { map.dragPan.enable(); map.dragRotate.enable(); }
      previewRef.current = null;
      redrawCanvas();
      return;
    }

    container.style.pointerEvents = 'none';
    overlay.style.pointerEvents   = 'all';
    overlay.style.cursor          = 'crosshair';

    const map = mapRef.current;
    if (map) { map.dragPan.disable(); map.dragRotate.disable(); }

    let startPx = null;

    const unproject = (cx, cy) => {
      const m = mapRef.current;
      if (!m) return null;
      const rect = overlay.getBoundingClientRect();
      const ll = m.unproject([cx - rect.left, cy - rect.top]);
      return [ll.lng, ll.lat];
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startPx = { x: e.clientX, y: e.clientY };
    };

    const onMove = (e) => {
      if (!startPx) return;
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const s = unproject(startPx.x, startPx.y);
      const d = unproject(e.clientX, e.clientY);
      previewRef.current = {
        x1: startPx.x - rect.left, y1: startPx.y - rect.top,
        x2: e.clientX  - rect.left, y2: e.clientY  - rect.top,
        s, d,
      };
      redrawCanvas();
    };

    const onUp = (e) => {
      if (!startPx) return;
      const sp = startPx;
      startPx = null;
      previewRef.current = null;
      const s = unproject(sp.x, sp.y);
      const d = unproject(e.clientX, e.clientY);
      if (s && d && Math.hypot(s[0] - d[0], s[1] - d[1]) > 0.000001) {
        onBarrierCompleteRef.current?.([s, d]);
      }
      redrawCanvas();
    };

    overlay.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);

    return () => {
      overlay.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      container.style.pointerEvents = '';
      overlay.style.pointerEvents   = 'none';
      overlay.style.cursor          = 'default';
      if (mapRef.current) { mapRef.current.dragPan.enable(); mapRef.current.dragRotate.enable(); }
      previewRef.current = null;
      redrawCanvas();
    };
  }, [drawMode, redrawCanvas]);

  /* ── barrierCoords 변경 시 캔버스 재렌더 ── */
  useEffect(() => {
    barrierCoordsRef.current = barrierCoords || [];
    redrawCanvas();
  }, [barrierCoords, barrierHeight, redrawCanvas]);

  /* ── 소음원 위치 (HTML 마커 — 항상 최상단) ── */
  useEffect(() => {
    // 이전 마커 제거
    sourceMarkerRef.current?.remove();
    sourceMarkerRef.current = null;

    if (!sourceLocation) {
      setSource('source-loc', EMPTY);
      setSource('radius-ring', EMPTY);
      return;
    }

    const { lng, lat, radius = 300 } = sourceLocation;

    // GeoJSON 레이어도 유지 (반경 링 등)
    setSource('source-loc', EMPTY); // 기존 circle 레이어는 비움 (HTML 마커로 대체)
    setSource('radius-ring', makeCircle(lng, lat, radius));

    // 애니메이션 주입 (한 번만)
    if (!document.getElementById('source-marker-style')) {
      const s = document.createElement('style');
      s.id = 'source-marker-style';
      s.textContent = `
        @keyframes srcPulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          80%  { transform: scale(3);   opacity: 0; }
          100% { transform: scale(3);   opacity: 0; }
        }
      `;
      document.head.appendChild(s);
    }

    // HTML 마커 — 빨간 점 + 펄스 링
    const el = document.createElement('div');
    el.style.cssText = `
      position: relative;
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      cursor: default;
    `;
    el.innerHTML = `
      <div style="
        position: absolute; inset: 0; border-radius: 50%;
        background: rgba(234,67,53,0.25);
        animation: srcPulse 1.8s ease-out infinite;
      "></div>
      <div style="
        width: 14px; height: 14px; border-radius: 50%;
        background: #EA4335;
        border: 2.5px solid white;
        box-shadow: 0 0 0 1.5px #EA4335, 0 2px 6px rgba(234,67,53,0.6);
        position: relative; z-index: 1;
      "></div>
    `;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);
    sourceMarkerRef.current = marker;

    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, pitch: 50, duration: 600 });
  }, [sourceLocation, setSource]);

  /* ── 동심 호 애니메이션 ── */
  useEffect(() => {
    cancelAnimationFrame(animRef.current);
    if (!sourceLocation || !buildingGeoJSON?.features?.length) {
      setSource('noise-arcs', EMPTY);
      return;
    }
    const { lng, lat } = sourceLocation;
    const bears = buildingGeoJSON.features
      .filter(f => f.properties?.exceeds_65db === 1)
      .map(f => {
        const c = getPolyCentroid(f);
        return c ? { bearing: calcBearing(lat, lng, c[1], c[0]), color: f.properties.color || '#FA5B0F' } : null;
      }).filter(Boolean);

    if (!bears.length) { setSource('noise-arcs', EMPTY); return; }

    const MAX_R = 280, PERIOD = 2200, N_RINGS = 4;
    let t = 0, last = null;
    const animate = (ts) => {
      if (!loadedRef.current || !mapRef.current) return;
      if (last !== null) t += ts - last;
      last = ts;
      const features = [];
      bears.forEach(({ bearing, color }) => {
        for (let ring = 0; ring < N_RINGS; ring++) {
          const phase      = ((t / PERIOD) + ring / N_RINGS) % 1;
          const radius     = phase * MAX_R;
          const lineOpacity = Math.sin(phase * Math.PI) * 0.85;
          const glowOpacity = Math.sin(phase * Math.PI) * 0.25;
          const lineWidth   = 2.5 - phase * 1.5;
          const glowWidth   = 10  - phase * 6;
          if (radius < 2) continue;
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: makeArc(lng, lat, radius, bearing) },
            properties: { color, lineOpacity, glowOpacity, lineWidth, glowWidth },
          });
        }
      });
      mapRef.current.getSource('noise-arcs')?.setData({ type: 'FeatureCollection', features });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [sourceLocation, buildingGeoJSON, setSource]);

  /* ── 주소 이동 ── */
  useEffect(() => {
    if (!flyToLocation) return;
    mapRef.current?.flyTo({ center: [flyToLocation.lng, flyToLocation.lat],
      zoom: flyToLocation.zoom ?? 16, pitch: 50, duration: 800 });
  }, [flyToLocation]);

  /* ── 건물 GeoJSON ── */
  useEffect(() => {
    setSource('noise-buildings', buildingGeoJSON || EMPTY);
  }, [buildingGeoJSON, setSource]);

  /* ── 선택된 건물 하이라이트 + 카메라 이동 ── */
  useEffect(() => {
    if (!selectedBuilding || !buildingGeoJSON) {
      setSource('selected-building', EMPTY);
      return;
    }
    const feature = buildingGeoJSON.features.find(
      (f) => String(f.properties.id) === String(selectedBuilding.id)
    );
    if (!feature) { setSource('selected-building', EMPTY); return; }

    setSource('selected-building', { type: 'FeatureCollection', features: [feature] });

    // centroid: 결과 객체 우선, 없으면 feature properties
    const clng = selectedBuilding.centroid_lng ?? feature.properties.centroid_lng;
    const clat = selectedBuilding.centroid_lat ?? feature.properties.centroid_lat;
    if (clng && clat && mapRef.current) {
      mapRef.current.flyTo({
        center: [clng, clat],
        zoom: 18,
        pitch: 60,
        bearing: 0,
        duration: 700,
      });
    }
  }, [selectedBuilding, buildingGeoJSON, setSource]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* 방음벽 그리기 이벤트 수신 오버레이 */}
      <div ref={overlayRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none', zIndex: 3, background: 'transparent', userSelect: 'none',
      }} />
      {/* 방음벽 + 미리보기 캔버스 (항상 최상단, 이벤트 무시) */}
      <canvas ref={drawCanvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 4,
      }} />
    </div>
  );
}
