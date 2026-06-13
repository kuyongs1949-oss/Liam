const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (e) {
    // AbortError 메시지를 사람이 읽을 수 있는 형태로 변환
    if (e.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`요청 시간 초과 (${timeoutMs / 1000}초)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function queryBuildings(lat, lng, radius = 300) {
  // timeout 쿼리 파라미터도 25초로 설정
  const query = `[out:json][timeout:25];(way["building"](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
  const body = `data=${encodeURIComponent(query)}`;

  let lastError;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetchWithTimeout(
        url,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
        30000  // 30초 타임아웃
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result = parseOSM(data);
      if (result.features.length === 0 && data.elements.length === 0) {
        // 빈 응답이면 다음 미러 시도 (서버 오류일 수 있음)
        throw new Error('빈 응답');
      }
      return result;
    } catch (e) {
      lastError = e;
      // 다음 미러로 계속
    }
  }
  throw new Error(`건물 데이터를 가져올 수 없습니다: ${lastError?.message}`);
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
    // 폴리곤 닫기
    const first = coords[0], last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) coords.push(coords[0]);

    const floors = parseInt(
      way.tags?.['building:levels'] || way.tags?.levels || '4', 10
    );
    const height = floors * 3;
    const centroid = getCentroid(coords);

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {
        id: String(way.id),
        name: way.tags?.['name:ko'] || way.tags?.name || '건물',
        floors,
        height,
        color: '#90A4AE',
        max_noise_db: 0,
        centroid_lat: centroid[1],
        centroid_lng: centroid[0],
        addr: way.tags?.['addr:road'] || way.tags?.['addr:full'] || '',
        building_type: way.tags?.building,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

function getCentroid(coords) {
  const n = coords.length - 1;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += coords[i][0]; y += coords[i][1]; }
  return [x / n, y / n];
}
