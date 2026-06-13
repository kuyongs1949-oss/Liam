// ISO 9613-2 소음 계산 엔진 (프론트엔드 로컬 실행)

const EQUIPMENT_DB = {
  dozer:           { name: '불도저',       Lw: 113 },
  excavator:       { name: '굴삭기',       Lw: 108 },
  pump_car:        { name: '펌프카',       Lw: 105 },
  crane:           { name: '크레인',       Lw: 102 },
  concrete_mixer:  { name: '콘크리트믹서', Lw: 107 },
  compactor:       { name: '다짐기',       Lw: 111 },
  pile_driver:     { name: '항타기',       Lw: 118 },
  air_compressor:  { name: '에어컴프레서', Lw: 103 },
  generator:       { name: '발전기',       Lw: 101 },
  jackhammer:      { name: '잭해머',       Lw: 115 },
};

const COMPENSATION = {
  level1: { range: '65~70dB', base: 300000,  coeff: 0.5, desc: '생활 방해 (경미)' },
  level2: { range: '70~75dB', base: 600000,  coeff: 1.0, desc: '생활 방해 (보통)' },
  level3: { range: '75~80dB', base: 1000000, coeff: 1.5, desc: '생활 방해 (심각)' },
  level4: { range: '80dB+',   base: 1200000, coeff: 2.0, desc: '생활 방해 (매우 심각)' },
};

function combineEquipments(equipments) {
  const total = equipments.reduce((sum, eq) => {
    const info = EQUIPMENT_DB[eq.equipment_id];
    if (!info) return sum;
    const lw = info.Lw + 10 * Math.log10(Math.max(eq.count || 1, 1));
    return sum + Math.pow(10, lw / 10);
  }, 0);
  return total > 0 ? 10 * Math.log10(total) : 0;
}

function geometricDivergence(d) {
  return d > 0 ? 20 * Math.log10(d) + 11 : 0;
}

function fresnelNumber(d1, d2, h, hs = 1.5, hr = 1.5) {
  const pathOver = Math.sqrt(d1 ** 2 + (h - hs) ** 2) + Math.sqrt(d2 ** 2 + (h - hr) ** 2);
  const direct = Math.sqrt((d1 + d2) ** 2 + (hs - hr) ** 2);
  return 2 * (pathOver - direct) / 0.25;
}

