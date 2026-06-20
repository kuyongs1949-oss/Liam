const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// 평균 세대 전용면적 (㎡) — 한국 국민주택 기준
const AVG_UNIT_AREA_M2 = 85;

// 메모리 캐시 (같은 위치·반경 재조회 즉시 반환)
const _cache = new Map();

async function fetchMirror(url, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.elements?.length) throw new Error('빈 응답');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function queryBuildings(lat, lng, radius = 300) {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)},${radius}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  const query = `[out:json][timeout:20];(way["building"](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
  const body = `data=${encodeURIComponent(query)}`;

  const data = await Promise.any(
    OVERPASS_MIRRORS.map((url) => fetchMirror(url, body, 20000))
  ).catch(() => {
    throw new Error('건물 데이터를 가져올 수 없습니다. 잠시 후 다시 시도하세요.');
  });

  const result = parseOSM(data);
  _cache.set(cacheKey, result);
  return result;
}

function parseOSM(data) {
  const nodeMap = {};
  const ways = [];

  for (const el of data.elements) {
    if (el.type === 'node') nodeMap[el.id] = [el.lon, el.lat];
    else if (el.type === 'way' && el.tags?.building) ways.push(el);
  }

  const features = [];
  for (const way of ways) {
    const coords = way.nodes.map((id) => nodeMap[id]).filter(Boolean);
    if (coords.length < 4) continue;
    const first = coords[0], last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) coords.push(coords[0]);

    const floors = parseInt(
      way.tags?.['building:levels'] || way.tags?.levels || '4', 10
    );
    const centroid = getCentroid(coords);

    // OSM 태그에 명시된 경우 우선 사용, 없으면 건물 폴리곤 면적으로 자동 산출
    let unitsPerFloor = 0;
    if (way.tags?.['building:flats']) {
      const totalFlats = parseInt(way.tags['building:flats'], 10);
      unitsPerFloor = Math.max(1, Math.round(totalFlats / floors));
    } else if (way.tags?.['building:units']) {
      const totalUnits = parseInt(way.tags['building:units'], 10);
      unitsPerFloor = Math.max(1, Math.round(totalUnits / floors));
    } else {
      // 폴리곤 바닥 면적(㎡) ÷ 평균 세대면적으로 추정
      const footprintM2 = polygonAreaM2(coords, centroid[1]);
      unitsPerFloor = Math.max(1, Math.round(footprintM2 / AVG_UNIT_AREA_M2));
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {
        id: String(way.id),
        name: way.tags?.['name:ko'] || way.tags?.name || '건물',
        floors,
        units_per_floor: unitsPerFloor,
        height: floors * 3,
        color: '#90A4AE',
        max_noise_db: 0,
        centroid_lat: centroid[1],
        centroid_lng: centroid[0],
        addr: buildAddr(way.tags),
        building_type: way.tags?.building,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

// Shoelace 공식으로 위경도 폴리곤의 바닥 면적(㎡) 계산
function polygonAreaM2(coords, avgLat) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(avgLat * Math.PI / 180);
  let area = 0;
  const n = coords.length - 1;
  for (let i = 0; i < n; i++) {
    const x1 = coords[i][0] * mPerDegLng;
    const y1 = coords[i][1] * mPerDegLat;
    const x2 = coords[i + 1][0] * mPerDegLng;
    const y2 = coords[i + 1][1] * mPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function buildAddr(tags = {}) {
  const road = tags['addr:road'] || tags['addr:street'] || '';
  const hnum = tags['addr:housenumber'] || '';
  const full = tags['addr:full'] || '';
  const city = tags['addr:city'] || tags['addr:quarter'] || '';
  if (road && hnum) return `${road} ${hnum}`;
  if (road)         return road;
  if (full)         return full;
  if (city)         return city;
  return '';
}

function getCentroid(coords) {
  const n = coords.length - 1;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += coords[i][0]; y += coords[i][1]; }
  return [x / n, y / n];
}
