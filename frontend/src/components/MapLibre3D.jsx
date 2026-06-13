import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE  = 'https://tiles.openfreemap.org/styles/bright';
const EMPTY  = { type: 'FeatureCollection', features: [] };

/* ── 지구 기하 헬퍼 ── */
const R_EARTH = 6371000; // m

/** 소음원→건물 방위각(도, 0=북) */
function calcBearing(srcLat, srcLng, dstLat, dstLng) {
  const dl  = (dstLng - srcLng) * Math.PI / 180;
  const φ1  = srcLat * Math.PI / 180;
  const φ2  = dstLat * Math.PI / 180;
  const y   = Math.sin(dl) * Math.cos(φ2);
  const x   = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** 반경 r(m), 중심방위각, 반각폭(deg) 으로 arc LineString 좌표 생성 */
function makeArc(lng, lat, radiusM, bearingDeg, halfSpread = 40, steps = 28) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const b   = (bearingDeg - halfSpread + (2 * halfSpread * i / steps)) * Math.PI / 180;
    const dlat = (radiusM / R_EARTH) * Math.cos(b) * (180 / Math.PI);
    const dlng = (radiusM / R_EARTH) * Math.sin(b) / Math.cos(lat * Math.PI / 180) * (180 / Math.PI);
    coords.push([lng + dlng, lat + dlat]);
  }
  return coords;
}

/** 폴리곤 무게중심 */
function getPolyCentroid(feature) {
  try {
    const ring = feature.geometry.coordinates[0];
    const n = ring.length - 1;
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
    return [x / n, y / n];
  } catch { return null; }
}

