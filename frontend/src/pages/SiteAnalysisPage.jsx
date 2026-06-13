import { useState, useCallback, useMemo } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Slider,
  TextField, Chip, Divider, CircularProgress, Alert, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, Tooltip,
  FormControl, InputLabel, Select, MenuItem, Badge,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import FenceIcon from '@mui/icons-material/Fence';
import CalculateIcon from '@mui/icons-material/Calculate';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import UndoIcon from '@mui/icons-material/Undo';
import AddIcon from '@mui/icons-material/Add';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();
const COMPENSATION = {
  level1: { label: '경미', color: '#4CAF50', bg: '#E8F5E9' },
  level2: { label: '보통', color: '#FF9800', bg: '#FFF3E0' },
  level3: { label: '심각', color: '#F44336', bg: '#FFEBEE' },
  level4: { label: '매우심각', color: '#9C27B0', bg: '#F3E5F5' },
  safe:   { label: '안전', color: '#2196F3', bg: '#E3F2FD' },
};

function combineEquipments(list) {
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
  const [barrierCoords, setBarrierCoords] = useState([]);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [drawMode, setDrawMode] = useState(null); // null | 'source' | 'barrier'
  const [buildings, setBuildings] = useState(null); // GeoJSON
  const [results, setResults] = useState([]); // 계산 결과 배열
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const lwTotal = useMemo(() => combineEquipments(equipments), [equipments]);

  // 지도 클릭 핸들러
  const handleMapClick = useCallback(({ lng, lat }) => {
    if (drawMode === 'source') {
      setSourceLocation({ lng, lat, radius });
      setDrawMode(null);
      setStep(2);
      setResults([]);
      setBuildings(null);
      setBarrierCoords([]);
    } else if (drawMode === 'barrier') {
      setBarrierCoords((prev) => [...prev, [lng, lat]]);
    }
  }, [drawMode, radius]);

  // 방음벽 그리기 완료
  const finishBarrier = () => {
    setDrawMode(null);
    if (barrierCoords.length < 2) setBarrierCoords([]);
  };

  // 계산 실행
  const handleCalculate = async () => {
    if (!sourceLocation) { setError('먼저 공사 현장 위치를 선택하세요.'); return; }
    if (equipments.length === 0) { setError('장비를 하나 이상 선택하세요.'); return; }

    setLoading(true);
    setError('');
    try {
      const geoJSON = await queryBuildings(sourceLocation.lat, sourceLocation.lng, radius);

      if (geoJSON.features.length === 0) {
        setError('주변에 건물 데이터가 없습니다. 반경을 늘려보세요.');
        setLoading(false);
        return;
      }

      // 각 건물 층별 소음 계산
      const calcResults = geoJSON.features.map((f) =>
        calculateBuildingNoise({
          lwTotal,
          sourceLat: sourceLocation.lat,
          sourceLng: sourceLocation.lng,
          building: f.properties,
          barrierCoords,
          barrierHeight,
        })
      );

      // GeoJSON에 색상 반영
      const coloredGeoJSON = {
        ...geoJSON,
        features: geoJSON.features.map((f, i) => ({
          ...f,
          properties: { ...f.properties, color: calcResults[i].color, height: calcResults[i].height || f.properties.height },
        })),
      };

      setBuildings(coloredGeoJSON);
      setResults(calcResults.sort((a, b) => b.max_noise_db - a.max_noise_db));
      setStep(4);
    } catch (e) {
      setError(`건물 데이터 조회 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exceeding = results.filter((r) => r.exceeds_65db);
  const totalComp = exceeding.reduce((s, r) => s + r.total_compensation_3m, 0);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 0 }}>
      {/* ── 왼쪽 패널 ── */}
      <Box sx={{ width: 340, flexShrink: 0, overflowY: 'auto', p: 1.5, borderRight: '1px solid #E0E0E0', background: '#FAFAFA' }}>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}

        {/* Step 1: 현장 선택 */}
        <StepCard step={1} current={step} title="공사 현장 선택">
          <Typography variant="body2" color="text.secondary" mb={1}>
            버튼을 누른 후 지도를 클릭하세요
          </Typography>
          <Button
            variant={drawMode === 'source' ? 'contained' : 'outlined'}
            startIcon={<MyLocationIcon />}
            fullWidth
            color={drawMode === 'source' ? 'error' : 'primary'}
            onClick={() => setDrawMode(drawMode === 'source' ? null : 'source')}
            sx={{ mb: 1 }}
          >
            {drawMode === 'source' ? '클릭 취소' : '현장 위치 클릭'}
          </Button>
          {sourceLocation && (
            <Chip size="small" color="success" icon={<CheckCircleIcon />}
              label={`${sourceLocation.lat.toFixed(5)}, ${sourceLocation.lng.toFixed(5)}`} />
          )}
          <Typography variant="caption" display="block" mt={1}>탐색 반경</Typography>
          <Slider value={radius} min={100} max={600} step={50}
            marks={[{value:100,label:'100m'},{value:300,label:'300m'},{value:600,label:'600m'}]}
            onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation({...sourceLocation, radius: v}); }}
            valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} size="small" />
        </StepCard>

        {/* Step 2: 장비 선택 */}
        <StepCard step={2} current={step} title="소음 장비 선택">
          {equipments.map((eq, i) => (
            <Box key={i} display="flex" gap={1} mb={1} alignItems="center">
              <FormControl size="small" sx={{ flex: 2 }}>
                <InputLabel>장비</InputLabel>
                <Select value={eq.id} label="장비"
                  onChange={(e) => setEquipments((prev) => prev.map((p, j) => j === i ? { ...p, id: e.target.value } : p))}>
                  {EQUIPMENT_LIST.map((e) => (
                    <MenuItem key={e.id} value={e.id}>{e.name} ({e.Lw}dB)</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField size="small" type="number" label="대수" sx={{ width: 60 }}
                value={eq.count} inputProps={{ min: 1, max: 20 }}
                onChange={(e) => setEquipments((prev) => prev.map((p, j) => j === i ? { ...p, count: +e.target.value } : p))} />
              <IconButton size="small" color="error" disabled={equipments.length === 1}
                onClick={() => setEquipments((prev) => prev.filter((_, j) => j !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />}
            onClick={() => { setEquipments((prev) => [...prev, { id: 'excavator', count: 1 }]); if (step < 2) setStep(2); }}>
            장비 추가
          </Button>
          <Chip size="small" label={`합산 Lw: ${lwTotal.toFixed(1)} dB`} color="primary" sx={{ ml: 1 }} />
        </StepCard>

        {/* Step 3: 방음벽 */}
        <StepCard step={3} current={step} title="방음벽 설정 (선택)">
          <Box display="flex" gap={1} mb={1}>
            <Button size="small" variant={drawMode === 'barrier' ? 'contained' : 'outlined'}
              color={drawMode === 'barrier' ? 'warning' : 'inherit'}
              startIcon={<FenceIcon />}
              onClick={() => { setDrawMode(drawMode === 'barrier' ? null : 'barrier'); setStep(Math.max(step, 3)); }}>
              {drawMode === 'barrier' ? '그리는 중...' : '방음벽 그리기'}
            </Button>
            {drawMode === 'barrier' && (
              <Button size="small" variant="contained" color="success" onClick={finishBarrier}>완료</Button>
            )}
            {barrierCoords.length > 0 && (
              <IconButton size="small" color="warning" onClick={() => { setBarrierCoords((p) => p.slice(0,-1)); }}>
                <UndoIcon fontSize="small" />
              </IconButton>
            )}
            {barrierCoords.length > 0 && (
              <IconButton size="small" color="error" onClick={() => setBarrierCoords([])}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          {barrierCoords.length >= 2 && (
            <Chip size="small" color="warning" label={`방음벽 ${barrierCoords.length - 1}구간`} sx={{ mb: 1 }} />
          )}
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption">방음벽 높이:</Typography>
            <TextField size="small" type="number" value={barrierHeight} sx={{ width: 70 }}
              inputProps={{ min: 1, max: 15, step: 0.5 }}
              onChange={(e) => setBarrierHeight(+e.target.value)} />
            <Typography variant="caption">m</Typography>
          </Box>
          {drawMode === 'barrier' && (
            <Alert severity="info" sx={{ mt: 1 }} icon={false}>
              <Typography variant="caption">지도를 클릭해 방음벽 경로를 그리세요. 완료 버튼으로 마무리하세요.</Typography>
            </Alert>
          )}
        </StepCard>

        {/* Step 4: 계산 */}
        <Card sx={{ mb: 1.5, border: '2px solid #1565C0' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Button variant="contained" fullWidth size="large"
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
              disabled={!sourceLocation || loading}
              onClick={handleCalculate}
              sx={{ fontWeight: 700 }}>
              {loading ? '건물 분석 중...' : '주변 건물 소음 분석'}
            </Button>
          </CardContent>
        </Card>

        {/* 결과 요약 */}
        {results.length > 0 && (
          <>
            <Box display="flex" gap={1} mb={1}>
              <SummaryChip icon="🏘️" label={`건물 ${results.length}동`} />
              <SummaryChip icon="⚠️" label={`초과 ${exceeding.length}동`} color="error" />
              <SummaryChip icon="💰" label={`₩${(totalComp/10000).toFixed(0)}만`} color="warning" />
            </Box>

            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" fontWeight={700} color="text.secondary">건물별 결과 (클릭시 층별 상세)</Typography>

            <Box sx={{ maxHeight: 320, overflowY: 'auto', mt: 0.5 }}>
              {results.slice(0, 30).map((r) => {
                const lvl = COMPENSATION[r.noise_level] || COMPENSATION.safe;
                const isSelected = selectedBuilding?.id === r.id;
                return (
                  <Box key={r.id}
                    onClick={() => setSelectedBuilding(isSelected ? null : r)}
                    sx={{ p: 0.8, mb: 0.5, borderRadius: 1, cursor: 'pointer', border: `1px solid ${isSelected ? '#1565C0' : '#E0E0E0'}`,
                      background: isSelected ? '#E3F2FD' : 'white', '&:hover': { background: '#F5F5F5' } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160 }}>
                        {r.name || '건물'}
                      </Typography>
                      <Chip size="small" label={`${r.max_noise_db}dB`}
                        sx={{ background: lvl.bg, color: lvl.color, fontWeight: 700, fontSize: '0.7rem' }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {r.floors}층 · {r.distance}m · {r.exceeding_floors}개층 초과
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* 선택 건물 층별 상세 */}
            {selectedBuilding && <FloorDetail building={selectedBuilding} />}
          </>
        )}
      </Box>

      {/* ── 오른쪽 지도 ── */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <MapLibre3D
          sourceLocation={sourceLocation}
          barrierCoords={barrierCoords}
          buildingGeoJSON={buildings}
          drawMode={drawMode}
          barrierHeight={barrierHeight}
          onMapClick={handleMapClick}
          onBuildingSelect={(props) => {
            if (!props) return;
            const r = results.find((r) => r.id === props.id);
            setSelectedBuilding(r || null);
          }}
        />

        {/* 범례 */}
        <Box sx={{ position: 'absolute', bottom: 32, right: 12, background: 'rgba(255,255,255,0.92)',
          borderRadius: 1, p: 1, fontSize: 11 }}>
          {[['< 65dB', '#2196F3'], ['65~70', '#4CAF50'], ['70~75', '#FFC107'], ['75~80', '#FF9800'], ['> 80dB', '#F44336']].map(([label, color]) => (
            <Box key={label} display="flex" alignItems="center" gap={0.5} mb={0.3}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
              <Typography variant="caption">{label}</Typography>
            </Box>
          ))}
        </Box>

        {/* 드로우 모드 힌트 */}
        {drawMode && (
          <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.75)', color: 'white', borderRadius: 2, px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              {drawMode === 'source' ? '📍 현장 위치를 클릭하세요' : '✏️ 방음벽 경로를 클릭 → 완료 버튼으로 마무리'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function StepCard({ step, current, title, children }) {
  const active = current >= step;
  return (
    <Card sx={{ mb: 1.5, opacity: active ? 1 : 0.5, transition: 'opacity 0.2s' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: active ? '#1565C0' : '#9E9E9E',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
            {step}
          </Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function SummaryChip({ icon, label, color }) {
  return (
    <Box sx={{ flex: 1, textAlign: 'center', p: 0.5, borderRadius: 1, border: '1px solid #E0E0E0', background: 'white' }}>
      <Typography variant="caption" display="block">{icon}</Typography>
      <Typography variant="caption" fontWeight={700} color={`${color}.main`}>{label}</Typography>
    </Box>
  );
}

function FloorDetail({ building }) {
  const { floor_results = [], name, floors, distance, total_compensation_3m } = building;
  return (
    <Card sx={{ mt: 1, border: '1px solid #1565C0' }}>
      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
          {name} — 층별 소음도
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {floors}층 · 거리 {distance}m · 3개월 보상 ₩{total_compensation_3m.toLocaleString()}
        </Typography>
        <Box sx={{ maxHeight: 200, overflowY: 'auto', mt: 0.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ background: '#F5F5F5' }}>
                <TableCell sx={{ py: 0.3, fontSize: 11 }}>층</TableCell>
                <TableCell sx={{ py: 0.3, fontSize: 11 }}>높이</TableCell>
                <TableCell sx={{ py: 0.3, fontSize: 11 }}>소음도</TableCell>
                <TableCell sx={{ py: 0.3, fontSize: 11 }}>보상(3개월)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {floor_results.map((f) => {
                const lvl = COMPENSATION[f.noise_level] || COMPENSATION.safe;
                return (
                  <TableRow key={f.floor} sx={{ background: f.exceeds_65db ? lvl.bg : 'transparent' }}>
                    <TableCell sx={{ py: 0.2, fontSize: 11 }}>{f.floor}층</TableCell>
                    <TableCell sx={{ py: 0.2, fontSize: 11 }}>{f.height_m}m</TableCell>
                    <TableCell sx={{ py: 0.2, fontSize: 11 }}>
                      <Typography variant="caption" fontWeight={700} color={lvl.color}>
                        {f.noise_db}dB
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.2, fontSize: 11 }}>
                      {f.compensation_3m > 0 ? `₩${f.compensation_3m.toLocaleString()}` : '-'}
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
