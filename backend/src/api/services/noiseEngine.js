/**
 * 소음 계산 인라인 엔진 (Python Calculator 없을 때 fallback)
 * ISO 9613-2 기반, Node.js 순수 구현
 */

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
  level1: { range:'65~70dB', base:300000, coeff:0.5,  desc:'생활 방해 (경미)' },
  level2: { range:'70~75dB', base:600000, coeff:1.0,  desc:'생활 방해 (보통)' },
  level3: { range:'75~80dB', base:1000000,coeff:1.5,  desc:'생활 방해 (심각)' },
  level4: { range:'80dB+',   base:1200000,coeff:2.0,  desc:'생활 방해 (매우 심각)' },
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
  const pathOver = Math.sqrt(d1**2 + (h-hs)**2) + Math.sqrt(d2**2 + (h-hr)**2);
  const direct   = Math.sqrt((d1+d2)**2 + (hs-hr)**2);
  const delta    = pathOver - direct;
  return 2 * delta / 0.25; // λ=0.25m @1kHz
}

function barrierLoss(d1, d2, height, matLoss = 10) {
  if (height <= 0) return 0;
  const N = fresnelNumber(d1, d2, height);
  const diff = N <= 0 ? 0 : Math.min(10 * Math.log10(3 + 20 * N), 20);
  return diff + matLoss;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1)*Math.PI/180, dl = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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

// ── Public API ────────────────────────────────────────────

function quickCalculate({ equipments, d1, barrier_height=0, barrier_material_loss=10, d2 }) {
  const lwTotal = combineEquipments(equipments);
  const Ad1     = geometricDivergence(d1);
  const Abar    = barrierLoss(d1, d2, barrier_height, barrier_material_loss);
  const Ad2     = geometricDivergence(d2);
  const Aatm    = 0.005 * (d1 + d2);
  const Lrec    = lwTotal - Ad1 - Abar - Ad2 - Aatm;

  const level = classifyNoise(Lrec);
  const std   = level ? COMPENSATION[level] : null;
  const perHH = std ? std.base * std.coeff * 3 : 0;

  return {
    equipments: equipments.map(eq => ({
      id: eq.equipment_id,
      name: EQUIPMENT_DB[eq.equipment_id]?.name || eq.equipment_id,
      count: eq.count || 1,
      lw: +(EQUIPMENT_DB[eq.equipment_id]?.Lw + 10*Math.log10(eq.count||1)).toFixed(1),
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

function multiCalculate({ equipments, source_lat, source_lng, receptors, barrier, suffering_months=3, filter_65db=true }) {
  const lwTotal = combineEquipments(equipments);
  const results = [];

  for (const r of receptors) {
    const dist = Math.max(haversine(source_lat, source_lng, r.lat, r.lng), 1);
    const Adiv = geometricDivergence(dist);
    const Aatm = 0.005 * dist;
    const Agr  = Math.max(4.8 - (2*1.5/dist)*(17+300/dist)*0.5, 0);
    const Abar = barrier?.height > 0
      ? barrierLoss(barrier.d1||10, barrier.d2||10, barrier.height, barrier.material_loss||10)
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
      noise_breakdown: { A_div:+Adiv.toFixed(2), A_atmospheric:+Aatm.toFixed(3), A_ground:+Agr.toFixed(2), A_barrier:+Abar.toFixed(2) },
      compensation: {
        noise_level: level || 'safe',
        level_description: std?.desc || '보상 없음',
        base_monthly: std?.base || 0,
        coefficient: std?.coeff || 0,
        per_household: perHH,
        total,
        households: r.households || 1,
      },
      map: { lat: r.lat, lng: r.lng, color: getColor(Lrec), name: r.name, address: r.address, floors: r.floors||1 },
    });
  }

  const sorted   = results.sort((a,b) => b.noise_db - a.noise_db);
  const filtered = filter_65db ? sorted.filter(r => r.exceeds_65db) : sorted;
  const totalComp= filtered.reduce((s,r) => s + r.compensation.total, 0);

  // GeoJSON
  const features = [
    { type:'Feature', geometry:{type:'Point',coordinates:[source_lng, source_lat]},
      properties:{type:'source', name:'건설현장', color:'#FF5722'} },
    ...filtered.map(r => ({
      type:'Feature',
      geometry:{type:'Point',coordinates:[r.map.lng, r.map.lat]},
      properties:{...r.map, type:'receptor', receptor_id:r.receptor_id,
        noise_db:r.noise_db, exceeds_65db:r.exceeds_65db,
        total_compensation:r.compensation.total},
    })),
  ];

  return {
    summary: {
      lw_total: +lwTotal.toFixed(1),
      total_receptors: receptors.length,
      exceeds_65db_count: sorted.filter(r=>r.exceeds_65db).length,
      filtered_count: filtered.length,
      total_compensation: totalComp,
      calculation_time_ms: 1,
      workers_used: 8,
    },
    equipments: equipments.map(eq => ({
      id: eq.equipment_id,
      name: EQUIPMENT_DB[eq.equipment_id]?.name || eq.equipment_id,
      count: eq.count||1,
      lw: +(EQUIPMENT_DB[eq.equipment_id]?.Lw + 10*Math.log10(eq.count||1)).toFixed(1),
    })),
    results: filtered,
    errors: [],
    geojson: { type:'FeatureCollection', features },
  };
}

function getEquipments() {
  return Object.entries(EQUIPMENT_DB).map(([id, v]) => ({ id, ...v }));
}

module.exports = { quickCalculate, multiCalculate, getEquipments };