/* ── 컴포넌트 ── */
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
  const containerRef   = useRef(null);
  const overlayRef     = useRef(null);
  const mapRef         = useRef(null);
  const loadedRef      = useRef(false);
  const pendingRef     = useRef({});
  const animRef        = useRef(null);
  const startPxRef     = useRef(null);

  // 애니메이션용 refs (클로저 stale 방지)
  const srcRef          = useRef(null);          // { lng, lat }
  const buildBearsRef   = useRef([]);            // [{ bearing, color }]
  const pulseRef        = useRef({ t: 0, last: null });

  const drawModeRef          = useRef(drawMode);
  const onBarrierCompleteRef = useRef(onBarrierComplete);
  const onSourceSetRef       = useRef(onSourceSet);
  const onBuildingSelectRef  = useRef(onBuildingSelect);

  useEffect(() => { drawModeRef.current          = drawMode; },          [drawMode]);
  useEffect(() => { onBarrierCompleteRef.current = onBarrierComplete; }, [onBarrierComplete]);
  useEffect(() => { onSourceSetRef.current       = onSourceSet; },       [onSourceSet]);
  useEffect(() => { onBuildingSelectRef.current  = onBuildingSelect; },  [onBuildingSelect]);

  const setSource = useCallback((id, data) => {
    if (!loadedRef.current) { pendingRef.current[id] = data; return; }
    mapRef.current?.getSource(id)?.setData(data);
  }, []);

  /* ══════════════════════════════════════════
   * 방음벽 오버레이 이벤트 (1회 등록)
   * ══════════════════════════════════════════ */
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const unproject = (cx, cy) => {
      const map = mapRef.current;
      if (!map) return null;
      const rect = overlay.getBoundingClientRect();
      const ll   = map.unproject([cx - rect.left, cy - rect.top]);
      return [ll.lng, ll.lat];
    };
    const onDown = (e) => {
      if (drawModeRef.current !== 'barrier') return;
      e.preventDefault();
      startPxRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e) => {
      if (!startPxRef.current || !mapRef.current || !loadedRef.current) return;
      const s = unproject(startPxRef.current.x, startPxRef.current.y);
      const d = unproject(e.clientX, e.clientY);
      if (!s || !d) return;
      mapRef.current.getSource('barrier-preview')?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [s, d] }, properties: {} }],
      });
    };
    const onUp = (e) => {
      if (!startPxRef.current) return;
      const sp = startPxRef.current;
      startPxRef.current = null;
      if (mapRef.current && loadedRef.current) mapRef.current.getSource('barrier-preview')?.setData(EMPTY);
      const s = unproject(sp.x, sp.y);
      const d = unproject(e.clientX, e.clientY);
      if (!s || !d) return;
      if (Math.hypot(s[0] - d[0], s[1] - d[1]) > 0.000001) onBarrierCompleteRef.current?.([s, d]);
    };

    overlay.addEventListener('mousedown', onDown);
    overlay.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      overlay.removeEventListener('mousedown', onDown);
      overlay.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* ── dragPan 토글 ── */
  useEffect(() => {
    const ov = overlayRef.current;
    if (ov) {
      ov.style.pointerEvents = drawMode === 'barrier' ? 'all' : 'none';
      ov.style.cursor = drawMode === 'barrier' ? 'crosshair' : 'default';
    }
    const map = mapRef.current;
    if (!map) return;
    if (drawMode === 'barrier') {
      map.dragPan.disable(); map.dragRotate.disable();
    } else {
      map.dragPan.enable(); map.dragRotate.enable();
      startPxRef.current = null;
      if (loadedRef.current) map.getSource('barrier-preview')?.setData(EMPTY);
    }
  }, [drawMode]);

  /* ══════════════════════════════════════════
   * 지도 초기화 (1회)
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

      /* ── 동심 호 파장 ── */
      map.addSource('noise-arcs', { type: 'geojson', data: EMPTY });
      // 글로우 (두껍고 흐릿)
      map.addLayer({ id: 'noise-arcs-glow', type: 'line', source: 'noise-arcs',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'glowWidth'],
          'line-opacity': ['get', 'glowOpacity'],
          'line-blur': 4,
        },
      });
      // 선명한 호
      map.addLayer({ id: 'noise-arcs-line', type: 'line', source: 'noise-arcs',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'lineWidth'],
          'line-opacity': ['get', 'lineOpacity'],
          'line-cap': 'round',
        },
      });

      /* ── 건물 ── */
      map.addSource('noise-buildings', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'noise-buildings-3d', type: 'fill-extrusion', source: 'noise-buildings',
        paint: {
          'fill-extrusion-color': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
            ['coalesce', ['get', 'color'], '#FF9800'], '#B0BEC5'],
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
      map.addLayer({
        id: 'noise-label', type: 'symbol', source: 'noise-buildings',
        filter: ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
        layout: {
          'text-field': ['concat', ['to-string', ['round', ['get', 'max_noise_db']]], 'dB'],
          'text-size': 13, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center', 'text-allow-overlap': false, 'text-offset': [0, -1],
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#E65100'],
          'text-halo-color': 'rgba(255,255,255,0.98)', 'text-halo-width': 2.5,
        },
      });

      /* ── 방음벽 ── */
      map.addSource('barriers', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'barriers-casing', type: 'line', source: 'barriers',
        paint: { 'line-color': '#BF360C', 'line-width': 10, 'line-cap': 'round', 'line-join': 'round', 'line-opacity': 0.3 } });
      map.addLayer({ id: 'barriers-line', type: 'line', source: 'barriers',
        paint: { 'line-color': '#FF5722', 'line-width': 5, 'line-cap': 'round', 'line-join': 'round' } });

      map.addSource('barrier-preview', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'barrier-preview-line', type: 'line', source: 'barrier-preview',
        paint: { 'line-color': '#FF9800', 'line-width': 4, 'line-dasharray': [4, 2], 'line-opacity': 0.95 } });

      /* ── 소음원 마커 ── */
      map.addSource('source-loc', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'source-halo', type: 'circle', source: 'source-loc',
        paint: { 'circle-radius': 22, 'circle-color': '#FF5722', 'circle-opacity': 0.18,
          'circle-stroke-color': '#FF5722', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.5 } });
      map.addLayer({ id: 'source-circle', type: 'circle', source: 'source-loc',
        paint: { 'circle-radius': 13, 'circle-color': '#FF5722', 'circle-stroke-color': 'white', 'circle-stroke-width': 3 } });
      map.addLayer({ id: 'source-label', type: 'symbol', source: 'source-loc',
        layout: { 'text-field': '🔊', 'text-size': 16, 'text-anchor': 'center', 'text-allow-overlap': true } });

      /* ── 탐색 반경 ── */
      map.addSource('radius-ring', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-ring',
        paint: { 'fill-color': '#FF5722', 'fill-opacity': 0.04 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius-ring',
        paint: { 'line-color': '#FF5722', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.5 } });

      /* ── 건물 클릭/커서 ── */
      map.on('click', 'noise-buildings-3d', (e) => {
        if (e.features?.length) onBuildingSelectRef.current?.(e.features[0].properties);
      });
      map.on('mouseenter', 'noise-buildings-3d', () => {
        if (drawModeRef.current !== 'barrier') map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'noise-buildings-3d', () => {
        if (drawModeRef.current !== 'barrier') map.getCanvas().style.cursor = 'grab';
      });
      map.on('click', (e) => {
        if (drawModeRef.current === 'barrier') return;
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

  /* ── 소음원 위치 업데이트 ── */
  useEffect(() => {
    if (!sourceLocation) {
      srcRef.current = null;
      setSource('source-loc', EMPTY);
      setSource('radius-ring', EMPTY);
      return;
    }
    const { lng, lat, radius = 300 } = sourceLocation;
    srcRef.current = { lng, lat };
    setSource('source-loc', { type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }] });
    setSource('radius-ring', makeCircle(lng, lat, radius));
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, pitch: 50, duration: 600 });
  }, [sourceLocation, setSource]);

  /* ── 동심 호 파장 애니메이션 ─────────────────────────────
   * sourceLocation 또는 buildingGeoJSON 변경 시 방위각 재계산
   * requestAnimationFrame 으로 반경을 키우며 arc 를 setData
   * ────────────────────────────────────────────────────── */
  useEffect(() => {
    cancelAnimationFrame(animRef.current);

    if (!sourceLocation || !buildingGeoJSON?.features?.length) {
      setSource('noise-arcs', EMPTY);
      buildBearsRef.current = [];
      return;
    }

    const { lng, lat } = sourceLocation;

    // 65dB 초과 건물의 방위각 + 색상 계산
    const bears = buildingGeoJSON.features
      .filter(f => f.properties?.exceeds_65db === 1)
      .map(f => {
        const c = getPolyCentroid(f);
        if (!c) return null;
        const bearing = calcBearing(lat, lng, c[1], c[0]);
        return { bearing, color: f.properties.color || '#FF9800' };
      })
      .filter(Boolean);

    buildBearsRef.current = bears;

    if (!bears.length) {
      setSource('noise-arcs', EMPTY);
      return;
    }

    const MAX_R   = 280;   // 최대 반경 (m)
    const PERIOD  = 2200;  // 주기 (ms)
    const N_RINGS = 4;     // 동시 표시 호 수
    pulseRef.current = { t: 0, last: null };

    const animate = (ts) => {
      if (!loadedRef.current || !mapRef.current) return;

      const p = pulseRef.current;
      if (p.last !== null) p.t += ts - p.last;
      p.last = ts;

      const features = [];

      bears.forEach(({ bearing, color }) => {
        for (let ring = 0; ring < N_RINGS; ring++) {
          // 각 링은 1/N_RINGS 위상 차이
          const phase = ((p.t / PERIOD) + ring / N_RINGS) % 1;
          const radius    = phase * MAX_R;
          const lineOpacity  = Math.sin(phase * Math.PI) * 0.85;  // 부드럽게 fade
          const glowOpacity  = Math.sin(phase * Math.PI) * 0.25;
          const lineWidth    = 2.5 - phase * 1.5;  // 커질수록 가늘어짐
          const glowWidth    = 10 - phase * 6;

          if (radius < 2) continue; // 너무 작으면 스킵

          const coords = makeArc(lng, lat, radius, bearing, 45);
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: { color, lineOpacity, glowOpacity, lineWidth, glowWidth },
          });
        }
      });

      mapRef.current.getSource('noise-arcs')?.setData({
        type: 'FeatureCollection', features,
      });

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
      features: barrierCoords.map((seg) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: seg },
        properties: { height: barrierHeight },
      })),
    });
  }, [barrierCoords, barrierHeight, setSource]);

  /* ── 주소 검색 이동 ── */
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
      <div ref={overlayRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none', cursor: 'crosshair', zIndex: 2,
        background: 'transparent', userSelect: 'none',
      }} />
    </div>
  );
}

/* ── 탐색 반경 원 ── */
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