function barrierLoss(d1, d2, height, matLoss = 10) {
  if (height <= 0) return 0;
  const N = fresnelNumber(d1, d2, height);
  const diff = N <= 0 ? 0 : Math.min(10 * Math.log10(3 + 20 * N), 20);
  return diff + matLoss;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyNoise(db) {
  if (db < 65) return null;
  if (db < 70) return 'level1';
  if (db < 75) return 'level2';
  if (db < 80) return 'level3';
  return 'level4';
}

function getColor(db) {
  if (db < 65) return '#2196F3';
  if (db < 70) return '#4CAF50';
  if (db < 72) return '#FFC107';
  if (db < 75) return '#FF9800';
  if (db < 80) return '#F44336';
  return '#9C27B0';
}

export function quickCalculate({ equipments, d1, barrier_height = 0, barrier_material_loss = 10, d2 }) {
  const lwTotal = combineEquipments(equipments);
  const Ad1  = geometricDivergence(d1);
  const Abar = barrierLoss(d1, d2, barrier_height, barrier_material_loss);
  const Ad2  = geometricDivergence(d2);
  const Aatm = 0.005 * (d1 + d2);
  const Lrec = lwTotal - Ad1 - Abar - Ad2 - Aatm;

  const level = classifyNoise(Lrec);
  const std   = level ? COMPENSATION[level] : null;
  const perHH = std ? std.base * std.coeff * 3 : 0;

  return {
    equipments: equipments.map((eq) => ({
      id: eq.equipment_id,
      name: EQUIPMENT_DB[eq.equipment_id]?.name || eq.equipment_id,
      count: eq.count || 1,
      lw: +((EQUIPMENT_DB[eq.equipment_id]?.Lw || 0) + 10 * Math.log10(eq.count || 1)).toFixed(1),
    })),
    lw_total: +lwTotal.toFixed(1),
    noise_result: {
      lw_total: +lwTotal.toFixed(1),
      A_d1: +Ad1.toFixed(2),
      A_barrier: +Abar.toFixed(2),
      A_d2: +Ad2.toFixed(2),
      A_atmospheric: +Aatm.toFixed(3),
      L_receiver: +Lrec.toFixed(1),
      exceeds_65db: Lrec > 65,
    },
    compensation_preview: {
      noise_level: level || 'safe',
      description: std?.desc || '65dB 미만 - 보상 대상 아님',
      per_household_3months: Math.round(perHH),
      color: getColor(Lrec),
    },
  };
}

export function multiCalculate({ equipments, source_lat, source_lng, receptors, barrier, suffering_months = 3, filter_65db = true }) {
  const lwTotal = combineEquipments(equipments);
  const results = [];

  for (const r of receptors) {
    const dist = Math.max(haversine(source_lat, source_lng, r.lat, r.lng), 1);
    const Adiv = geometricDivergence(dist);
    const Aatm = 0.005 * dist;
    const Agr  = Math.max(4.8 - (2 * 1.5 / dist) * (17 + 300 / dist) * 0.5, 0);
    const Abar = barrier?.height > 0
      ? barrierLoss(barrier.d1 || 10, barrier.d2 || 10, barrier.height, barrier.material_loss || 10)
      : 0;
    const Lrec = lwTotal - Adiv - Aatm - Agr - Abar;

    const level = classifyNoise(Lrec);
    const std   = level ? COMPENSATION[level] : null;
    const perHH = std ? Math.round(std.base * std.coeff * suffering_months) : 0;
    const total = perHH * (r.households || 1);

    results.push({
      success: true,
      receptor_id: r.receptor_id,
      noise_db: +Lrec.toFixed(1),
      distance: +dist.toFixed(0),
      exceeds_65db: Lrec > 65,
      noise_breakdown: { A_div: +Adiv.toFixed(2), A_atmospheric: +Aatm.toFixed(3), A_ground: +Agr.toFixed(2), A_barrier: +Abar.toFixed(2) },
      compensation: {
        noise_level: level || 'safe',
        level_description: std?.desc || '보상 없음',
        base_monthly: std?.base || 0,
        coefficient: std?.coeff || 0,
        per_household: perHH,
        total,
        households: r.households || 1,
      },
      map: { lat: r.lat, lng: r.lng, color: getColor(Lrec), name: r.name, address: r.address, floors: r.floors || 1 },
    });
  }

  const sorted   = results.sort((a, b) => b.noise_db - a.noise_db);
  const filtered = filter_65db ? sorted.filter((r) => r.exceeds_65db) : sorted;
  const totalComp = filtered.reduce((s, r) => s + r.compensation.total, 0);

  const features = [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [source_lng, source_lat] },
      properties: { type: 'source', name: '건설현장', color: '#FF5722' } },
    ...filtered.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.map.lng, r.map.lat] },
      properties: { ...r.map, type: 'receptor', receptor_id: r.receptor_id,
        noise_db: r.noise_db, exceeds_65db: r.exceeds_65db, total_compensation: r.compensation.total },
    })),
  ];

  return {
    summary: {
      lw_total: +lwTotal.toFixed(1),
      total_receptors: receptors.length,
      exceeds_65db_count: sorted.filter((r) => r.exceeds_65db).length,
      filtered_count: filtered.length,
      total_compensation: totalComp,
      calculation_time_ms: 1,
      workers_used: 1,
    },
    equipments: equipments.map((eq) => ({
      id: eq.equipment_id,
      name: EQUIPMENT_DB[eq.equipment_id]?.name || eq.equipment_id,
      count: eq.count || 1,
      lw: +((EQUIPMENT_DB[eq.equipment_id]?.Lw || 0) + 10 * Math.log10(eq.count || 1)).toFixed(1),
    })),
    results: filtered,
    errors: [],
    geojson: { type: 'FeatureCollection', features },
  };
}

export function getEquipments() {
  return Object.entries(EQUIPMENT_DB).map(([id, v]) => ({ id, ...v }));
}

// ── 3D 층별 계산 ──────────────────────────────────────────

function ccw(A, B, C) {
  return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
}
function segmentsIntersect(a1, a2, b1, b2) {
  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
}
function getIntersectionPoint(a1, a2, b1, b2) {
  const d1 = [a2[0] - a1[0], a2[1] - a1[1]];
  const d2 = [b2[0] - b1[0], b2[1] - b1[1]];
  const cross = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(cross) < 1e-12) return null;
  const t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / cross;
  return [a1[0] + t * d1[0], a1[1] + t * d1[1]];
}

function barrierInsertionLoss(d1, d2, Hb, Hs, Hr) {
  const pathOver = Math.sqrt(d1 ** 2 + (Hb - Hs) ** 2) + Math.sqrt(d2 ** 2 + (Hb - Hr) ** 2);
  const pathDirect = Math.sqrt((d1 + d2) ** 2 + (Hs - Hr) ** 2);
  const delta = pathOver - pathDirect;
  if (delta <= 0) return 0;
  const N = (2 * delta) / 0.25;
  return Math.min(10 * Math.log10(3 + 20 * N), 20);
}

// 선분 위의 최근접점 계산 (lng/lat 좌표 기준)
function nearestPointOnSegment(P, A, B) {
  const AB = [B[0] - A[0], B[1] - A[1]];
  const AP = [P[0] - A[0], P[1] - A[1]];
  const len2 = AB[0] ** 2 + AB[1] ** 2;
  if (len2 === 0) return A;
  const t = Math.max(0, Math.min(1, (AP[0] * AB[0] + AP[1] * AB[1]) / len2));
  return [A[0] + t * AB[0], A[1] + t * AB[1]];
}

