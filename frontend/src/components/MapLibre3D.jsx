import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/bright';
const EMPTY = { type: 'FeatureCollection', features: [] };

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
  const mapRef       = useRef(null);
  const loadedRef    = useRef(false);
  const pendingRef   = useRef({});
  const animRef      = useRef(null);
  const pulseRef     = useRef({ t: 0 });
  const startCoordRef = useRef(null);

  // 항상 최신 콜백/상태를 가리키는 refs (클로저 stale 방지)
  const drawModeRef          = useRef(drawMode);
  const onBarrierCompleteRef = useRef(onBarrierComplete);
  const onSourceSetRef       = useRef(onSourceSet);
  const onBuildingSelectRef  = useRef(onBuildingSelect);

  useEffect(() => { drawModeRef.current = drawMode; },           [drawMode]);
  useEffect(() => { onBarrierCompleteRef.current = onBarrierComplete; }, [onBarrierComplete]);
  useEffect(() => { onSourceSetRef.current = onSourceSet; },     [onSourceSet]);
  useEffect(() => { onBuildingSelectRef.current = onBuildingSelect; }, [onBuildingSelect]);

  /* setSource 헬퍼 */
  const setSource = useCallback((id, data) => {
    if (!loadedRef.current) { pendingRef.current[id] = data; return; }
    mapRef.current?.getSource(id)?.setData(data);
  }, []);

  /* ══════════════════════════════════════════════════
   * 지도 초기화 (한 번만)
   * 모든 이벤트 리스너는 map.on('load') 안에서만 등록
   * ══════════════════════════════════════════════════ */
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
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    // canvas 이벤트 핸들러 - load 안에서 정의/등록
    let canvasListeners = null;

    map.on('load', () => {
      /* ── 건물: 단일 레이어 + 조건식 색상 (filter 분리 없음) ── */
      map.addSource('noise-buildings', { type: 'geojson', data: EMPTY });

      map.addLayer({
        id: 'noise-buildings-3d',
        type: 'fill-extrusion',
        source: 'noise-buildings',
        paint: {
          // 65dB 초과면 소음 색상, 아니면 회색
          'fill-extrusion-color': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
            ['coalesce', ['get', 'color'], '#FF9800'],
            '#B0BEC5',
          ],
          // 초과 건물은 소음량에 비례해 더 높게 표시
          'fill-extrusion-height': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
            ['+',
              ['coalesce', ['get', 'height'], 9],
              ['*', ['max', ['-', ['coalesce', ['get', 'max_noise_db'], 0], 65], 0], 2],
            ],
            ['coalesce', ['get', 'height'], 9],
          ],
          'fill-extrusion-base': 0,
          // 초과 건물은 진하게, 안전 건물은 반투명
          'fill-extrusion-opacity': ['case',
            ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
            0.92,
            0.3,
          ],
        },
      });

      // 소음 레이블 (초과 건물만)
      map.addLayer({
        id: 'noise-label',
        type: 'symbol',
        source: 'noise-buildings',
        filter: ['==', ['coalesce', ['get', 'exceeds_65db'], 0], 1],
        layout: {
          'text-field': ['concat', ['to-string', ['round', ['get', 'max_noise_db']]], 'dB'],
          'text-size': 13,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-offset': [0, -1],
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#E65100'],
          'text-halo-color': 'rgba(255,255,255,0.98)',
          'text-halo-width': 2.5,
        },
      });

      /* ── 방음벽 레이어 ── */
      map.addSource('barriers', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barriers-casing', type: 'line', source: 'barriers',
        paint: { 'line-color': '#BF360C', 'line-width': 10, 'line-cap': 'round', 'line-join': 'round', 'line-opacity': 0.3 },
      });
      map.addLayer({
        id: 'barriers-line', type: 'line', source: 'barriers',
        paint: { 'line-color': '#FF5722', 'line-width': 5, 'line-cap': 'round', 'line-join': 'round' },
      });

      /* ── 방음벽 미리보기 ── */
      map.addSource('barrier-preview', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'barrier-preview-line', type: 'line', source: 'barrier-preview',
        paint: { 'line-color': '#FF9800', 'line-width': 4, 'line-dasharray': [4, 2], 'line-opacity': 0.95 },
      });

      /* ── 소음원 파장 ── */
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

      /* ── 소음원 마커 ── */
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

      /* ── 탐색 반경 ── */
      map.addSource('radius-ring', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-ring',
        paint: { 'fill-color': '#FF5722', 'fill-opacity': 0.04 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius-ring',
        paint: { 'line-color': '#FF5722', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.5 } });

      /* ── pending 데이터 적용 ── */
      loadedRef.current = true;
      for (const [id, data] of Object.entries(pendingRef.current)) {
        map.getSource(id)?.setData(data);
      }
      pendingRef.current = {};

      /* ── 건물 클릭 ── */
      map.on('click', 'noise-buildings-3d', (e) => {
        if (e.features?.length) onBuildingSelectRef.current?.(e.features[0].properties);
      });
      map.on('mouseenter', 'noise-buildings-3d', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'noise-buildings-3d', () => {
        map.getCanvas().style.cursor = drawModeRef.current === 'barrier' ? 'crosshair' : 'grab';
      });

      /* ── 소음원 클릭 ── */
      map.on('click', (e) => {
        if (drawModeRef.current === 'barrier') return;
        const hit = map.queryRenderedFeatures(e.point, { layers: ['noise-buildings-3d'] });
        if (hit.length > 0) return;
        onSourceSetRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      });

      /* ════════════════════════════════════════════════
       * 방음벽 드래그 그리기
       * - map.on('load') 안에서 등록 (지도 완전 준비 후)
       * - mousedown/mousemove: canvas DOM 이벤트
       * - mouseup: document (캔버스 밖 해제도 감지)
       * ════════════════════════════════════════════════ */
      const canvas = map.getCanvas();

      const toLngLat = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        const pt   = map.unproject([clientX - rect.left, clientY - rect.top]);
        return [pt.lng, pt.lat];
      };

      const onDown = (e) => {
        if (drawModeRef.current !== 'barrier') return;
        e.preventDefault();
        e.stopPropagation();
        startCoordRef.current = toLngLat(e.clientX, e.clientY);
      };

      const onMove = (e) => {
        if (!startCoordRef.current) return;
        const end = toLngLat(e.clientX, e.clientY);
        map.getSource('barrier-preview')?.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [startCoordRef.current, end] }, properties: {} }],
        });
      };

      const onUp = (e) => {
        if (!startCoordRef.current) return;
        const start = startCoordRef.current;
        startCoordRef.current = null;
        map.getSource('barrier-preview')?.setData(EMPTY);

        const end  = toLngLat(e.clientX, e.clientY);
        const dist = Math.hypot(start[0] - end[0], start[1] - end[1]);
        if (dist > 0.000001) {
          onBarrierCompleteRef.current?.([start, end]);
        }
      };

      canvas.addEventListener('mousedown', onDown);
      canvas.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',  onUp);

      canvasListeners = () => {
        canvas.removeEventListener('mousedown', onDown);
        canvas.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',  onUp);
      };
    }); // end map.on('load')

    return () => {
      cancelAnimationFrame(animRef.current);
      canvasListeners?.();
      map.remove();
      mapRef.current  = null;
      loadedRef.current = false;
    };
  }, []); // 의존성 없음 - 한 번만

  /* ── dragPan / 커서 토글 ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawMode === 'barrier') {
      map.dragPan.disable();
      map.dragRotate.disable();
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      map.dragPan.enable();
      map.dragRotate.enable();
      map.getCanvas().style.cursor = 'grab';
      startCoordRef.current = null;
      if (loadedRef.current) map.getSource('barrier-preview')?.setData(EMPTY);
    }
  }, [drawMode]);

  /* ── 소음원 위치 + 파장 애니메이션 ── */
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

  /* ── 방음벽 렌더링 ── */
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

  /* ── 주소 검색으로 지도 이동 ── */
  useEffect(() => {
    if (!flyToLocation) return;
    mapRef.current?.flyTo({
      center: [flyToLocation.lng, flyToLocation.lat],
      zoom: flyToLocation.zoom ?? 16,
      pitch: 50,
      duration: 800,
    });
  }, [flyToLocation]);

  /* ── 건물 GeoJSON 업데이트 ── */
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
