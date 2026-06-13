import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/bright';
const EMPTY = { type: 'FeatureCollection', features: [] };

export default function MapLibre3D({
  sourceLocation,
  barrierCoords,      // [[lng,lat], [lng,lat], ...]
  buildingGeoJSON,
  drawMode,           // null | 'source' | 'barrier'
  barrierHeight = 3,
  onSourceSet,        // (lngLat) => void
  onBarrierComplete,  // (coords [[lng,lat],[lng,lat]]) => void
  onBuildingSelect,   // (props) => void
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const pendingRef = useRef({});

  const setSource = useCallback((id, data) => {
    if (!loadedRef.current) { pendingRef.current[id] = data; return; }
    mapRef.current?.getSource(id)?.setData(data);
  }, []);

  // 지도 초기화
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
      // 건물 소음 레이어
      map.addSource('noise-buildings', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'noise-buildings-fill',
        type: 'fill-extrusion',
        source: 'noise-buildings',
        paint: {
          'fill-extrusion-color': ['coalesce', ['get', 'color'], '#90A4AE'],
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 12],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
        },
      });

      // 방음벽 (확정)
      map.addSource('barriers', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barriers-line',
        type: 'line',
        source: 'barriers',
        paint: { 'line-color': '#FF5722', 'line-width': 5, 'line-cap': 'round', 'line-join': 'round' },
      });

      // 방음벽 그리기 미리보기
      map.addSource('barrier-preview', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barrier-preview-line',
        type: 'line',
        source: 'barrier-preview',
        paint: { 'line-color': '#FF5722', 'line-width': 3, 'line-dasharray': [3, 2], 'line-opacity': 0.7 },
      });

      // 소음원 마커
      map.addSource('source-loc', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'source-circle',
        type: 'circle',
        source: 'source-loc',
        paint: {
          'circle-radius': 14,
          'circle-color': '#FF5722',
          'circle-stroke-color': 'white',
          'circle-stroke-width': 3,
        },
      });

      // 반경 원
      map.addSource('radius-ring', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-ring', paint: { 'fill-color': '#FF5722', 'fill-opacity': 0.05 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius-ring', paint: { 'line-color': '#FF5722', 'line-width': 1.5, 'line-dasharray': [4, 3] } });

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
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; };
  }, []);

  // ── 소음원 클릭 (source 모드 또는 기본) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e) => {
      if (drawMode === 'source' || drawMode === null) {
        onSourceSet?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [drawMode, onSourceSet]);

  // ── 방음벽 드래그 그리기 ──
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
        features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [startCoord, end] }, properties: {} }],
      });
    };

    const onUp = (e) => {
      if (!startCoord) return;
      const end = [e.lngLat.lng, e.lngLat.lat];
      map.dragPan.enable();
      map.getSource('barrier-preview')?.setData(EMPTY);
      const dist = Math.hypot(startCoord[0] - end[0], startCoord[1] - end[1]);
      if (dist > 0.00001) onBarrierComplete?.([startCoord, end]);
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

  // 커서
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = drawMode === 'barrier' ? 'crosshair' : 'grab';
    }
  }, [drawMode]);

  // 소음원 위치 반영
  useEffect(() => {
    if (!sourceLocation) return;
    setSource('source-loc', {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [sourceLocation.lng, sourceLocation.lat] }, properties: {} }],
    });
    setSource('radius-ring', makeCircle(sourceLocation.lng, sourceLocation.lat, sourceLocation.radius || 300));
    mapRef.current?.flyTo({ center: [sourceLocation.lng, sourceLocation.lat], zoom: 16, pitch: 50, duration: 600 });
  }, [sourceLocation, setSource]);

  // 방음벽 반영
  useEffect(() => {
    if (!barrierCoords || barrierCoords.length < 2) { setSource('barriers', EMPTY); return; }
    setSource('barriers', {
      type: 'FeatureCollection',
      features: barrierCoords.map((seg) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: seg },
        properties: { height: barrierHeight },
      })),
    });
  }, [barrierCoords, barrierHeight, setSource]);

  // 건물 GeoJSON 반영
  useEffect(() => {
    setSource('noise-buildings', buildingGeoJSON || EMPTY);
  }, [buildingGeoJSON, setSource]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function makeCircle(lng, lat, r, steps = 64) {
  const R = 6371000;
  const coords = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return [lng + (r / R) * (180 / Math.PI) * Math.sin(a) / Math.cos(lat * Math.PI / 180),
            lat + (r / R) * (180 / Math.PI) * Math.cos(a)];
  });
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }] };
}