// 소음원에서 방음벽(여러 선분)까지의 최단 거리 계산
export function calcSourceToBarrierDist(sourceLat, sourceLng, barrierSegments) {
  if (!barrierSegments || barrierSegments.length === 0) return 0;
  const S = [sourceLng, sourceLat];
  let minDist = Infinity;
  for (const [B1, B2] of barrierSegments) {
    const nearest = nearestPointOnSegment(S, B1, B2);
    const d = haversine(sourceLat, sourceLng, nearest[1], nearest[0]);
    if (d < minDist) minDist = d;
  }
  return +minDist.toFixed(1);
}

export function calculateFloorNoise({
  lwTotal, sourceLat, sourceLng, receiverLat, receiverLng,
  floorNum,
  barrierSegments = [],  // [[[lng,lat],[lng,lat]], ...] 독립 선분 배열
  barrierHeight = 3,
  sufferingMonths = 3,
}) {
  const Hs = 1.5;
  const Hr = Math.max(floorNum * 3, 3);
  const dist = Math.max(haversine(sourceLat, sourceLng, receiverLat, receiverLng), 1);

  const Adiv = 20 * Math.log10(dist) + 11;
  const Aatm = 0.005 * dist;
  const hm = (Hs + Hr) / 2;
  const Agr = Hr > 6 ? 0 : Math.max(4.8 - (2 * hm / dist) * (17 + 300 / dist), 0);

  let Abar = 0;
  let barrierD1used = 0;
  let barrierD2used = 0;

  // 각 방음벽 선분에 대해 소음원-수음점 직선과 교차 여부 확인
  if (barrierSegments.length > 0 && barrierHeight > 0) {
    const S = [sourceLng, sourceLat];
    const R = [receiverLng, receiverLat];

    for (const [B1, B2] of barrierSegments) {
      if (!segmentsIntersect(S, R, B1, B2)) continue;
      const pt = getIntersectionPoint(S, R, B1, B2);
      if (!pt) continue;

      const d1 = Math.max(haversine(sourceLat, sourceLng, pt[1], pt[0]), 1);
      const d2 = Math.max(haversine(pt[1], pt[0], receiverLat, receiverLng), 1);

      // 방음벽 높이보다 수음점이 높으면 효과 감소
      let loss;
      if (Hr < barrierHeight + 0.5) {
        loss = barrierInsertionLoss(d1, d2, barrierHeight, Hs, Hr);
      } else {
        const excess = Hr - barrierHeight;
        loss = Math.max(0, barrierInsertionLoss(d1, d2, barrierHeight, Hs, Hr) - excess * 2);
      }

      if (loss > Abar) {
        Abar = loss;
        barrierD1used = +d1.toFixed(1);
        barrierD2used = +d2.toFixed(1);
      }
    }
  }

  const Lrec = lwTotal - Adiv - Aatm - Agr - Abar;
  const level = classifyNoise(Lrec);
  const std = level ? COMPENSATION[level] : null;
  const compensation = std ? Math.round(std.base * std.coeff * sufferingMonths) : 0;

  return {
    floor: floorNum,
    height_m: Hr,
    noise_db: +Lrec.toFixed(1),
    A_div: +Adiv.toFixed(1),
    A_gr: +Agr.toFixed(1),
    A_barrier: +Abar.toFixed(1),
    barrier_d1: barrierD1used,
    barrier_d2: barrierD2used,
    exceeds_65db: Lrec > 65,
    noise_level: level || 'safe',
    compensation,
    color: getColor(Lrec),
  };
}

export function calculateBuildingNoise({
  lwTotal, sourceLat, sourceLng, building,
  barrierSegments = [],
  barrierHeight = 3,
  sufferingMonths = 3,
}) {
  const { centroid_lat, centroid_lng, floors } = building;
  const floorResults = [];

  for (let f = 1; f <= Math.min(floors, 50); f++) {
    floorResults.push(calculateFloorNoise({
      lwTotal, sourceLat, sourceLng,
      receiverLat: centroid_lat, receiverLng: centroid_lng,
      floorNum: f, barrierSegments, barrierHeight, sufferingMonths,
    }));
  }

  const maxFloor = floorResults.reduce((a, b) => (a.noise_db > b.noise_db ? a : b));
  const exceeding = floorResults.filter((f) => f.exceeds_65db);
  const totalComp = exceeding.reduce((s, f) => s + f.compensation, 0);
  const dist = haversine(sourceLat, sourceLng, centroid_lat, centroid_lng);

  // 이 건물에 실제 적용된 d1/d2 (1층 기준)
  const f1 = floorResults[0];

  return {
    ...building,
    distance: +dist.toFixed(0),
    floor_results: floorResults,
    max_noise_db: maxFloor.noise_db,
    max_floor: maxFloor.floor,
    exceeds_65db: maxFloor.noise_db > 65,
    color: getColor(maxFloor.noise_db),
    exceeding_floors: exceeding.length,
    total_compensation: totalComp,
    total_compensation_3m: totalComp,
    noise_level: maxFloor.noise_level || 'safe',
    barrier_d1: f1?.barrier_d1 || 0,
    barrier_d2: f1?.barrier_d2 || 0,
  };
}
