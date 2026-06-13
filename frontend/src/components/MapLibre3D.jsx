import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE  = 'https://tiles.openfreemap.org/styles/bright';
const EMPTY  = { type: 'FeatureCollection', features: [] };
const R_EARTH = 6371000;

// 펜 커서 SVG (data URI)
const PEN_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z' fill='%2300D4FF' stroke='%23003344' stroke-width='0.5'/%3E%3Cpath d='M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' fill='%2300D4FF' stroke='%23003344' stroke-width='0.5'/%3E%3C/svg%3E") 0 24, crosshair`;

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
  onSourceSet,
  onBarrierComplete,
  onBuildingSelect,
}) {
  const containerRef = useRef(null);
  const overlayRef   = useRef(null);
  const mapRef       = useRef(null);
  const loadedRef    = useRef(false);
  const pendingRef   = useRef({});
  const animRef      = useRef(null);

  // 콜백 refs (항상 최신 유지)
  const onBarrierCompleteRef = useRef(onBarrierComplete);
  const onSourceSetRef       = useRef(onSourceSet);
  const onBuildingSelectRef  = useRef(onBuildingSelect);
  useEffect(() => { onBarrierCompleteRef.current = onBarrierComplete; }, [onBarrierComplete]);
  useEffect(() => { onSourceSetRef.current       = onSourceSet; },       [onSourceSet]);
  useEffect(() => { onBuildingSelectRef.current  = onBuildingSelect; },  [onBuildingSelect]);

  const setSource = useCallback((id, data) => {
    if (!loadedRef.current) { pendingRef.current[id] = data; return; }
    mapRef.current?.getSource(id)?.setData(data);
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
            ['coalesce', ['get', 'color'], '#FF6B35'], '#546E7A'],
          'fill-extrusion-height': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
            ['+', ['coalesce', ['get', 'height'], 9],
              ['*', ['max', ['-', ['coalesce', ['get', 'max_noise_db'], 0], 65], 0], 2]],
            ['coalesce', ['get', 'height'], 9]],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1], 0.95, 0.35],
        },
      });
      map.addLayer({ id: 'noise-label', type: 'symbol', source: 'noise-buildings',
        filter: ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
        layout: {
          'text-field': ['concat', ['to-string', ['round', ['get', 'max_noise_db']]], 'dB'],
          'text-size': 13, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center', 'text-allow-overlap': false, 'text-offset': [0, -1],
        },
        paint: { 'text-color': ['coalesce', ['get', 'color'], '#FF6B35'],
          'text-halo-color': 'rgba(255,255,255,0.96)', 'text-halo-width': 2.5 },
      });

      /* 방음벽 */
      map.addSource('barriers', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'barriers-casing', type: 'line', source: 'barriers',
        paint: { 'line-color': '#FF6B35', 'line-width': 12, 'line-cap': 'round', 'line-opacity': 0.25 } });
      map.addLayer({ id: 'barriers-line', type: 'line', source: 'barriers',
        paint: { 'line-color': '#FF6B35', 'line-width': 5, 'line-cap': 'round',
          'line-dasharray': [1, 0] } });
      map.addLayer({ id: 'barriers-glow', type: 'line', source: 'barriers',
        paint: { 'line-color': '#FFB300', 'line-width': 2, 'line-cap': 'round',
          'line-blur': 3, 'line-opacity': 0.7 } });

      map.addSource('barrier-preview', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'barrier-preview-line', type: 'line', source: 'barrier-preview',
        paint: { 'line-color': '#00D4FF', 'line-width': 3,
          'line-dasharray': [6, 3], 'line-opacity': 0.9 } });

      /* 소음원 마커 */
      map.addSource('source-loc', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'source-halo', type: 'circle', source: 'source-loc',
        paint: { 'circle-radius': 22, 'circle-color': '#FF6B35', 'circle-opacity': 0.15,
          'circle-stroke-color': '#FF6B35', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.5 } });
      map.addLayer({ id: 'source-circle', type: 'circle', source: 'source-loc',
        paint: { 'circle-radius': 12, 'circle-color': '#FF6B35',
          'circle-stroke-color': 'white', 'circle-stroke-width': 3 } });
      map.addLayer({ id: 'source-label', type: 'symbol', source: 'source-loc',
        layout: { 'text-field': '🔊', 'text-size': 16, 'text-anchor': 'center', 'text-allow-overlap': true } });

      /* 탐색 반경 */
      map.addSource('radius-ring', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-ring',
        paint: { 'fill-color': '#FF6B35', 'fill-opacity': 0.04 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius-ring',
        paint: { 'line-color': '#FF6B35', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.5 } });

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
  }, []);

  /* ══════════════════════════════════════════
   * 방음벽 그리기 — drawMode가 변할 때마다 등록/해제
   * ══════════════════════════════════════════ */
  useEffect(() => {
    const overlay = overlayRef.current;
    const map     = mapRef.current;
    if (!overlay) return;

    if (drawMode !== 'barrier') {
      // 방음벽 모드 해제
      overlay.style.pointerEvents = 'none';
      overlay.style.cursor = 'default';
      if (map) {
        map.dragPan.enable();
        map.dragRotate.enable();
        if (loadedRef.current) map.getSource('barrier-preview')?.setData(EMPTY);
      }
      return;
    }

    // ── 방음벽 모드 진입 ──
    overlay.style.pointerEvents = 'all';
    overlay.style.cursor = PEN_CURSOR;
    if (map) { map.dragPan.disable(); map.dragRotate.disable(); }

    let startPx = null;  // 로컬 변수로 관리 (ref 불필요)

    const unproject = (cx, cy) => {
      if (!mapRef.current) return null;
      const rect = overlay.getBoundingClientRect();
      const ll   = mapRef.current.unproject([cx - rect.left, cy - rect.top]);
      return [ll.lng, ll.lat];
    };

    const onDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      startPx = { x: e.clientX, y: e.clientY };
    };

    const onMove = (e) => {
      if (!startPx || !loadedRef.current) return;
      const s = unproject(startPx.x, startPx.y);
      const d = unproject(e.clientX, e.clientY);
      if (!s || !d) return;
      mapRef.current?.getSource('barrier-preview')?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [s, d] }, properties: {} }],
      });
    };

    const onUp = (e) => {
      if (!startPx) return;
      const sp = startPx;
      startPx = null;
      if (loadedRef.current) mapRef.current?.getSource('barrier-preview')?.setData(EMPTY);
      const s = unproject(sp.x, sp.y);
      const d = unproject(e.clientX, e.clientY);
      if (!s || !d) return;
      if (Math.hypot(s[0] - d[0], s[1] - d[1]) > 0.000001) {
        onBarrierCompleteRef.current?.([s, d]);
      }
    };

    // overlay에만 mousedown, 나머지는 document (드래그가 영역 밖으로 나가도 동작)
    overlay.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',  onUp);

    return () => {
      overlay.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',  onUp);
      // 모드 이탈 시 정리
      overlay.style.pointerEvents = 'none';
      overlay.style.cursor = 'default';
      startPx = null;
      if (mapRef.current) {
        mapRef.current.dragPan.enable();
        mapRef.current.dragRotate.enable();
        if (loadedRef.current) mapRef.current.getSource('barrier-preview')?.setData(EMPTY);
      }
    };
  }, [drawMode]);   // drawMode가 변할 때마다 재등록

  /* ── 소음원 위치 ── */
  useEffect(() => {
    if (!sourceLocation) {
      setSource('source-loc', EMPTY);
      setSource('radius-ring', EMPTY);
      return;
    }
    const { lng, lat, radius = 300 } = sourceLocation;
    setSource('source-loc', { type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }] });
    setSource('radius-ring', makeCircle(lng, lat, radius));
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
        return c ? { bearing: calcBearing(lat, lng, c[1], c[0]), color: f.properties.color || '#FF6B35' } : null;
      })
      .filter(Boolean);

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

  /* ── 방음벽 렌더링 ── */
  useEffect(() => {
    if (!barrierCoords?.length) { setSource('barriers', EMPTY); return; }
    setSource('barriers', {
      type: 'FeatureCollection',
      features: barrierCoords.map(seg => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: seg },
        properties: { height: barrierHeight },
      })),
    });
  }, [barrierCoords, barrierHeight, setSource]);

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* 방음벽 그리기 오버레이 — pointerEvents는 JS로 제어 */}
      <div
        ref={overlayRef}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',   // 초기값; drawMode effect가 변경
          zIndex: 3,
          background: 'transparent',
          userSelect: 'none',
        }}
      />
    </div>
  );
}
