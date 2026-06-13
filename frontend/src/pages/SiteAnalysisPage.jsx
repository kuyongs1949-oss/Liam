import { useState, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Slider,
  TextField, Chip, Divider, CircularProgress, Alert, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem,
  LinearProgress, Collapse,
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FenceIcon from '@mui/icons-material/Fence';
import ApartmentIcon from '@mui/icons-material/Apartment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();

// 환경분쟁조정위원회 고시 보상 기준
const COMP_TABLE = [
  { key: 'level1', range: '65 ~ 70dB', monthly: 150000,  color: '#4CAF50', bg: '#E8F5E9', label: '경미' },
  { key: 'level2', range: '70 ~ 75dB', monthly: 600000,  color: '#FF9800', bg: '#FFF3E0', label: '보통' },
  { key: 'level3', range: '75 ~ 80dB', monthly: 666667,  color: '#F44336', bg: '#FFEBEE', label: '심각' },
  { key: 'level4', range: '80dB 이상', monthly: 800000,  color: '#9C27B0', bg: '#F3E5F5', label: '매우심각' },
];

const COMP_MAP = {
  level1: COMP_TABLE[0], level2: COMP_TABLE[1],
  level3: COMP_TABLE[2], level4: COMP_TABLE[3],
  safe: { range: '65dB 미만', monthly: 0, color: '#90A4AE', bg: '#ECEFF1', label: '안전' },
};

function dbColor(db) {
  if (db < 65) return '#90A4AE';
  if (db < 70) return '#4CAF50';
  if (db < 75) return '#FF9800';
  if (db < 80) return '#F44336';
  return '#9C27B0';
}

function dbBg(db) {
  if (db < 65) return '#ECEFF1';
  if (db < 70) return '#E8F5E9';
  if (db < 75) return '#FFF3E0';
  if (db < 80) return '#FFEBEE';
  return '#F3E5F5';
}

function combineLw(list) {
  const total = list.reduce((sum, eq) => {
    const info = EQUIPMENT_LIST.find((e) => e.id === eq.id);
    if (!info) return sum;
    return sum + Math.pow(10, (info.Lw + 10 * Math.log10(Math.max(eq.count, 1))) / 10);
  }, 0);
  return total > 0 ? 10 * Math.log10(total) : 0;
}

export default function SiteAnalysisPage() {
  // ── 입력 상태 ──
  const [equipments, setEquipments] = useState([{ id: 'excavator', count: 2 }]);
  const [sourceLocation, setSourceLocation] = useState(null);
  const [radius, setRadius] = useState(300);

  // 방음벽 설정
  const [useBarrier, setUseBarrier] = useState(false);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [barrierD1, setBarrierD1] = useState(10);   // 장비 → 방음벽
  const [barrierD2, setBarrierD2] = useState(50);   // 방음벽 → 민원인

  const [sufferingMonths, setSufferingMonths] = useState(3);

  // ── 결과 상태 ──
  const [buildings, setBuildings] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lwTotal = useMemo(() => combineLw(equipments), [equipments]);

  // 합산 소음도 색상
  const lwColor = lwTotal >= 115 ? '#9C27B0' : lwTotal >= 110 ? '#F44336' : lwTotal >= 105 ? '#FF9800' : '#1565C0';

  const handleSourceSet = useCallback(({ lng, lat }) => {
    setSourceLocation({ lng, lat, radius });
    setResults([]);
    setBuildings(null);
    setError('');
  }, [radius]);

  const handleCalculate = async () => {
    if (!sourceLocation) { setError('지도를 클릭해 공사 현장 위치를 선택하세요.'); return; }
    setLoading(true);
    setError('');
    setSelectedBuilding(null);
    setExpandedId(null);
    try {
      const geoJSON = await queryBuildings(sourceLocation.lat, sourceLocation.lng, radius);
      if (!geoJSON.features.length) {
        setError('주변에 건물 데이터가 없습니다. 반경을 늘리거나 다른 위치를 선택해보세요.');
        setLoading(false);
        return;
      }

      const calcResults = geoJSON.features.map((f) =>
        calculateBuildingNoise({
          lwTotal,
          sourceLat: sourceLocation.lat,
          sourceLng: sourceLocation.lng,
          building: f.properties,
          barrierCoords: [],
          barrierHeight: useBarrier ? barrierHeight : 0,
          barrierD1: useBarrier ? barrierD1 : 0,
          barrierD2: useBarrier ? barrierD2 : 0,
          sufferingMonths,
        })
      );

      setBuildings({
        ...geoJSON,
        features: geoJSON.features.map((f, i) => ({
          ...f,
          properties: { ...f.properties, ...calcResults[i] },
        })),
      });
      setResults(calcResults.sort((a, b) => b.max_noise_db - a.max_noise_db));
    } catch (e) {
      setError(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exceeding = results.filter((r) => r.exceeds_65db);
  const totalComp = exceeding.reduce((s, r) => s + r.total_compensation, 0);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>

      {/* ══════════════ 왼쪽 입력 패널 ══════════════ */}
      <Box sx={{
        width: 360, flexShrink: 0, overflowY: 'auto', p: 1.5,
        borderRight: '1px solid #E0E0E0', background: '#F8F9FB',
        display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>

        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {/* ── STEP 1: 소음 발생 장비 ── */}
        <SectionCard icon="🔊" step={1} title="소음 발생 장비 선택">
          {equipments.map((eq, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>장비 종류</InputLabel>
                <Select value={eq.id} label="장비 종류"
                  onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}>
                  {EQUIPMENT_LIST.map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                      <Box>
                        <Typography variant="body2">{e.name}</Typography>
                        <Typography variant="caption" color="text.secondary">음향파워레벨 {e.Lw} dB</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField size="small" type="number" label="대수" sx={{ width: 70 }}
                value={eq.count} inputProps={{ min: 1, max: 30 }}
                onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, count: +e.target.value } : x))} />
              <IconButton size="small" color="error" disabled={equipments.length === 1}
                onClick={() => setEquipments((p) => p.filter((_, j) => j !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" startIcon={<AddIcon />} variant="outlined"
              onClick={() => setEquipments((p) => [...p, { id: 'crane', count: 1 }])}>
              장비 추가
            </Button>
            <Box sx={{ ml: 'auto', px: 1.5, py: 0.5, borderRadius: 2,
              background: lwColor, color: 'white', textAlign: 'center' }}>
              <Typography variant="caption" display="block" sx={{ opacity: 0.85 }}>합산 음향파워레벨</Typography>
              <Typography variant="h6" fontWeight={800} lineHeight={1.1}>{lwTotal.toFixed(1)} dB</Typography>
            </Box>
          </Box>
        </SectionCard>

        {/* ── STEP 2: 현장 위치 ── */}
        <SectionCard icon={<LocationOnIcon sx={{ fontSize: 16 }} />} step={2} title="공사 현장 위치 선택">
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            오른쪽 지도를 클릭하면 위치가 설정됩니다
          </Typography>
          {sourceLocation ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,
              p: 1, borderRadius: 1, background: '#E8F5E9', border: '1px solid #A5D6A7' }}>
              <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700} color="success.main">위치 설정 완료</Typography>
                <Typography variant="caption" color="text.secondary">
                  {sourceLocation.lat.toFixed(5)}, {sourceLocation.lng.toFixed(5)}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => { setSourceLocation(null); setResults([]); setBuildings(null); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ p: 1.5, borderRadius: 1, border: '2px dashed #90CAF9',
              textAlign: 'center', background: '#E3F2FD' }}>
              <LocationOnIcon sx={{ color: '#1565C0', fontSize: 28 }} />
              <Typography variant="body2" color="primary" fontWeight={600}>
                지도를 클릭하세요
              </Typography>
            </Box>
          )}
          <Box mt={1.5}>
            <Typography variant="caption" color="text.secondary">
              주변 건물 탐색 반경: <b>{radius}m</b>
            </Typography>
            <Slider value={radius} min={100} max={600} step={50} size="small"
              marks={[{ value: 100, label: '100m' }, { value: 300, label: '300m' }, { value: 600, label: '600m' }]}
              onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation((p) => ({ ...p, radius: v })); }}
              valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} />
          </Box>
        </SectionCard>

        {/* ── STEP 3: 방음벽 설정 ── */}
        <SectionCard icon={<FenceIcon sx={{ fontSize: 16 }} />} step={3} title="방음벽 설정">
          {/* 방음벽 사용 토글 */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Button size="small" variant={!useBarrier ? 'contained' : 'outlined'} color="inherit"
              sx={{ flex: 1 }} onClick={() => setUseBarrier(false)}>
              방음벽 없음
            </Button>
            <Button size="small" variant={useBarrier ? 'contained' : 'outlined'} color="warning"
              sx={{ flex: 1 }} onClick={() => setUseBarrier(true)}>
              방음벽 있음
            </Button>
          </Box>

          <Collapse in={useBarrier}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

              {/* 방음벽 높이 */}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                  방음벽 높이 (지면 기준)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Slider value={barrierHeight} min={1} max={12} step={0.5} size="small" sx={{ flex: 1 }}
                    onChange={(_, v) => setBarrierHeight(v)}
                    valueLabelDisplay="on" valueLabelFormat={(v) => `${v}m`} />
                  <TextField size="small" type="number" sx={{ width: 80 }}
                    value={barrierHeight} inputProps={{ min: 1, max: 12, step: 0.5 }}
                    InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                    onChange={(e) => setBarrierHeight(+e.target.value)} />
                </Box>
                <Typography variant="caption" color="primary.main">
                  ※ 방음벽 높이({barrierHeight}m)보다 낮은 층은 차음 효과 적용,
                  높은 층은 효과 감소
                </Typography>
              </Box>

              {/* 거리 입력 */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                    장비 → 방음벽 거리
                  </Typography>
                  <TextField size="small" type="number" fullWidth value={barrierD1}
                    inputProps={{ min: 1, max: 500 }}
                    InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                    onChange={(e) => setBarrierD1(Math.max(1, +e.target.value))} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                    방음벽 → 민원인 거리
                  </Typography>
                  <TextField size="small" type="number" fullWidth value={barrierD2}
                    inputProps={{ min: 1, max: 500 }}
                    InputProps={{ endAdornment: <Typography variant="caption">m</Typography> }}
                    onChange={(e) => setBarrierD2(Math.max(1, +e.target.value))} />
                </Box>
              </Box>

              {/* 방음벽 효과 미리보기 */}
              <BarrierPreview
                lwTotal={lwTotal} d1={barrierD1} d2={barrierD2} height={barrierHeight} />
            </Box>
          </Collapse>
        </SectionCard>

        {/* ── STEP 4: 공사 기간 ── */}
        <SectionCard icon={<CalendarMonthIcon sx={{ fontSize: 16 }} />} step={4} title="공사 기간 (보상금 산정)">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                작업 개월수
              </Typography>
              <Slider value={sufferingMonths} min={1} max={36} step={1} size="small"
                marks={[{ value: 1, label: '1개월' }, { value: 12, label: '1년' }, { value: 36, label: '3년' }]}
                onChange={(_, v) => setSufferingMonths(v)}
                valueLabelDisplay="on" valueLabelFormat={(v) => `${v}개월`} />
            </Box>
            <Box sx={{ width: 70, textAlign: 'center', p: 1, borderRadius: 1,
              background: '#E3F2FD', border: '1px solid #90CAF9' }}>
              <Typography variant="caption" color="primary" display="block">기간</Typography>
              <Typography variant="h6" fontWeight={800} color="primary">{sufferingMonths}</Typography>
              <Typography variant="caption" color="primary">개월</Typography>
            </Box>
          </Box>

          {/* 보상 기준 표 */}
          <Box sx={{ mt: 1, borderRadius: 1, overflow: 'hidden', border: '1px solid #E0E0E0' }}>
            <Box sx={{ px: 1, py: 0.5, background: '#455A64' }}>
              <Typography variant="caption" color="white" fontWeight={700}>
                환경분쟁조정위원회 보상 기준 (월/세대)
              </Typography>
            </Box>
            {COMP_TABLE.map((c) => (
              <Box key={c.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                px: 1, py: 0.4, background: c.bg, borderBottom: '1px solid #E0E0E0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                  <Typography variant="caption" fontWeight={600}>{c.range}</Typography>
                  <Typography variant="caption" color="text.secondary">({c.label})</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" fontWeight={700} color={c.color}>
                    ₩{c.monthly.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {sufferingMonths}개월 → ₩{(c.monthly * sufferingMonths).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </SectionCard>

        {/* ── 분석 버튼 ── */}
        <Button variant="contained" size="large" fullWidth
          sx={{ fontWeight: 800, fontSize: 16, py: 1.5, borderRadius: 2 }}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
          disabled={!sourceLocation || loading}
          onClick={handleCalculate}>
          {loading ? '주변 건물 분석 중...' : '소음 영향 분석 시작'}
        </Button>

        {/* ── 분석 결과 요약 ── */}
        {results.length > 0 && (
          <ResultSummary
            results={results}
            exceeding={exceeding}
            totalComp={totalComp}
            sufferingMonths={sufferingMonths}
            selectedId={selectedBuilding?.id}
            expandedId={expandedId}
            onSelect={(r) => {
              setSelectedBuilding(r);
              setExpandedId(expandedId === r.id ? null : r.id);
            }}
          />
        )}
      </Box>

      {/* ══════════════ 오른쪽 지도 ══════════════ */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <MapLibre3D
          sourceLocation={sourceLocation}
          barrierCoords={[]}
          buildingGeoJSON={buildings}
          drawMode={null}
          barrierHeight={barrierHeight}
          onSourceSet={handleSourceSet}
          onBarrierComplete={() => {}}
          onBuildingSelect={(props) => {
            if (!props) return;
            const r = results.find((r) => r.id === props.id);
            if (r) { setSelectedBuilding(r); setExpandedId(r.id); }
          }}
        />

        {/* 소음 범례 */}
        <Box sx={{ position: 'absolute', bottom: 32, right: 12,
          background: 'rgba(255,255,255,0.95)', borderRadius: 1.5, p: 1.2, boxShadow: 2 }}>
          <Typography variant="caption" fontWeight={700} display="block" mb={0.5} color="text.secondary">
            소음도 범례
          </Typography>
          {[['65dB 미만', '#90A4AE'], ['65~70dB', '#4CAF50'], ['70~75dB', '#FF9800'],
            ['75~80dB', '#F44336'], ['80dB 이상', '#9C27B0']].map(([l, c]) => (
            <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '3px', background: c }} />
              <Typography variant="caption">{l}</Typography>
            </Box>
          ))}
        </Box>

        {!sourceLocation && (
          <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(21,101,192,0.9)', color: 'white', borderRadius: 2, px: 2.5, py: 1.2,
            boxShadow: 3, textAlign: 'center' }}>
            <LocationOnIcon sx={{ fontSize: 20, mb: 0.3 }} />
            <Typography variant="body2" fontWeight={700} display="block">
              지도를 클릭하여 공사 현장 위치를 선택하세요
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── 방음벽 효과 미리보기 컴포넌트 ──────────────────────────────
function BarrierPreview({ lwTotal, d1, d2, height }) {
  const totalDist = d1 + d2;
  const Hs = 1.5;

  // 1층 (3m)과 고층 (height+3m) 예시
  const calcFloor = (Hr) => {
    const pathOver = Math.sqrt(d1 ** 2 + (height - Hs) ** 2) + Math.sqrt(d2 ** 2 + (height - Hr) ** 2);
    const pathDirect = Math.sqrt((d1 + d2) ** 2 + (Hs - Hr) ** 2);
    const delta = pathOver - pathDirect;
    if (delta <= 0) return 0;
    const N = (2 * delta) / 0.25;
    const loss = Math.min(10 * Math.log10(3 + 20 * N), 20);
    if (Hr < height + 0.5) return +loss.toFixed(1);
    const excess = Hr - height;
    return +Math.max(0, loss - excess * 2).toFixed(1);
  };

  const Adiv = 20 * Math.log10(Math.max(totalDist, 1)) + 11;
  const Aatm = 0.005 * totalDist;

  const floor1 = calcFloor(3);    // 1층 (3m)
  const floorHigh = calcFloor(height + 3);  // 방음벽보다 높은 층

  const noBar1 = +(lwTotal - Adiv - Aatm).toFixed(1);
  const withBar1 = +(noBar1 - floor1).toFixed(1);
  const withBarH = +(noBar1 - floorHigh).toFixed(1);

  return (
    <Box sx={{ p: 1, borderRadius: 1, background: '#FFF8E1', border: '1px solid #FFD54F' }}>
      <Typography variant="caption" fontWeight={700} color="warning.dark" display="block" mb={0.8}>
        🔍 방음벽 효과 미리보기 (거리 {d1+d2}m 기준)
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5, textAlign: 'center' }}>
        {[
          { label: '방음벽 없음', db: noBar1, sub: '전층 동일' },
          { label: `방음벽 이하 층`, db: withBar1, sub: `-${floor1}dB 감쇠` },
          { label: `방음벽 이상 층`, db: withBarH, sub: `${height}m 초과` },
        ].map(({ label, db, sub }) => (
          <Box key={label} sx={{ p: 0.5, borderRadius: 1, background: dbBg(db), border: `1px solid ${dbColor(db)}22` }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>{label}</Typography>
            <Typography variant="body2" fontWeight={800} color={dbColor(db)}>{db}dB</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{sub}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── 결과 요약 + 건물 목록 ──────────────────────────────────────
function ResultSummary({ results, exceeding, totalComp, sufferingMonths, selectedId, expandedId, onSelect }) {
  return (
    <Box>
      <Divider sx={{ mb: 1.5 }} />

      {/* 요약 카드 3개 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1.5 }}>
        {[
          { emoji: '🏘️', value: `${results.length}동`, label: '분석 건물', color: '#1565C0' },
          { emoji: '⚠️', value: `${exceeding.length}동`, label: '65dB 초과', color: '#D32F2F' },
          { emoji: '💰', value: `${(totalComp/10000).toFixed(0)}만`, label: `${sufferingMonths}개월 보상`, color: '#E65100' },
        ].map(({ emoji, value, label, color }) => (
          <Box key={label} sx={{ textAlign: 'center', p: 1, borderRadius: 1.5,
            border: '1px solid #E0E0E0', background: 'white' }}>
            <Typography fontSize={20}>{emoji}</Typography>
            <Typography variant="subtitle1" fontWeight={800} color={color}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={0.5}>
        건물을 클릭하면 층별 소음 상세 정보를 확인합니다
      </Typography>

      {/* 건물 목록 */}
      <Box sx={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {results.map((r) => {
          const isSelected = selectedId === r.id;
          const isExpanded = expandedId === r.id;
          const c = COMP_MAP[r.noise_level] || COMP_MAP.safe;

          return (
            <Box key={r.id}>
              <Box onClick={() => onSelect(r)}
                sx={{ p: 1, borderRadius: 1.5, cursor: 'pointer',
                  border: `1.5px solid ${isSelected ? '#1565C0' : '#E0E0E0'}`,
                  background: isSelected ? '#E3F2FD' : 'white',
                  '&:hover': { background: '#F5F5F5' } }}>

                {/* 건물명 + 소음 뱃지 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>{r.name || '건물'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.floors}층 건물 · 거리 {r.distance}m
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Box sx={{ px: 1, py: 0.2, borderRadius: 1, background: c.bg, border: `1px solid ${c.color}44` }}>
                      <Typography variant="body2" fontWeight={800} color={c.color}>
                        {r.max_noise_db} dB
                      </Typography>
                    </Box>
                    {r.exceeds_65db && (
                      <Typography variant="caption" fontWeight={700} color="error.main" display="block">
                        초과 {r.exceeding_floors}개층
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* 소음 Progress bar */}
                <Box sx={{ mt: 0.8, mb: 0.3 }}>
                  <LinearProgress variant="determinate"
                    value={Math.min(100, Math.max(0, (r.max_noise_db - 40) / 60 * 100))}
                    sx={{ height: 5, borderRadius: 3,
                      '& .MuiLinearProgress-bar': { background: dbColor(r.max_noise_db) },
                      background: '#E0E0E0' }} />
                </Box>

                {/* 보상금 + 펼치기 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {r.exceeds_65db ? (
                    <Typography variant="caption" fontWeight={700} color="error.main">
                      {sufferingMonths}개월 보상 ₩{r.total_compensation.toLocaleString()}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled">보상 대상 아님</Typography>
                  )}
                  {isExpanded ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
                </Box>
              </Box>

              {/* 층별 상세 */}
              <Collapse in={isExpanded}>
                <FloorTable building={r} sufferingMonths={sufferingMonths} />
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── 층별 소음 테이블 ──────────────────────────────────────────
function FloorTable({ building, sufferingMonths }) {
  const { floor_results = [], total_compensation, floors, distance, name } = building;
  const exceeding = floor_results.filter((f) => f.exceeds_65db);

  return (
    <Box sx={{ ml: 1, mr: 0, mb: 1, border: '1px solid #1565C0', borderRadius: 1.5, overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 0.8, background: '#1565C0', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ApartmentIcon sx={{ fontSize: 16 }} />
          <Typography variant="body2" fontWeight={700}>{name} — 층별 소음도</Typography>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          초과 {exceeding.length}/{floors}층
        </Typography>
      </Box>

      {/* 요약 */}
      <Box sx={{ px: 1.5, py: 0.8, background: '#E3F2FD', display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption">거리 {distance}m · {floors}층 건물</Typography>
        <Typography variant="caption" fontWeight={700} color="error.main">
          {sufferingMonths}개월 총 보상 ₩{total_compensation.toLocaleString()}
        </Typography>
      </Box>

      <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ '& th': { background: '#F5F5F5', py: 0.5, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' } }}>
              <TableCell>층</TableCell>
              <TableCell>높이</TableCell>
              <TableCell>소음도</TableCell>
              <TableCell>방음벽 감쇠</TableCell>
              <TableCell>{sufferingMonths}개월 보상</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {floor_results.map((f) => {
              const c = COMP_MAP[f.noise_level] || COMP_MAP.safe;
              return (
                <TableRow key={f.floor}
                  sx={{ background: f.exceeds_65db ? c.bg : 'transparent',
                    '& td': { py: 0.4, fontSize: 11 } }}>
                  <TableCell sx={{ fontWeight: 600 }}>{f.floor}층</TableCell>
                  <TableCell>{f.height_m}m</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <Typography variant="caption" fontWeight={800} color={c.color}>{f.noise_db}dB</Typography>
                    </Box>
                    {/* 인라인 바 */}
                    <Box sx={{ width: 48, height: 3, borderRadius: 2, background: '#E0E0E0', mt: 0.3 }}>
                      <Box sx={{ height: '100%', borderRadius: 2, background: c.color,
                        width: `${Math.min(100, Math.max(0, (f.noise_db - 40) / 60 * 100))}%` }} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    {f.A_barrier > 0 ? (
                      <Typography variant="caption" fontWeight={600} color="success.main">-{f.A_barrier}dB</Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {f.compensation > 0 ? (
                      <Typography variant="caption" fontWeight={700} color="error.main">
                        ₩{f.compensation.toLocaleString()}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">-</Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

// ── 공통 섹션 카드 ────────────────────────────────────────────
function SectionCard({ icon, step, title, children }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid #E0E0E0', borderRadius: 2 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
          <Box sx={{ width: 24, height: 24, borderRadius: '50%', background: '#1565C0',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{step}</Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}
