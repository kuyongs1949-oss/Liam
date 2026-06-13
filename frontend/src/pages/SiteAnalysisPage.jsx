import { useState, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Slider,
  TextField, Chip, Divider, CircularProgress, Alert, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import FenceIcon from '@mui/icons-material/Fence';
import CalculateIcon from '@mui/icons-material/Calculate';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();
const LEVEL_CFG = {
  level1: { label: '경미',    color: '#4CAF50', bg: '#E8F5E9' },
  level2: { label: '보통',    color: '#FF9800', bg: '#FFF3E0' },
  level3: { label: '심각',    color: '#F44336', bg: '#FFEBEE' },
  level4: { label: '매우심각',color: '#9C27B0', bg: '#F3E5F5' },
  safe:   { label: '안전',    color: '#2196F3', bg: '#E3F2FD' },
};

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
  // barrierSegments: 각 선분 = [[lng,lat],[lng,lat]]
  const [barrierSegments, setBarrierSegments] = useState([]);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [drawMode, setDrawMode] = useState(null); // null | 'barrier'
  const [buildings, setBuildings] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lwTotal = useMemo(() => combineLw(equipments), [equipments]);

  // 지도 클릭 → 소음원 위치 설정 (방음벽 모드가 아닐 때)
  const handleSourceSet = useCallback(({ lng, lat }) => {
    if (drawMode === 'barrier') return;
    setSourceLocation({ lng, lat, radius });
    setResults([]);
    setBuildings(null);
    setError('');
  }, [drawMode, radius]);

  // 방음벽 드래그 완료
  const handleBarrierComplete = useCallback((coords) => {
    setBarrierSegments((prev) => [...prev, coords]);
  }, []);

  // 모든 방음벽 좌표를 1차원 배열로 (소음 계산용)
  const allBarrierCoords = useMemo(() => {
    if (barrierSegments.length === 0) return [];
    return barrierSegments.flatMap((seg) => seg);
  }, [barrierSegments]);

  // 계산 실행
  const handleCalculate = async () => {
    if (!sourceLocation) { setError('지도를 클릭해 공사 현장 위치를 먼저 선택하세요.'); return; }
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
        })
      );

      const coloredGeoJSON = {
        ...geoJSON,
        features: geoJSON.features.map((f, i) => ({
          ...f,
          properties: { ...f.properties, color: calcResults[i].color },
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
  const totalComp = exceeding.reduce((s, r) => s + r.total_compensation_3m, 0);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
      {/* ── 왼쪽 패널 ── */}
      <Box sx={{ width: 330, flexShrink: 0, overflowY: 'auto', p: 1.5, borderRight: '1px solid #E0E0E0', background: '#FAFAFA' }}>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}

        {/* 안내 */}
        <Alert severity="info" icon={false} sx={{ mb: 1.5, py: 0.5 }}>
          <Typography variant="caption">
            <b>① 장비 선택</b> → <b>② 지도 클릭</b>으로 현장 위치 선택 → <b>③ 방음벽 드래그</b>(선택) → <b>④ 분석 시작</b>
          </Typography>
        </Alert>

        {/* 장비 선택 */}
        <StepCard step={1} title="소음 발생 장비">
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
              <TextField size="small" type="number" label="대수" sx={{ width: 65 }}
                value={eq.count} inputProps={{ min: 1, max: 20 }}
                onChange={(e) => setEquipments((prev) => prev.map((p, j) => j === i ? { ...p, count: +e.target.value } : p))} />
              <IconButton size="small" color="error" disabled={equipments.length === 1}
                onClick={() => setEquipments((prev) => prev.filter((_, j) => j !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box display="flex" alignItems="center" gap={1}>
            <Button size="small" startIcon={<AddIcon />}
              onClick={() => setEquipments((prev) => [...prev, { id: 'crane', count: 1 }])}>
              장비 추가
            </Button>
            <Chip size="small" label={`합산 Lw: ${lwTotal.toFixed(1)} dB`} color="primary" />
          </Box>
        </StepCard>

        {/* 현장 위치 */}
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
          <Box mt={1}>
            <Typography variant="caption">탐색 반경: {radius}m</Typography>
            <Slider value={radius} min={100} max={600} step={50}
              marks={[{value:100,label:'100m'},{value:300,label:'300m'},{value:600,label:'600m'}]}
              onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation((p) => ({...p, radius: v})); }}
              valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} size="small" />
          </Box>
        </StepCard>

        {/* 방음벽 */}
        <StepCard step={3} title="방음벽 설정 (선택)">
          <Box display="flex" gap={1} mb={1} alignItems="center">
            <Button size="small" variant={drawMode === 'barrier' ? 'contained' : 'outlined'}
              color={drawMode === 'barrier' ? 'warning' : 'inherit'}
              startIcon={<FenceIcon />}
              onClick={() => setDrawMode(drawMode === 'barrier' ? null : 'barrier')}>
              {drawMode === 'barrier' ? '그리기 완료' : '방음벽 그리기'}
            </Button>
            {barrierSegments.length > 0 && (
              <>
                <Chip size="small" color="warning" label={`${barrierSegments.length}선`} />
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
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>높이:</Typography>
            <TextField size="small" type="number" value={barrierHeight} sx={{ width: 70 }}
              inputProps={{ min: 1, max: 15, step: 0.5 }}
              onChange={(e) => setBarrierHeight(+e.target.value)} />
            <Typography variant="caption">m</Typography>
          </Box>
        </StepCard>

        {/* 분석 버튼 */}
        <Button variant="contained" fullWidth size="large" sx={{ mb: 2, fontWeight: 700 }}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
          disabled={!sourceLocation || loading}
          onClick={handleCalculate}>
          {loading ? '건물 분석 중...' : '주변 건물 소음 분석'}
        </Button>

        {/* 결과 요약 */}
        {results.length > 0 && (
          <>
            <Box display="flex" gap={1} mb={1}>
              {[
                { icon: '🏘️', label: `${results.length}동` },
                { icon: '⚠️', label: `초과 ${exceeding.length}동`, red: true },
                { icon: '💰', label: `₩${(totalComp/10000).toFixed(0)}만`, warn: true },
              ].map(({ icon, label, red, warn }) => (
                <Box key={label} sx={{ flex: 1, textAlign: 'center', p: 0.5, borderRadius: 1,
                  border: '1px solid #E0E0E0', background: 'white' }}>
                  <Typography variant="caption" display="block">{icon}</Typography>
                  <Typography variant="caption" fontWeight={700}
                    color={red ? 'error.main' : warn ? 'warning.main' : 'text.primary'}>{label}</Typography>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              건물 클릭 → 층별 소음 상세
            </Typography>

            <Box sx={{ maxHeight: 300, overflowY: 'auto', mt: 0.5 }}>
              {results.slice(0, 30).map((r) => {
                const lvl = LEVEL_CFG[r.noise_level] || LEVEL_CFG.safe;
                const sel = selectedBuilding?.id === r.id;
                return (
                  <Box key={r.id} onClick={() => setSelectedBuilding(sel ? null : r)}
                    sx={{ p: 0.8, mb: 0.5, borderRadius: 1, cursor: 'pointer',
                      border: `1px solid ${sel ? '#1565C0' : '#E0E0E0'}`,
                      background: sel ? '#E3F2FD' : 'white', '&:hover': { background: '#F5F5F5' } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160 }}>
                        {r.name || '건물'}
                      </Typography>
                      <Chip size="small" label={`${r.max_noise_db}dB`}
                        sx={{ background: lvl.bg, color: lvl.color, fontWeight: 700, fontSize: '0.7rem' }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {r.floors}층 · {r.distance}m · {r.exceeding_floors}개층 65dB 초과
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {selectedBuilding && <FloorDetail building={selectedBuilding} />}
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
        <Box sx={{ position: 'absolute', bottom: 32, right: 12,
          background: 'rgba(255,255,255,0.92)', borderRadius: 1, p: 1 }}>
          {[['< 65dB','#2196F3'],['65~70','#4CAF50'],['70~75','#FFC107'],['75~80','#FF9800'],['> 80dB','#F44336']].map(([l, c]) => (
            <Box key={l} display="flex" alignItems="center" gap={0.5} mb={0.3}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
              <Typography variant="caption">{l}</Typography>
            </Box>
          ))}
        </Box>

        {/* 드로우 힌트 */}
        {drawMode === 'barrier' && (
          <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.75)', color: 'white', borderRadius: 2, px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              🖊️ 클릭 후 드래그하여 방음벽을 그리세요
            </Typography>
          </Box>
        )}

        {!sourceLocation && (
          <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(21,101,192,0.85)', color: 'white', borderRadius: 2, px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              📍 지도를 클릭하여 공사 현장 위치를 선택하세요
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function StepCard({ step, title, children }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: '#1565C0',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {step}
          </Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function FloorDetail({ building }) {
  const { floor_results = [], name, floors, distance, total_compensation_3m } = building;
  return (
    <Card sx={{ mt: 1, border: '1px solid #1565C0' }}>
      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Typography variant="subtitle2" fontWeight={700}>{name} — 층별 소음도</Typography>
        <Typography variant="caption" color="text.secondary">
          {floors}층 · {distance}m · 3개월 보상 ₩{total_compensation_3m.toLocaleString()}
        </Typography>
        <Box sx={{ maxHeight: 220, overflowY: 'auto', mt: 0.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ background: '#F5F5F5' }}>
                {['층', '높이', '소음도', '방음벽↓', '3개월 보상'].map((h) => (
                  <TableCell key={h} sx={{ py: 0.3, fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {floor_results.map((f) => {
                const lvl = LEVEL_CFG[f.noise_level] || LEVEL_CFG.safe;
                return (
                  <TableRow key={f.floor} sx={{ background: f.exceeds_65db ? lvl.bg : 'transparent' }}>
                    <TableCell sx={{ py: 0.2, fontSize: 11 }}>{f.floor}층</TableCell>
                    <TableCell sx={{ py: 0.2, fontSize: 11 }}>{f.height_m}m</TableCell>
                    <TableCell sx={{ py: 0.2, fontSize: 11 }}>
                      <Typography variant="caption" fontWeight={700} color={lvl.color}>{f.noise_db}dB</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.2, fontSize: 11 }}>-{f.A_barrier}dB</TableCell>
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
