import { useState, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Slider,
  TextField, Chip, Divider, CircularProgress, Alert, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem,
  LinearProgress, Collapse, InputAdornment,
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
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();

const COMP_TABLE = [
  { key: 'level1', range: '65 ~ 70dB', monthly: 150000, color: '#4CAF50', bg: '#E8F5E9', label: '경미' },
  { key: 'level2', range: '70 ~ 75dB', monthly: 600000, color: '#FF9800', bg: '#FFF3E0', label: '보통' },
  { key: 'level3', range: '75 ~ 80dB', monthly: 666667, color: '#F44336', bg: '#FFEBEE', label: '심각' },
  { key: 'level4', range: '80dB 이상', monthly: 800000, color: '#9C27B0', bg: '#F3E5F5', label: '매우심각' },
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
  const [equipments, setEquipments] = useState([{ id: 'excavator', count: 2 }]);
  const [sourceLocation, setSourceLocation] = useState(null);
  const [radius, setRadius] = useState(300);

  // 방음벽
  const [useBarrier, setUseBarrier] = useState(false);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [barrierD1, setBarrierD1] = useState(10);
  const [barrierD2, setBarrierD2] = useState(50);
  const [barrierSegments, setBarrierSegments] = useState([]); // [[start,end],...]
  const [drawMode, setDrawMode] = useState(null); // null | 'barrier'

  const [sufferingMonths, setSufferingMonths] = useState(3);

  const [buildings, setBuildings] = useState(null);
  const [results, setResults] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lwTotal = useMemo(() => combineLw(equipments), [equipments]);
  const lwColor = lwTotal >= 115 ? '#9C27B0' : lwTotal >= 110 ? '#F44336' : lwTotal >= 105 ? '#FF9800' : '#1565C0';

  const allBarrierCoords = useMemo(() => barrierSegments.flatMap((s) => s), [barrierSegments]);

  const handleSourceSet = useCallback(({ lng, lat }) => {
    if (drawMode === 'barrier') return;
    setSourceLocation({ lng, lat, radius });
    setResults([]);
    setBuildings(null);
    setError('');
  }, [drawMode, radius]);

  const handleBarrierComplete = useCallback((coords) => {
    setBarrierSegments((prev) => [...prev, coords]);
  }, []);

  const handleCalculate = async () => {
    if (!sourceLocation) { setError('지도를 클릭해 공사 현장 위치를 선택하세요.'); return; }
    setLoading(true);
    setError('');
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
          barrierCoords: useBarrier ? allBarrierCoords : [],
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

      {/* ══ 왼쪽 패널 ══ */}
      <Box sx={{
        width: 380, flexShrink: 0, overflowY: 'auto', p: 1.5,
        borderRight: '1px solid #E0E0E0', background: '#F8F9FB',
      }}>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5 }}>{error}</Alert>}

        {/* ─ STEP 1: 장비 선택 ─ */}
        <SectionCard icon="🔊" step={1} title="소음 발생 장비 선택">
          {/* 장비 목록: 스크롤 가능 영역 */}
          <Box sx={{
            maxHeight: 260, overflowY: 'auto', pr: 0.5,
            display: 'flex', flexDirection: 'column', gap: 1, mb: 1,
          }}>
            {equipments.map((eq, i) => {
              const info = EQUIPMENT_LIST.find((e) => e.id === eq.id);
              const rowLw = info ? +(info.Lw + 10 * Math.log10(Math.max(eq.count, 1))).toFixed(1) : 0;
              return (
                <Box key={i} sx={{
                  display: 'flex', gap: 1, alignItems: 'flex-start',
                  p: 1, borderRadius: 1.5, border: '1px solid #E0E0E0', background: 'white',
                }}>
                  <Box sx={{ flex: 1 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>장비 종류</InputLabel>
                      <Select value={eq.id} label="장비 종류"
                        onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}>
                        {EQUIPMENT_LIST.map((e) => (
                          <MenuItem key={e.id} value={e.id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <Typography variant="body2">{e.name}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{e.Lw}dB</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <TextField size="small" type="number" label="대수" sx={{ width: 72 }}
                    value={eq.count} inputProps={{ min: 1, max: 30 }}
                    onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, count: +e.target.value } : x))} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Lw</Typography>
                    <Typography variant="caption" fontWeight={700} color={dbColor(rowLw - 60)}>
                      {rowLw}dB
                    </Typography>
                    <IconButton size="small" color="error" disabled={equipments.length === 1}
                      onClick={() => setEquipments((p) => p.filter((_, j) => j !== i))} sx={{ p: 0.3 }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" fullWidth
              onClick={() => setEquipments((p) => [...p, { id: 'crane', count: 1 }])}>
              장비 추가
            </Button>
            <Box sx={{ px: 1.5, py: 0.8, borderRadius: 2, background: lwColor, color: 'white',
              textAlign: 'center', minWidth: 110, flexShrink: 0 }}>
              <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>합산 Lw</Typography>
              <Typography variant="h6" fontWeight={800} lineHeight={1.1}>{lwTotal.toFixed(1)} dB</Typography>
            </Box>
          </Box>
        </SectionCard>

        {/* ─ STEP 2: 현장 위치 ─ */}
        <SectionCard icon={<LocationOnIcon sx={{ fontSize: 15 }} />} step={2} title="공사 현장 위치 선택">
          <Typography variant="body2" color="text.secondary" mb={1}>
            오른쪽 지도를 클릭하면 위치가 자동 설정됩니다
          </Typography>
          {sourceLocation ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1,
              background: '#E8F5E9', border: '1px solid #A5D6A7' }}>
              <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700} color="success.main">위치 설정 완료</Typography>
                <Typography variant="caption" color="text.secondary">
                  {sourceLocation.lat.toFixed(5)}, {sourceLocation.lng.toFixed(5)}
                </Typography>
              </Box>
              <IconButton size="small"
                onClick={() => { setSourceLocation(null); setResults([]); setBuildings(null); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ p: 1.5, borderRadius: 1, border: '2px dashed #90CAF9',
              textAlign: 'center', background: '#E3F2FD' }}>
              <LocationOnIcon sx={{ color: '#1565C0', fontSize: 28 }} />
              <Typography variant="body2" color="primary" fontWeight={600}>지도를 클릭하세요</Typography>
            </Box>
          )}
          <Box mt={1.5}>
            <Typography variant="caption" color="text.secondary">
              탐색 반경: <b>{radius}m</b>
            </Typography>
            <Slider value={radius} min={100} max={600} step={50} size="small"
              marks={[{ value: 100, label: '100m' }, { value: 300, label: '300m' }, { value: 600, label: '600m' }]}
              onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation((p) => ({ ...p, radius: v })); }}
              valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} />
          </Box>
        </SectionCard>

        {/* ─ STEP 3: 방음벽 ─ */}
        <SectionCard icon={<FenceIcon sx={{ fontSize: 15 }} />} step={3} title="방음벽 설정">
          {/* 없음/있음 */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Button size="small" fullWidth variant={!useBarrier ? 'contained' : 'outlined'}
              color={!useBarrier ? 'inherit' : 'inherit'}
              sx={{ background: !useBarrier ? '#455A64' : undefined, color: !useBarrier ? 'white' : undefined }}
              startIcon={<BlockIcon />}
              onClick={() => { setUseBarrier(false); setDrawMode(null); }}>
              방음벽 없음
            </Button>
            <Button size="small" fullWidth variant={useBarrier ? 'contained' : 'outlined'}
              color={useBarrier ? 'warning' : 'inherit'}
              startIcon={<FenceIcon />}
              onClick={() => setUseBarrier(true)}>
              방음벽 있음
            </Button>
          </Box>

          <Collapse in={useBarrier}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

              {/* 방음벽 높이 */}
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                  방음벽 높이
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Slider value={barrierHeight} min={1} max={12} step={0.5} size="small" sx={{ flex: 1 }}
                    onChange={(_, v) => setBarrierHeight(v)}
                    valueLabelDisplay="on" valueLabelFormat={(v) => `${v}m`} />
                  <TextField size="small" type="number" sx={{ width: 85 }}
                    value={barrierHeight} inputProps={{ min: 1, max: 12, step: 0.5 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                    onChange={(e) => setBarrierHeight(+e.target.value)} />
                </Box>
                <Typography variant="caption" color="warning.dark">
                  ※ {barrierHeight}m 이하 층 → 차음 효과 적용 / 이상 층 → 효과 감소
                </Typography>
              </Box>

              {/* 거리 입력 - 장비→방음벽 */}
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                  장비에서 방음벽까지 거리
                </Typography>
                <TextField size="small" type="number" fullWidth value={barrierD1}
                  inputProps={{ min: 1, max: 500 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="caption" color="text.secondary">d₁</Typography>
                      </InputAdornment>
                    ),
                  }}
                  placeholder="예: 10"
                  onChange={(e) => setBarrierD1(Math.max(1, +e.target.value))} />
              </Box>

              {/* 거리 입력 - 방음벽→민원인 */}
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                  방음벽에서 민원인까지 거리
                </Typography>
                <TextField size="small" type="number" fullWidth value={barrierD2}
                  inputProps={{ min: 1, max: 500 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="caption" color="text.secondary">d₂</Typography>
                      </InputAdornment>
                    ),
                  }}
                  placeholder="예: 50"
                  onChange={(e) => setBarrierD2(Math.max(1, +e.target.value))} />
              </Box>

              {/* 방음벽 지도에 그리기 */}
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                  방음벽 위치 (지도에 그리기)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button size="small" fullWidth
                    variant={drawMode === 'barrier' ? 'contained' : 'outlined'}
                    color={drawMode === 'barrier' ? 'warning' : 'inherit'}
                    startIcon={<EditIcon />}
                    onClick={() => setDrawMode(drawMode === 'barrier' ? null : 'barrier')}>
                    {drawMode === 'barrier' ? '그리기 중지' : '펜으로 그리기'}
                  </Button>
                  {barrierSegments.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip size="small" color="warning" label={`${barrierSegments.length}선`} />
                      <IconButton size="small" color="error" onClick={() => setBarrierSegments([])}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                {drawMode === 'barrier' && (
                  <Alert severity="warning" icon={false} sx={{ mt: 0.8, py: 0.5 }}>
                    <Typography variant="caption">
                      지도에서 <b>클릭 후 드래그</b>하여 방음벽 선을 그리세요
                    </Typography>
                  </Alert>
                )}
              </Box>

              {/* 방음벽 효과 미리보기 */}
              <BarrierPreview lwTotal={lwTotal} d1={barrierD1} d2={barrierD2} height={barrierHeight} />
            </Box>
          </Collapse>
        </SectionCard>

        {/* ─ STEP 4: 공사 기간 ─ */}
        <SectionCard icon={<CalendarMonthIcon sx={{ fontSize: 15 }} />} step={4} title="공사 기간 (보상금 산정 기준)">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Slider value={sufferingMonths} min={1} max={36} step={1} size="small"
                marks={[{ value: 1, label: '1개월' }, { value: 12, label: '1년' }, { value: 36, label: '3년' }]}
                onChange={(_, v) => setSufferingMonths(v)}
                valueLabelDisplay="on" valueLabelFormat={(v) => `${v}개월`} />
            </Box>
            <Box sx={{ width: 72, textAlign: 'center', p: 1, borderRadius: 1,
              background: '#E3F2FD', border: '1px solid #90CAF9', flexShrink: 0 }}>
              <Typography variant="caption" color="primary" display="block">기간</Typography>
              <Typography variant="h6" fontWeight={800} color="primary" lineHeight={1}>{sufferingMonths}</Typography>
              <Typography variant="caption" color="primary">개월</Typography>
            </Box>
          </Box>

          {/* 보상 기준표 */}
          <Box sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid #CFD8DC' }}>
            <Box sx={{ px: 1.2, py: 0.6, background: '#455A64' }}>
              <Typography variant="caption" color="white" fontWeight={700}>
                환경분쟁조정위원회 보상 기준 (월/세대)
              </Typography>
            </Box>
            {COMP_TABLE.map((c) => (
              <Box key={c.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                px: 1.2, py: 0.5, background: c.bg, borderBottom: '1px solid #E0E0E0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', background: c.color }} />
                  <Typography variant="caption" fontWeight={600}>{c.range}</Typography>
                  <Typography variant="caption" color="text.secondary">({c.label})</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" fontWeight={700} color={c.color} display="block">
                    월 ₩{c.monthly.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sufferingMonths}개월 → ₩{(c.monthly * sufferingMonths).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </SectionCard>

        {/* ─ 분석 버튼 ─ */}
        <Button variant="contained" size="large" fullWidth
          sx={{ fontWeight: 800, fontSize: 15, py: 1.5, borderRadius: 2, my: 0.5 }}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
          disabled={!sourceLocation || loading}
          onClick={handleCalculate}>
          {loading ? '주변 건물 분석 중...' : '소음 영향 분석 시작'}
        </Button>

        {/* ─ 결과 ─ */}
        {results.length > 0 && (
          <ResultList
            results={results} exceeding={exceeding} totalComp={totalComp}
            sufferingMonths={sufferingMonths} expandedId={expandedId}
            onToggle={(r) => setExpandedId(expandedId === r.id ? null : r.id)}
          />
        )}
      </Box>

      {/* ══ 오른쪽 지도 ══ */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <MapLibre3D
          sourceLocation={sourceLocation}
          barrierCoords={barrierSegments}
          buildingGeoJSON={buildings}
          drawMode={drawMode}
          barrierHeight={barrierHeight}
          onSourceSet={handleSourceSet}
          onBarrierComplete={handleBarrierComplete}
          onBuildingSelect={(props) => {
            if (!props) return;
            const r = results.find((r) => r.id === props.id);
            if (r) setExpandedId((prev) => prev === r.id ? null : r.id);
          }}
        />

        {/* 범례 */}
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

        {/* 안내 오버레이 */}
        {drawMode === 'barrier' && (
          <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(230,81,0,0.92)', color: 'white', borderRadius: 2, px: 2.5, py: 1,
            boxShadow: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2" fontWeight={700}>
              클릭 후 드래그하여 방음벽을 그리세요 — 완료 후 "그리기 중지" 클릭
            </Typography>
          </Box>
        )}
        {!sourceLocation && drawMode !== 'barrier' && (
          <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(21,101,192,0.9)', color: 'white', borderRadius: 2, px: 2.5, py: 1,
            boxShadow: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOnIcon sx={{ fontSize: 20 }} />
            <Typography variant="body2" fontWeight={700}>지도를 클릭하여 공사 현장 위치를 선택하세요</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ─── 방음벽 효과 미리보기 ─────────────────────────────────── */
function BarrierPreview({ lwTotal, d1, d2, height }) {
  const Hs = 1.5;
  const calcAbar = (Hr) => {
    const pathOver = Math.sqrt(d1 ** 2 + (height - Hs) ** 2) + Math.sqrt(d2 ** 2 + (height - Hr) ** 2);
    const pathDirect = Math.sqrt((d1 + d2) ** 2 + (Hs - Hr) ** 2);
    const delta = pathOver - pathDirect;
    if (delta <= 0) return 0;
    const N = (2 * delta) / 0.25;
    const loss = Math.min(10 * Math.log10(3 + 20 * N), 20);
    if (Hr < height + 0.5) return +loss.toFixed(1);
    return +Math.max(0, loss - (Hr - height) * 2).toFixed(1);
  };

  const totalDist = d1 + d2;
  const Adiv = 20 * Math.log10(Math.max(totalDist, 1)) + 11;
  const Aatm = 0.005 * totalDist;
  const baseNoise = +(lwTotal - Adiv - Aatm).toFixed(1);

  const abar1 = calcAbar(3);
  const abarH = calcAbar(height + 3);
  const withBar1 = +(baseNoise - abar1).toFixed(1);
  const withBarH = +(baseNoise - abarH).toFixed(1);

  return (
    <Box sx={{ p: 1.2, borderRadius: 1, background: '#FFF8E1', border: '1px solid #FFD54F' }}>
      <Typography variant="caption" fontWeight={700} color="warning.dark" display="block" mb={1}>
        📊 방음벽 효과 미리보기 (총 {totalDist}m 거리 기준)
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.8, textAlign: 'center' }}>
        {[
          { label: '방음벽 없음', db: baseNoise, sub: '기준 소음' },
          { label: `벽 이하 층`, db: withBar1, sub: `-${abar1}dB` },
          { label: `벽 이상 층`, db: withBarH, sub: `${height}m 초과` },
        ].map(({ label, db, sub }) => (
          <Box key={label} sx={{ p: 0.8, borderRadius: 1, background: dbBg(db),
            border: `1px solid ${dbColor(db)}33` }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', display: 'block' }}>{label}</Typography>
            <Typography variant="body2" fontWeight={800} color={dbColor(db)}>{db}dB</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{sub}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ─── 결과 목록 ──────────────────────────────────────────── */
function ResultList({ results, exceeding, totalComp, sufferingMonths, expandedId, onToggle }) {
  return (
    <Box>
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1.5 }}>
        {[
          { emoji: '🏘️', value: `${results.length}동`, label: '분석 건물', color: '#1565C0' },
          { emoji: '⚠️', value: `${exceeding.length}동`, label: '65dB 초과', color: '#D32F2F' },
          { emoji: '💰', value: `${(totalComp / 10000).toFixed(0)}만`, label: `${sufferingMonths}개월 보상`, color: '#E65100' },
        ].map(({ emoji, value, label, color }) => (
          <Box key={label} sx={{ textAlign: 'center', p: 1, borderRadius: 1.5,
            border: '1px solid #E0E0E0', background: 'white' }}>
            <Typography fontSize={18}>{emoji}</Typography>
            <Typography variant="subtitle1" fontWeight={800} color={color}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
        ▼ 건물 클릭 시 층별 소음 상세 보기
      </Typography>

      <Box sx={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {results.map((r) => {
          const isExpanded = expandedId === r.id;
          const c = COMP_MAP[r.noise_level] || COMP_MAP.safe;
          return (
            <Box key={r.id}>
              <Box onClick={() => onToggle(r)}
                sx={{ p: 1, borderRadius: 1.5, cursor: 'pointer',
                  border: `1.5px solid ${isExpanded ? '#1565C0' : '#E0E0E0'}`,
                  background: isExpanded ? '#E3F2FD' : 'white',
                  '&:hover': { background: '#F5F5F5' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>{r.name || '건물'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.floors}층 · 거리 {r.distance}m
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Box sx={{ px: 1, py: 0.2, borderRadius: 1, background: c.bg }}>
                      <Typography variant="body2" fontWeight={800} color={c.color}>
                        {r.max_noise_db} dB
                      </Typography>
                    </Box>
                    {r.exceeds_65db && (
                      <Typography variant="caption" fontWeight={700} color="error.main" display="block">
                        초과 {r.exceeding_floors}층
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ mt: 0.8 }}>
                  <LinearProgress variant="determinate"
                    value={Math.min(100, Math.max(0, (r.max_noise_db - 40) / 60 * 100))}
                    sx={{ height: 5, borderRadius: 3,
                      '& .MuiLinearProgress-bar': { background: dbColor(r.max_noise_db) },
                      background: '#E0E0E0' }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.4 }}>
                  {r.exceeds_65db ? (
                    <Typography variant="caption" fontWeight={700} color="error.main">
                      ₩{r.total_compensation.toLocaleString()} ({sufferingMonths}개월)
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled">보상 대상 아님</Typography>
                  )}
                  {isExpanded ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
                </Box>
              </Box>

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

/* ─── 층별 소음 테이블 ──────────────────────────────────── */
function FloorTable({ building, sufferingMonths }) {
  const { floor_results = [], total_compensation, floors, distance, name } = building;
  const exceeding = floor_results.filter((f) => f.exceeds_65db);

  return (
    <Box sx={{ ml: 1, mb: 1, border: '1px solid #1565C0', borderRadius: 1.5, overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 0.8, background: '#1565C0', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ApartmentIcon sx={{ fontSize: 16 }} />
          <Typography variant="body2" fontWeight={700}>{name} — 층별 소음</Typography>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>초과 {exceeding.length}/{floors}층</Typography>
      </Box>
      <Box sx={{ px: 1.5, py: 0.6, background: '#E3F2FD', display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption">{distance}m · {floors}층 건물</Typography>
        <Typography variant="caption" fontWeight={700} color="error.main">
          {sufferingMonths}개월 총 ₩{total_compensation.toLocaleString()}
        </Typography>
      </Box>
      <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ '& th': { background: '#F5F5F5', py: 0.5, fontSize: 11, fontWeight: 700 } }}>
              <TableCell>층</TableCell>
              <TableCell>높이</TableCell>
              <TableCell>소음도</TableCell>
              <TableCell>방음벽 감쇠</TableCell>
              <TableCell>보상금</TableCell>
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
                    <Box sx={{ width: 48, height: 3, borderRadius: 2, background: '#E0E0E0', mt: 0.3 }}>
                      <Box sx={{ height: '100%', borderRadius: 2, background: c.color,
                        width: `${Math.min(100, Math.max(0, (f.noise_db - 40) / 60 * 100))}%` }} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    {f.A_barrier > 0
                      ? <Typography variant="caption" fontWeight={600} color="success.main">-{f.A_barrier}dB</Typography>
                      : <Typography variant="caption" color="text.disabled">-</Typography>}
                  </TableCell>
                  <TableCell>
                    {f.compensation > 0
                      ? <Typography variant="caption" fontWeight={700} color="error.main">
                          ₩{f.compensation.toLocaleString()}
                        </Typography>
                      : <Typography variant="caption" color="text.disabled">-</Typography>}
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

/* ─── 섹션 카드 래퍼 ────────────────────────────────────── */
function SectionCard({ icon, step, title, children }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid #E0E0E0', borderRadius: 2, mb: 1.5 }}>
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
