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
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const pendingRef = useRef({});
  const animRef = useRef(null);
  const pulseRef = useRef({ t: 0 });

  const setSource = useCallback((id, data) => {
    if (!loadedRef.current) { pendingRef.current[id] = data; return; }
    mapRef.current?.getSource(id)?.setData(data);
  }, []);

  /* ── 지도 초기화 ─────────────────────────────────────── */
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
      // ── 건물 fill-extrusion ──
      map.addSource('noise-buildings', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'noise-buildings-fill',
        type: 'fill-extrusion',
        source: 'noise-buildings',
        paint: {
          'fill-extrusion-color': ['coalesce', ['get', 'color'], '#90A4AE'],
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 9],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.88,
        },
      });

      // ── 건물 상단 소음 레이블 ──
      map.addLayer({
        id: 'noise-label',
        type: 'symbol',
        source: 'noise-buildings',
        layout: {
          'text-field': ['case',
            ['!=', ['get', 'max_noise_db'], null],
            ['concat', ['to-string', ['get', 'max_noise_db']], 'dB'],
            '',
          ],
          'text-size': 11,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-offset': [0, 0],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#37474F'],
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 1.5,
        },
      });

      // ── 방음벽 ──
      map.addSource('barriers', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barriers-casing',
        type: 'line',
        source: 'barriers',
        paint: { 'line-color': '#BF360C', 'line-width': 9, 'line-cap': 'round', 'line-join': 'round', 'line-opacity': 0.35 },
      });
      map.addLayer({
        id: 'barriers-line',
        type: 'line',
        source: 'barriers',
        paint: { 'line-color': '#FF5722', 'line-width': 5, 'line-cap': 'round', 'line-join': 'round' },
      });
      // 방음벽 끝점 점
      map.addLayer({
        id: 'barriers-endpoints',
        type: 'circle',
        source: 'barriers',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#FF5722', 'circle-stroke-width': 2, 'circle-stroke-color': 'white' },
      });

      // ── 방음벽 그리기 미리보기 ──
      map.addSource('barrier-preview', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barrier-preview-line',
        type: 'line',
        source: 'barrier-preview',
        paint: { 'line-color': '#FF5722', 'line-width': 3, 'line-dasharray': [4, 2], 'line-opacity': 0.8 },
      });

      // ── 소음원 파장 애니메이션 (3개 원) ──
      map.addSource('pulse-ring', { type: 'geojson', data: EMPTY });
      for (let i = 0; i < 3; i++) {
        map.addLayer({
          id: `pulse-ring-${i}`,
          type: 'circle',
          source: 'pulse-ring',
          paint: {
            'circle-radius': 10,
            'circle-color': 'transparent',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#FF5722',
            'circle-stroke-opacity': 0,
            'circle-opacity': 0,
          },
        });
      }

      // ── 소음원 마커 (중심 점) ──
      map.addSource('source-loc', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'source-halo',
        type: 'circle',
        source: 'source-loc',
        paint: {
          'circle-radius': 20,
          'circle-color': '#FF5722',
          'circle-opacity': 0.15,
          'circle-stroke-color': '#FF5722',
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.4,
        },
      });
      map.addLayer({
        id: 'source-circle',
        type: 'circle',
        source: 'source-loc',
        paint: {
          'circle-radius': 12,
          'circle-color': '#FF5722',
          'circle-stroke-color': 'white',
          'circle-stroke-width': 3,
        },
      });
      // 소음원 아이콘 레이블
      map.addLayer({
        id: 'source-label',
        type: 'symbol',
        source: 'source-loc',
        layout: {
          'text-field': '🔊',
          'text-size': 16,
          'text-anchor': 'center',
          'text-allow-overlap': true,
        },
      });

      // ── 반경 원 ──
      map.addSource('radius-ring', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius-ring',
        paint: { 'fill-color': '#FF5722', 'fill-opacity': 0.04 },
      });
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius-ring',
        paint: { 'line-color': '#FF5722', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.5 },
      });

      loadedRef.current = true;
      for (const [id, data] of Object.entries(pendingRef.current)) {
        map.getSource(id)?.setData(data);
      }
      pendingRef.current = {};
    });

    // 건물 클릭
    map.on('click', 'noise-buildings-fill', (e) => {
      onBuildingSelect?.(e.features[0]?.properties);
    });
    map.on('mouseenter', 'noise-buildings-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'noise-buildings-fill', () => { map.getCanvas().style.cursor = ''; });

    mapRef.current = map;
    return () => {
      cancelAnimationFrame(animRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  /* ── 소음원 클릭 핸들러 ─────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e) => {
      if (drawMode === null || drawMode === 'source') {
        onSourceSet?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [drawMode, onSourceSet]);

  /* ── 방음벽 드래그 그리기 ─────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || drawMode !== 'barrier') return;

    let startCoord = null;

    const onDown = (e) => {
      startCoord = [e.lngLat.lng, e.lngLat.lat];
      map.dragPan.disable();
    };
    const onMove = (e) => {
      if (!startCoord) return;
      const end = [e.lngLat.lng, e.lngLat.lat];
      map.getSource('barrier-preview')?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [startCoord, end] },
          properties: {},
        }],
      });
    };
    const onUp = (e) => {
      if (!startCoord) return;
      const end = [e.lngLat.lng, e.lngLat.lat];
      map.dragPan.enable();
      map.getSource('barrier-preview')?.setData(EMPTY);
      if (Math.hypot(startCoord[0] - end[0], startCoord[1] - end[1]) > 0.00001) {
        onBarrierComplete?.([startCoord, end]);
      }
      startCoord = null;
    };

    map.on('mousedown', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);

    return () => {
      map.off('mousedown', onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
      map.dragPan.enable();
      map.getSource('barrier-preview')?.setData(EMPTY);
    };
  }, [drawMode, onBarrierComplete]);

  /* ── 커서 ──────────────────────────────────────────── */
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

    // 파장 애니메이션 데이터 (중심점 1개)
    const pulseData = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }],
    };
    setSource('pulse-ring', pulseData);

    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, pitch: 50, duration: 600 });

    // rAF 파장 애니메이션
    const PERIOD = 2000; // ms per wave cycle
    const OFFSETS = [0, 667, 1333]; // 3개 원의 위상 차이

    let lastTs = null;
    const animate = (ts) => {
      if (!loadedRef.current || !mapRef.current) return;
      if (!lastTs) lastTs = ts;
      pulseRef.current.t += ts - lastTs;
      lastTs = ts;

      OFFSETS.forEach((offset, i) => {
        const phase = ((pulseRef.current.t + offset) % PERIOD) / PERIOD; // 0→1
        const radius = 10 + phase * 80;   // 10px → 90px
        const opacity = 1 - phase;         // 1 → 0
        mapRef.current?.setPaintProperty(`pulse-ring-${i}`, 'circle-radius', radius);
        mapRef.current?.setPaintProperty(`pulse-ring-${i}`, 'circle-stroke-opacity', opacity * 0.8);
      });

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [sourceLocation, setSource]);

  /* ── 방음벽 렌더링 ──────────────────────────────────── */
  useEffect(() => {
    // barrierCoords = [[[lng,lat],[lng,lat]], ...] 선분 배열
    if (!barrierCoords || barrierCoords.length === 0) {
      setSource('barriers', EMPTY);
      return;
    }
    const features = barrierCoords.map((seg) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: seg },
      properties: { height: barrierHeight },
    }));
    setSource('barriers', { type: 'FeatureCollection', features });
  }, [barrierCoords, barrierHeight, setSource]);

  /* ── 건물 GeoJSON ───────────────────────────────────── */
  useEffect(() => {
    setSource('noise-buildings', buildingGeoJSON || EMPTY);
  }, [buildingGeoJSON, setSource]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

/* ── 원 GeoJSON 생성 ───────────────────────────────────── */
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
