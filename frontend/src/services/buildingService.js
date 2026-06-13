const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function queryBuildings(lat, lng, radius = 300) {
  const query = `[out:json][timeout:15];(way["building"](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
  const body = `data=${encodeURIComponent(query)}`;

  let lastError;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }, 20000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return parseOSM(data);
    } catch (e) {
      lastError = e;
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
    if (coords[0][0] !== coords[coords.length - 1][0]) coords.push(coords[0]);

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
        noise_db: null,
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
