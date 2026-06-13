import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/bright';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

export default function MapLibre3D({
  sourceLocation,
  barrierCoords,
  buildingGeoJSON,
  drawMode,
  barrierHeight = 3,
  onMapClick,
  onBuildingSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const pendingRef = useRef({});

  const setSource = useCallback((id, data) => {
    if (!loadedRef.current) { pendingRef.current[id] = data; return; }
    mapRef.current?.getSource(id)?.setData(data);
  }, []);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [126.978, 37.5665],
      zoom: 15,
      pitch: 50,
      bearing: 0,
      antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      // 소음 색상 건물 레이어
      map.addSource('noise-buildings', { type: 'geojson', data: EMPTY_FC });
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

      // 방음벽 레이어
      map.addSource('barriers', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'barriers-line',
        type: 'line',
        source: 'barriers',
        paint: { 'line-color': '#FF5722', 'line-width': 5, 'line-cap': 'round' },
      });
      map.addLayer({
        id: 'barriers-points',
        type: 'circle',
        source: 'barriers',
        paint: { 'circle-radius': 5, 'circle-color': '#FF5722' },
        filter: ['==', '$type', 'Point'],
      });

      // 소음원 마커 레이어
      map.addSource('source-loc', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'source-circle',
        type: 'circle',
        source: 'source-loc',
        paint: {
          'circle-radius': 16,
          'circle-color': '#FF5722',
          'circle-stroke-color': 'white',
          'circle-stroke-width': 3,
          'circle-opacity': 0.9,
        },
      });

      // 반경 레이어
      map.addSource('radius-ring', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius-ring',
        paint: { 'fill-color': '#FF5722', 'fill-opacity': 0.05 },
      });
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius-ring',
        paint: { 'line-color': '#FF5722', 'line-width': 1.5, 'line-dasharray': [4, 3] },
      });

      loadedRef.current = true;

      // pending updates 적용
      for (const [id, data] of Object.entries(pendingRef.current)) {
        map.getSource(id)?.setData(data);
      }
      pendingRef.current = {};
    });

    // 건물 클릭
    map.on('click', 'noise-buildings-fill', (e) => {
      if (onBuildingSelect) onBuildingSelect(e.features[0]?.properties);
      e.stopPropagation?.();
    });
    map.on('mouseenter', 'noise-buildings-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'noise-buildings-fill', () => {
      map.getCanvas().style.cursor = drawMode ? 'crosshair' : '';
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; };
  }, []);

  // 지도 클릭 이벤트
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e) => {
      if (onMapClick) onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [onMapClick]);

  // 커서 변경
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = drawMode ? 'crosshair' : '';
    }
  }, [drawMode]);

  // 소음원 위치 업데이트
  useEffect(() => {
    if (!sourceLocation) return;
    setSource('source-loc', {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [sourceLocation.lng, sourceLocation.lat] }, properties: {} }],
    });
    setSource('radius-ring', makeCircle(sourceLocation.lng, sourceLocation.lat, sourceLocation.radius || 300));
    mapRef.current?.flyTo({ center: [sourceLocation.lng, sourceLocation.lat], zoom: 16, pitch: 50, duration: 800 });
  }, [sourceLocation, setSource]);

  // 방음벽 업데이트
  useEffect(() => {
    if (!barrierCoords || barrierCoords.length === 0) {
      setSource('barriers', EMPTY_FC);
      return;
    }
    const features = [];
    if (barrierCoords.length >= 2) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: barrierCoords }, properties: { height: barrierHeight } });
    }
    // 점 표시
    barrierCoords.forEach((c) => {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} });
    });
    setSource('barriers', { type: 'FeatureCollection', features });
  }, [barrierCoords, barrierHeight, setSource]);

  // 건물 GeoJSON 업데이트
  useEffect(() => {
    setSource('noise-buildings', buildingGeoJSON || EMPTY_FC);
  }, [buildingGeoJSON, setSource]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function makeCircle(lng, lat, radiusM, steps = 64) {
  const R = 6371000;
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM / R) * (180 / Math.PI) * Math.cos(angle);
    const dLng = (radiusM / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos(lat * Math.PI / 180);
    coords.push([lng + dLng, lat + dLat]);
  }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }] };
}
