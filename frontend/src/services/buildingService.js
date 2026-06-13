const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function queryBuildings(lat, lng, radius = 300) {
  const query = `[out:json][timeout:15];(way["building"](around:${radius},${lat},${lng}););out body;>;out skel qt;`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error('건물 데이터 조회 실패');
  const data = await res.json();
  return parseOSM(data);
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
        name: way.tags?.['name:ko'] || way.tags?.name || `건물`,
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
