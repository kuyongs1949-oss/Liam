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
  flyToLocation,      // { lng, lat, zoom? } - 주소 검색 결과로 지도 이동
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
  const startCoordRef = useRef(null); // 방음벽 드래그 시작점

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
        id: 'barriers-casing', type: 'line', source: 'barriers',
        paint: { 'line-color': '#BF360C', 'line-width': 10, 'line-cap': 'round', 'line-join': 'round', 'line-opacity': 0.3 },
      });
      map.addLayer({
        id: 'barriers-line', type: 'line', source: 'barriers',
        paint: { 'line-color': '#FF5722', 'line-width': 5, 'line-cap': 'round', 'line-join': 'round' },
      });

      /* 방음벽 그리기 미리보기 */
      map.addSource('barrier-preview', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barrier-preview-line', type: 'line', source: 'barrier-preview',
        paint: { 'line-color': '#FF9800', 'line-width': 4, 'line-dasharray': [5, 2], 'line-opacity': 0.95 },
      });

      /* 소음원 파장 (3개 ring) */
      map.addSource('pulse-ring', { type: 'geojson', data: EMPTY });
      for (let i = 0; i < 3; i++) {
        map.addLayer({
          id: `pulse-ring-${i}`, type: 'circle', source: 'pulse-ring',
          paint: {
            'circle-radius': 10, 'circle-color': 'transparent',
            'circle-stroke-width': 3, 'circle-stroke-color': '#FF5722', 'circle-stroke-opacity': 0,
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
      map.getCanvas().style.cursor = startCoordRef.current ? 'crosshair' : 'grab';
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
      if (drawMode === 'barrier') return;
      onSourceSet?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [drawMode, onSourceSet]);

  /* ── 방음벽 드래그 그리기 ─────────────────────────────
   *  핵심: drawMode === 'barrier' 진입 시 즉시 dragPan 비활성화,
   *  이후 mousedown/mousemove/mouseup 으로 선분 생성
   * ─────────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (drawMode !== 'barrier') {
      // 방음벽 모드 아닐 때: dragPan 복원, 프리뷰 삭제
      map.dragPan.enable();
      map.getCanvas().style.cursor = 'grab';
      startCoordRef.current = null;
      if (loadedRef.current) map.getSource('barrier-preview')?.setData(EMPTY);
      return;
    }

    // 방음벽 모드 진입: 즉시 dragPan 비활성화
    map.dragPan.disable();
    map.getCanvas().style.cursor = 'crosshair';

    const onMouseDown = (e) => {
      startCoordRef.current = [e.lngLat.lng, e.lngLat.lat];
    };

    const onMouseMove = (e) => {
      if (!startCoordRef.current) return;
      const end = [e.lngLat.lng, e.lngLat.lat];
      map.getSource('barrier-preview')?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [startCoordRef.current, end] },
          properties: {},
        }],
      });
    };

    const onMouseUp = (e) => {
      if (!startCoordRef.current) return;
      const start = startCoordRef.current;
      const end   = [e.lngLat.lng, e.lngLat.lat];
      startCoordRef.current = null;
      map.getSource('barrier-preview')?.setData(EMPTY);

      const dist = Math.hypot(start[0] - end[0], start[1] - end[1]);
      if (dist > 0.000005) {
        onBarrierComplete?.([start, end]);
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup',   onMouseUp);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup',   onMouseUp);
      // 모드 해제 시 정리는 다음 effect 실행에서 처리
    };
  }, [drawMode, onBarrierComplete]);

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

  /* ── 주소 검색 결과로 지도 이동 ──────────────────────── */
  useEffect(() => {
    if (!flyToLocation) return;
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [flyToLocation.lng, flyToLocation.lat], zoom: flyToLocation.zoom ?? 16, pitch: 50, duration: 800 });
  }, [flyToLocation]);

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
