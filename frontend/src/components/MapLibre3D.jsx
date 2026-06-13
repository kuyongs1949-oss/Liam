import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/bright';
const EMPTY = { type: 'FeatureCollection', features: [] };

export default function MapLibre3D({
  sourceLocation,
  barrierCoords,      // [[[lng,lat],[lng,lat]], ...] 각 선분
  buildingGeoJSON,
  drawMode,           // null | 'barrier'
  barrierHeight = 3,
  onSourceSet,
  onBarrierComplete,
  onBuildingSelect,
}) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const loadedRef    = useRef(false);
  const pendingRef   = useRef({});
  const animRef      = useRef(null);
  const pulseRef     = useRef({ t: 0 });
  const drawStateRef = useRef({ active: false, startCoord: null });

  /* setSource 헬퍼 */
  const setSource = useCallback((id, data) => {
    if (!loadedRef.current) { pendingRef.current[id] = data; return; }
    mapRef.current?.getSource(id)?.setData(data);
  }, []);

  /* ── 지도 초기화 (한 번만) ─────────────────────────── */
  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [126.978, 37.5665],
      zoom: 15,
      pitch: 50,
      antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      /* 건물 fill-extrusion */
      map.addSource('noise-buildings', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'noise-buildings-fill',
        type: 'fill-extrusion',
        source: 'noise-buildings',
        paint: {
          'fill-extrusion-color': ['coalesce', ['get', 'color'], '#90A4AE'],
          'fill-extrusion-height': [
            '+',
            ['coalesce', ['get', 'height'], 9],
            ['*', ['max', ['-', ['coalesce', ['get', 'max_noise_db'], 0], 60], 0], 1.5],
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
        },
      });

      /* 건물 소음 레이블 */
      map.addLayer({
        id: 'noise-label',
        type: 'symbol',
        source: 'noise-buildings',
        layout: {
          'text-field': ['case',
            ['>', ['coalesce', ['get', 'max_noise_db'], 0], 0],
            ['concat', ['to-string', ['round', ['get', 'max_noise_db']]], 'dB'],
            ''],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#37474F'],
          'text-halo-color': 'rgba(255,255,255,0.95)',
          'text-halo-width': 2,
        },
      });

      /* 방음벽 확정선 */
      map.addSource('barriers', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barriers-casing',
        type: 'line', source: 'barriers',
        paint: { 'line-color': '#BF360C', 'line-width': 10, 'line-cap': 'round', 'line-join': 'round', 'line-opacity': 0.3 },
      });
      map.addLayer({
        id: 'barriers-line',
        type: 'line', source: 'barriers',
        paint: { 'line-color': '#FF5722', 'line-width': 5, 'line-cap': 'round', 'line-join': 'round' },
      });

      /* 방음벽 그리기 미리보기 */
      map.addSource('barrier-preview', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barrier-preview-line',
        type: 'line', source: 'barrier-preview',
        paint: { 'line-color': '#FF9800', 'line-width': 3, 'line-dasharray': [5, 2], 'line-opacity': 0.9 },
      });

      /* 소음원 파장 (3개 ring) */
      map.addSource('pulse-ring', { type: 'geojson', data: EMPTY });
      for (let i = 0; i < 3; i++) {
        map.addLayer({
          id: `pulse-ring-${i}`,
          type: 'circle', source: 'pulse-ring',
          paint: {
            'circle-radius': 10,
            'circle-color': 'transparent',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#FF5722',
            'circle-stroke-opacity': 0,
          },
        });
      }

      /* 소음원 마커 */
      map.addSource('source-loc', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'source-halo', type: 'circle', source: 'source-loc',
        paint: { 'circle-radius': 20, 'circle-color': '#FF5722', 'circle-opacity': 0.15,
          'circle-stroke-color': '#FF5722', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.4 },
      });
      map.addLayer({
        id: 'source-circle', type: 'circle', source: 'source-loc',
        paint: { 'circle-radius': 12, 'circle-color': '#FF5722', 'circle-stroke-color': 'white', 'circle-stroke-width': 3 },
      });
      map.addLayer({
        id: 'source-label', type: 'symbol', source: 'source-loc',
        layout: { 'text-field': '🔊', 'text-size': 16, 'text-anchor': 'center', 'text-allow-overlap': true },
      });

      /* 탐색 반경 */
      map.addSource('radius-ring', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-ring',
        paint: { 'fill-color': '#FF5722', 'fill-opacity': 0.04 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius-ring',
        paint: { 'line-color': '#FF5722', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.5 } });

      loadedRef.current = true;
      for (const [id, data] of Object.entries(pendingRef.current)) {
        map.getSource(id)?.setData(data);
      }
      pendingRef.current = {};
    });

    /* 건물 클릭 */
    map.on('click', 'noise-buildings-fill', (e) => {
      onBuildingSelect?.(e.features[0]?.properties);
    });
    map.on('mouseenter', 'noise-buildings-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'noise-buildings-fill', () => {
      map.getCanvas().style.cursor = drawStateRef.current.active ? 'crosshair' : 'grab';
    });

    mapRef.current = map;
    return () => {
      cancelAnimationFrame(animRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  /* ── 소음원 클릭 핸들러 ──────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e) => {
      if (drawStateRef.current.active) return; // 방음벽 그리기 중 무시
      if (drawMode === null || drawMode === 'source') {
        onSourceSet?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [drawMode, onSourceSet]);

  /* ── 방음벽 그리기: 캔버스 DOM 이벤트 ───────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = map.getCanvas();

    const toLngLat = (e) => {
      const rect = canvas.getBoundingClientRect();
      const point = new maplibregl.Point(
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
      return map.unproject(point);
    };

    const onMouseDown = (e) => {
      if (drawMode !== 'barrier') return;
      e.preventDefault();
      const ll = toLngLat(e);
      drawStateRef.current = { active: true, startCoord: [ll.lng, ll.lat] };
      map.dragPan.disable();
      canvas.style.cursor = 'crosshair';
    };

    const onMouseMove = (e) => {
      if (!drawStateRef.current.active) return;
      const ll = toLngLat(e);
      const end = [ll.lng, ll.lat];
      map.getSource('barrier-preview')?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [drawStateRef.current.startCoord, end] },
          properties: {},
        }],
      });
    };

    const onMouseUp = (e) => {
      if (!drawStateRef.current.active) return;
      const ll = toLngLat(e);
      const end = [ll.lng, ll.lat];
      const { startCoord } = drawStateRef.current;

      drawStateRef.current = { active: false, startCoord: null };
      map.dragPan.enable();
      canvas.style.cursor = drawMode === 'barrier' ? 'crosshair' : 'grab';
      map.getSource('barrier-preview')?.setData(EMPTY);

      const dist = Math.hypot(startCoord[0] - end[0], startCoord[1] - end[1]);
      if (dist > 0.000005) {
        onBarrierComplete?.([startCoord, end]);
      }
    };

    const onMouseLeave = () => {
      if (drawStateRef.current.active) {
        drawStateRef.current = { active: false, startCoord: null };
        map.dragPan.enable();
        map.getSource('barrier-preview')?.setData(EMPTY);
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup',   onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      map.dragPan.enable();
      drawStateRef.current = { active: false, startCoord: null };
    };
  }, [drawMode, onBarrierComplete]);

  /* ── 커서 ────────────────────────────────────────────── */
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = drawMode === 'barrier' ? 'crosshair' : 'grab';
    }
  }, [drawMode]);

  /* ── 소음원 위치 + 파장 애니메이션 ──────────────────── */
  useEffect(() => {
    cancelAnimationFrame(animRef.current);

    if (!sourceLocation) {
      setSource('source-loc', EMPTY);
      setSource('radius-ring', EMPTY);
      setSource('pulse-ring', EMPTY);
      return;
    }

    const { lng, lat, radius = 300 } = sourceLocation;
    setSource('source-loc', {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }],
    });
    setSource('radius-ring', makeCircle(lng, lat, radius));
    setSource('pulse-ring', {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }],
    });

    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, pitch: 50, duration: 600 });

    const PERIOD = 2000;
    const OFFSETS = [0, 667, 1333];
    let lastTs = null;

    const animate = (ts) => {
      if (!loadedRef.current || !mapRef.current) return;
      if (!lastTs) lastTs = ts;
      pulseRef.current.t += ts - lastTs;
      lastTs = ts;

      OFFSETS.forEach((offset, i) => {
        const phase = ((pulseRef.current.t + offset) % PERIOD) / PERIOD;
        mapRef.current?.setPaintProperty(`pulse-ring-${i}`, 'circle-radius', 10 + phase * 80);
        mapRef.current?.setPaintProperty(`pulse-ring-${i}`, 'circle-stroke-opacity', (1 - phase) * 0.8);
      });

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [sourceLocation, setSource]);

  /* ── 방음벽 렌더링 ────────────────────────────────────── */
  useEffect(() => {
    if (!barrierCoords || barrierCoords.length === 0) {
      setSource('barriers', EMPTY);
      return;
    }
    setSource('barriers', {
      type: 'FeatureCollection',
      features: barrierCoords.map((seg) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: seg },
        properties: { height: barrierHeight },
      })),
    });
  }, [barrierCoords, barrierHeight, setSource]);

  /* ── 건물 GeoJSON ─────────────────────────────────────── */
  useEffect(() => {
    setSource('noise-buildings', buildingGeoJSON || EMPTY);
  }, [buildingGeoJSON, setSource]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function makeCircle(lng, lat, r, steps = 64) {
  const R = 6371000;
  const coords = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return [
      lng + (r / R) * (180 / Math.PI) * Math.sin(a) / Math.cos(lat * Math.PI / 180),
      lat + (r / R) * (180 / Math.PI) * Math.cos(a),
    ];
  });
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }],
  };
}
