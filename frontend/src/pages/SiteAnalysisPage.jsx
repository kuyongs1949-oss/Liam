import { useState, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Slider,
  TextField, Chip, Divider, CircularProgress, Alert, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem, Tooltip,
} from '@mui/material';
import FenceIcon from '@mui/icons-material/Fence';
import CalculateIcon from '@mui/icons-material/Calculate';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();

// 환경분쟁조정위원회 보상 기준 (월/세대)
const COMP_STD = {
  level1: { label: '65~70dB', color: '#4CAF50', bg: '#E8F5E9', desc: '경미한 생활방해', monthly: 150000 },
  level2: { label: '70~75dB', color: '#FF9800', bg: '#FFF3E0', desc: '보통 생활방해',   monthly: 600000 },
  level3: { label: '75~80dB', color: '#F44336', bg: '#FFEBEE', desc: '심각한 생활방해', monthly: 666667 },
  level4: { label: '80dB 이상', color: '#9C27B0', bg: '#F3E5F5', desc: '매우 심각',     monthly: 800000 },
  safe:   { label: '65dB 미만', color: '#2196F3', bg: '#E3F2FD', desc: '보상 대상 아님', monthly: 0 },
};

function getNoiseBarColor(db) {
  if (db < 65) return '#2196F3';
  if (db < 70) return '#4CAF50';
  if (db < 75) return '#FF9800';
  if (db < 80) return '#F44336';
  return '#9C27B0';
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
  const [sourceLocation, setSourceLocation] = useState(null);
  const [radius, setRadius] = useState(300);
  const [equipments, setEquipments] = useState([{ id: 'excavator', count: 2 }]);
  const [barrierSegments, setBarrierSegments] = useState([]);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [barrierD1, setBarrierD1] = useState(10);   // 장비 → 방음벽 거리(m)
  const [barrierD2, setBarrierD2] = useState(50);   // 방음벽 → 민원인 거리(m)
  const [sufferingMonths, setSufferingMonths] = useState(3);
  const [drawMode, setDrawMode] = useState(null);
  const [buildings, setBuildings] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lwTotal = useMemo(() => combineLw(equipments), [equipments]);
  const hasBarrier = barrierSegments.length > 0;

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

  const allBarrierCoords = useMemo(() => barrierSegments.flatMap((s) => s), [barrierSegments]);

  const handleCalculate = async () => {
    if (!sourceLocation) { setError('지도를 클릭해 공사 현장 위치를 선택하세요.'); return; }
    setLoading(true);
    setError('');
    try {
      const geoJSON = await queryBuildings(sourceLocation.lat, sourceLocation.lng, radius);
      if (geoJSON.features.length === 0) {
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
          barrierCoords: allBarrierCoords,
          barrierHeight,
          barrierD1: hasBarrier ? barrierD1 : 0,
          barrierD2: hasBarrier ? barrierD2 : 0,
          sufferingMonths,
        })
      );

      const coloredGeoJSON = {
        ...geoJSON,
        features: geoJSON.features.map((f, i) => ({
          ...f,
          properties: { ...f.properties, ...calcResults[i], color: calcResults[i].color },
        })),
      };

      setBuildings(coloredGeoJSON);
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

      {/* ── 왼쪽 패널 ── */}
      <Box sx={{ width: 340, flexShrink: 0, overflowY: 'auto', p: 1.5, borderRight: '1px solid #E0E0E0', background: '#FAFAFA' }}>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}

        <Alert severity="info" icon={false} sx={{ mb: 1.5, py: 0.5 }}>
          <Typography variant="caption">
            ① 장비 선택 → ② 지도 클릭(현장) → ③ 방음벽 설정 → ④ 분석
          </Typography>
        </Alert>

        {/* STEP 1: 장비 */}
        <StepCard step={1} title="소음 발생 장비">
          {equipments.map((eq, i) => (
            <Box key={i} display="flex" gap={1} mb={1} alignItems="center">
              <FormControl size="small" sx={{ flex: 2 }}>
                <InputLabel>장비</InputLabel>
                <Select value={eq.id} label="장비"
                  onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}>
                  {EQUIPMENT_LIST.map((e) => (
                    <MenuItem key={e.id} value={e.id}>{e.name} ({e.Lw}dB)</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField size="small" type="number" label="대수" sx={{ width: 64 }}
                value={eq.count} inputProps={{ min: 1, max: 20 }}
                onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, count: +e.target.value } : x))} />
              <IconButton size="small" color="error" disabled={equipments.length === 1}
                onClick={() => setEquipments((p) => p.filter((_, j) => j !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box display="flex" alignItems="center" gap={1}>
            <Button size="small" startIcon={<AddIcon />}
              onClick={() => setEquipments((p) => [...p, { id: 'crane', count: 1 }])}>장비 추가</Button>
            <Chip size="small" label={`합산 Lw: ${lwTotal.toFixed(1)} dB`} color="primary" />
          </Box>
        </StepCard>

        {/* STEP 2: 현장 위치 + 반경 */}
        <StepCard step={2} title="공사 현장 위치">
          <Typography variant="body2" color="text.secondary" mb={1}>
            지도를 클릭하면 위치가 자동 설정됩니다
          </Typography>
          {sourceLocation ? (
            <Chip size="small" color="success" icon={<CheckCircleIcon />}
              label={`${sourceLocation.lat.toFixed(4)}, ${sourceLocation.lng.toFixed(4)}`}
              onDelete={() => { setSourceLocation(null); setResults([]); setBuildings(null); }} />
          ) : (
            <Chip size="small" label="지도를 클릭하세요" variant="outlined" />
          )}
          <Box mt={1.5}>
            <Typography variant="caption">탐색 반경: {radius}m</Typography>
            <Slider value={radius} min={100} max={600} step={50}
              marks={[{ value: 100, label: '100m' }, { value: 300, label: '300m' }, { value: 600, label: '600m' }]}
              onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation((p) => ({ ...p, radius: v })); }}
              valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} size="small" />
          </Box>
        </StepCard>

        {/* STEP 3: 방음벽 */}
        <StepCard step={3} title="방음벽 설정 (선택)">
          <Box display="flex" gap={1} mb={1.5} alignItems="center">
            <Button size="small" variant={drawMode === 'barrier' ? 'contained' : 'outlined'}
              color={drawMode === 'barrier' ? 'warning' : 'inherit'}
              startIcon={<FenceIcon />}
              onClick={() => setDrawMode(drawMode === 'barrier' ? null : 'barrier')}>
              {drawMode === 'barrier' ? '그리기 완료' : '방음벽 그리기'}
            </Button>
            {barrierSegments.length > 0 && (
              <>
                <Chip size="small" color="warning" label={`${barrierSegments.length}개 선분`} />
                <IconButton size="small" color="error" onClick={() => setBarrierSegments([])}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
          {drawMode === 'barrier' && (
            <Alert severity="warning" icon={false} sx={{ py: 0.5, mb: 1 }}>
              <Typography variant="caption">지도에서 <b>클릭 후 드래그</b>하면 방음벽이 그려집니다</Typography>
            </Alert>
          )}

          <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1}>
            <LabeledInput label="방음벽 높이" unit="m" value={barrierHeight} min={1} max={15} step={0.5}
              onChange={setBarrierHeight}
              tooltip="방음벽 상단 높이 (지면 기준)" />
            <LabeledInput label="장비→벽 거리" unit="m" value={barrierD1} min={1} max={500} step={1}
              onChange={setBarrierD1} disabled={!hasBarrier}
              tooltip="장비 위치에서 방음벽까지 수평 거리 (m)" />
            <LabeledInput label="벽→민원인" unit="m" value={barrierD2} min={1} max={500} step={1}
              onChange={setBarrierD2} disabled={!hasBarrier}
              tooltip="방음벽에서 민원인 아파트까지 수평 거리 (m)" />
          </Box>
          {!hasBarrier && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              ※ 방음벽을 그리면 거리 입력이 활성화됩니다
            </Typography>
          )}
        </StepCard>

        {/* STEP 4: 작업 기간 */}
        <StepCard step={4} title="공사 기간">
          <Box display="flex" alignItems="center" gap={1.5}>
            <TextField size="small" type="number" label="작업 개월수" sx={{ width: 110 }}
              value={sufferingMonths} inputProps={{ min: 1, max: 36 }}
              onChange={(e) => setSufferingMonths(Math.max(1, Math.min(36, +e.target.value)))} />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                보상금 = 월 기준 × 개월수
              </Typography>
              <Typography variant="caption" color="text.secondary">
                (환경분쟁조정위원회 기준)
              </Typography>
            </Box>
          </Box>
        </StepCard>

        {/* 분석 버튼 */}
        <Button variant="contained" fullWidth size="large" sx={{ mb: 1.5, fontWeight: 700 }}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
          disabled={!sourceLocation || loading}
          onClick={handleCalculate}>
          {loading ? '건물 분석 중...' : '주변 건물 소음 분석'}
        </Button>

        {/* 보상 기준 안내 */}
        <Card variant="outlined" sx={{ mb: 1.5 }}>
          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
              환경분쟁조정위원회 보상 기준 (월/세대)
            </Typography>
            {Object.entries(COMP_STD).filter(([k]) => k !== 'safe').map(([k, v]) => (
              <Box key={k} display="flex" justifyContent="space-between" alignItems="center" mb={0.3}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: v.color }} />
                  <Typography variant="caption">{v.label}</Typography>
                </Box>
                <Typography variant="caption" fontWeight={700}>
                  ₩{v.monthly.toLocaleString()}/월
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>

        {/* 결과 요약 */}
        {results.length > 0 && (
          <>
            <Divider sx={{ mb: 1 }} />
            <Box display="flex" gap={1} mb={1.5}>
              {[
                { icon: '🏘️', label: `${results.length}동`, sub: '조회 건물' },
                { icon: '⚠️', label: `${exceeding.length}동`, sub: '65dB 초과', red: true },
                { icon: '💰', label: `${(totalComp / 10000).toFixed(0)}만원`, sub: `${sufferingMonths}개월`, warn: true },
              ].map(({ icon, label, sub, red, warn }) => (
                <Box key={sub} sx={{ flex: 1, textAlign: 'center', p: 0.8, borderRadius: 1,
                  border: '1px solid #E0E0E0', background: 'white' }}>
                  <Typography fontSize={18}>{icon}</Typography>
                  <Typography variant="body2" fontWeight={700}
                    color={red ? 'error.main' : warn ? 'warning.main' : 'text.primary'}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{sub}</Typography>
                </Box>
              ))}
            </Box>

            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={0.5}>
              건물 클릭 → 층별 소음 상세
            </Typography>

            <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
              {results.slice(0, 50).map((r) => {
                const lvl = COMP_STD[r.noise_level] || COMP_STD.safe;
                const sel = selectedBuilding?.id === r.id;
                return (
                  <Box key={r.id} onClick={() => setSelectedBuilding(sel ? null : r)}
                    sx={{ p: 0.8, mb: 0.5, borderRadius: 1, cursor: 'pointer',
                      border: `1px solid ${sel ? '#1565C0' : '#E0E0E0'}`,
                      background: sel ? '#E3F2FD' : 'white', '&:hover': { background: '#F5F5F5' } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 170 }}>
                        {r.name || '건물'}
                      </Typography>
                      <Chip size="small" label={`${r.max_noise_db}dB`}
                        sx={{ background: lvl.bg, color: lvl.color, fontWeight: 700, fontSize: '0.7rem' }} />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        {r.floors}층 · {r.distance}m · {r.exceeding_floors}개층 초과
                      </Typography>
                      {r.exceeds_65db && (
                        <Typography variant="caption" fontWeight={700} color="error.main">
                          ₩{r.total_compensation.toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                    {/* 소음 막대 */}
                    <Box sx={{ mt: 0.5, height: 4, borderRadius: 2, background: '#E0E0E0', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%',
                        width: `${Math.min(100, Math.max(0, (r.max_noise_db - 40) / 60 * 100))}%`,
                        background: getNoiseBarColor(r.max_noise_db), borderRadius: 2, transition: 'width 0.3s' }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {selectedBuilding && (
              <FloorDetail building={selectedBuilding} sufferingMonths={sufferingMonths} />
            )}
          </>
        )}
      </Box>

      {/* ── 3D 지도 ── */}
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
            setSelectedBuilding(r || null);
          }}
        />

        {/* 범례 */}
        <Box sx={{ position: 'absolute', bottom: 32, right: 12, background: 'rgba(255,255,255,0.92)',
          borderRadius: 1, p: 1, boxShadow: 1 }}>
          <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>소음도 범례</Typography>
          {[['< 65dB', '#2196F3'], ['65~70', '#4CAF50'], ['70~75', '#FF9800'], ['75~80', '#F44336'], ['> 80dB', '#9C27B0']].map(([l, c]) => (
            <Box key={l} display="flex" alignItems="center" gap={0.5} mb={0.3}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
              <Typography variant="caption">{l}</Typography>
            </Box>
          ))}
        </Box>

        {drawMode === 'barrier' && (
          <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.75)', color: 'white', borderRadius: 2, px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>🖊️ 클릭 후 드래그하여 방음벽을 그리세요</Typography>
          </Box>
        )}
        {!sourceLocation && (
          <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(21,101,192,0.85)', color: 'white', borderRadius: 2, px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>📍 지도를 클릭하여 공사 현장 위치를 선택하세요</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── 헬퍼 컴포넌트 ─────────────────────────────────────────────

function StepCard({ step, title, children }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: '#1565C0',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{step}</Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function LabeledInput({ label, unit, value, min, max, step, onChange, disabled, tooltip }) {
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={0.3} mb={0.3}>
        <Typography variant="caption" color={disabled ? 'text.disabled' : 'text.secondary'} noWrap>
          {label}
        </Typography>
        {tooltip && (
          <Tooltip title={tooltip} placement="top">
            <InfoOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        )}
      </Box>
      <TextField size="small" type="number" fullWidth disabled={disabled}
        value={value} inputProps={{ min, max, step }}
        InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">{unit}</Typography> }}
        onChange={(e) => onChange(Math.max(min, Math.min(max, +e.target.value)))} />
    </Box>
  );
}

function FloorDetail({ building, sufferingMonths }) {
  const { floor_results = [], name, floors, distance, total_compensation } = building;
  const exceeding = floor_results.filter((f) => f.exceeds_65db);

  return (
    <Card sx={{ mt: 1, border: '1px solid #1565C0' }}>
      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Typography variant="subtitle2" fontWeight={700}>{name} — 층별 소음도</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
          {floors}층 · {distance}m · 초과 {exceeding.length}개층 ·{' '}
          <b style={{ color: '#D32F2F' }}>{sufferingMonths}개월 보상 ₩{total_compensation.toLocaleString()}</b>
        </Typography>
        <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { background: '#F5F5F5', py: 0.4, fontSize: 11, fontWeight: 700 } }}>
                {['층', '높이', '소음도', '방음벽 감쇠', `보상금 (${sufferingMonths}개월)`].map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {floor_results.map((f) => {
                const lvl = COMP_STD[f.noise_level] || COMP_STD.safe;
                return (
                  <TableRow key={f.floor}
                    sx={{ background: f.exceeds_65db ? lvl.bg : 'transparent',
                      '& td': { py: 0.25, fontSize: 11 } }}>
                    <TableCell>{f.floor}층</TableCell>
                    <TableCell>{f.height_m}m</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: lvl.color, flexShrink: 0 }} />
                        <Typography variant="caption" fontWeight={700} color={lvl.color}>
                          {f.noise_db}dB
                        </Typography>
                      </Box>
                      <Box sx={{ width: 50, height: 3, borderRadius: 1, background: '#E0E0E0', mt: 0.3 }}>
                        <Box sx={{ height: '100%',
                          width: `${Math.min(100, Math.max(0, (f.noise_db - 40) / 60 * 100))}%`,
                          background: lvl.color, borderRadius: 1 }} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      {f.A_barrier > 0
                        ? <Typography variant="caption" color="success.main">-{f.A_barrier}dB</Typography>
                        : <Typography variant="caption" color="text.disabled">없음</Typography>}
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
      </CardContent>
    </Card>
  );
}
