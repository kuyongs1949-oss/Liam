import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Slider,
  TextField, Chip, Divider, CircularProgress, Alert, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem,
  LinearProgress, Collapse, InputAdornment, List, ListItem, ListItemButton, ListItemText,
  Paper,
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
import SearchIcon from '@mui/icons-material/Search';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, calcSourceToBarrierDist, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();

// 환경분쟁조정위원회 피해배상액 (2026.1.1~, 원/인, 6개월 기준 상한)
const COMP_TABLE = [
  { key: 'level1', range: '65 ~ 70dB', excessRange: '초과 1~5dB',  per6m: 1_480_000, color: '#4CAF50', bg: '#E8F5E9', label: '경미' },
  { key: 'level2', range: '70 ~ 75dB', excessRange: '초과 6~10dB', per6m: 2_088_000, color: '#FF9800', bg: '#FFF3E0', label: '보통' },
  { key: 'level3', range: '75 ~ 80dB', excessRange: '초과 11~15dB',per6m: 2_959_000, color: '#F44336', bg: '#FFEBEE', label: '심각' },
  { key: 'level4', range: '80dB 이상', excessRange: '초과 16dB~',  per6m: 4_148_000, color: '#9C27B0', bg: '#F3E5F5', label: '매우심각' },
];
const COMP_MAP = {
  level1: COMP_TABLE[0], level2: COMP_TABLE[1],
  level3: COMP_TABLE[2], level4: COMP_TABLE[3],
  safe: { range: '65dB 미만', excessRange: '-', per6m: 0, color: '#90A4AE', bg: '#ECEFF1', label: '안전' },
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
  const [barrierSegments, setBarrierSegments] = useState([]); // [[[lng,lat],[lng,lat]], ...]
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [drawMode, setDrawMode] = useState(null);

  // 자동 계산된 d1 (소음원→방음벽)
  const [autoD1, setAutoD1] = useState(null);

  const [sufferingMonths, setSufferingMonths] = useState(3);

  // 주소 검색
  const [addrQuery, setAddrQuery] = useState('');
  const [addrResults, setAddrResults] = useState([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [flyToLocation, setFlyToLocation] = useState(null);

  const [buildings, setBuildings] = useState(null);
  const [results, setResults] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lwTotal = useMemo(() => combineLw(equipments), [equipments]);
  const lwColor = lwTotal >= 115 ? '#9C27B0' : lwTotal >= 110 ? '#F44336' : lwTotal >= 105 ? '#FF9800' : '#1565C0';

  // 소음원 위치 or 방음벽이 바뀌면 d1 자동 계산
  useEffect(() => {
    if (!sourceLocation || barrierSegments.length === 0) {
      setAutoD1(null);
      return;
    }
    const d1 = calcSourceToBarrierDist(sourceLocation.lat, sourceLocation.lng, barrierSegments);
    setAutoD1(d1);
  }, [sourceLocation, barrierSegments]);

  const handleAddrSearch = useCallback(async () => {
    const q = addrQuery.trim();
    if (!q) return;
    setAddrLoading(true);
    setAddrResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=kr&accept-language=ko`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
      const data = await res.json();
      setAddrResults(data);
      if (data.length === 0) setError('주소 검색 결과가 없습니다. 다른 주소를 입력해보세요.');
    } catch {
      setError('주소 검색 실패. 네트워크를 확인하세요.');
    } finally {
      setAddrLoading(false);
    }
  }, [addrQuery]);

  const handleAddrSelect = useCallback((item) => {
    const lng = parseFloat(item.lon);
    const lat = parseFloat(item.lat);
    setFlyToLocation({ lng, lat, zoom: 16 });
    setAddrResults([]);
    setAddrQuery(item.display_name.split(',')[0]);
  }, []);

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
          barrierSegments,
          barrierHeight: barrierSegments.length > 0 ? barrierHeight : 0,
          sufferingMonths,
        })
      );

      setBuildings({
        ...geoJSON,
        features: geoJSON.features.map((f, i) => {
          const r = calcResults[i];
          return {
            ...f,
            properties: {
              id: r.id,
              name: r.name || '건물',
              floors: r.floors,
              height: r.height || (r.floors * 3),
              color: r.color,
              max_noise_db: r.max_noise_db,
              noise_level: r.noise_level || 'safe',
              exceeds_65db: r.exceeds_65db ? 1 : 0,
              exceeding_floors: r.exceeding_floors,
              distance: r.distance,
            },
          };
        }),
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

  // 진행 단계 계산
  const step = !sourceLocation ? 1 : barrierSegments.length === 0 ? 2 : 3;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>

      {/* ════════ 왼쪽 패널 ════════ */}
      <Box sx={{
        width: 380, flexShrink: 0, overflowY: 'auto', p: 1.5,
        borderRight: '1px solid #E0E0E0', background: '#F8F9FB',
      }}>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5 }}>{error}</Alert>}

        {/* ── STEP 1: 장비 선택 ── */}
        <SectionCard step={1} title="소음 발생 장비 선택" active>
          <Box sx={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, mb: 1, pr: 0.5 }}>
            {equipments.map((eq, i) => {
              const info = EQUIPMENT_LIST.find((e) => e.id === eq.id);
              const rowLw = info ? +(info.Lw + 10 * Math.log10(Math.max(eq.count, 1))).toFixed(1) : 0;
              return (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center',
                  p: 1, borderRadius: 1.5, border: '1px solid #E0E0E0', background: 'white' }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>장비</InputLabel>
                    <Select value={eq.id} label="장비"
                      onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}>
                      {EQUIPMENT_LIST.map((e) => (
                        <MenuItem key={e.id} value={e.id}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <Typography variant="body2">{e.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{e.Lw}dB</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField size="small" type="number" label="대수" sx={{ width: 68 }}
                    value={eq.count} inputProps={{ min: 1, max: 30 }}
                    onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, count: +e.target.value } : x))} />
                  <Box sx={{ textAlign: 'center', minWidth: 44 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Lw</Typography>
                    <Typography variant="caption" fontWeight={700} color={dbColor(rowLw - 55)} display="block">
                      {rowLw}
                    </Typography>
                    <IconButton size="small" disabled={equipments.length === 1}
                      onClick={() => setEquipments((p) => p.filter((_, j) => j !== i))} sx={{ p: 0.2 }}>
                      <DeleteIcon sx={{ fontSize: 14, color: '#EF5350' }} />
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
              textAlign: 'center', minWidth: 108, flexShrink: 0 }}>
              <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>합산 음향파워</Typography>
              <Typography variant="h6" fontWeight={800} lineHeight={1.1}>{lwTotal.toFixed(1)} dB</Typography>
            </Box>
          </Box>
        </SectionCard>

        {/* ── STEP 2: 소음원 위치 ── */}
        <SectionCard step={2} title="소음 발생 위치" active={true}>
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
              <IconButton size="small" onClick={() => {
                setSourceLocation(null); setResults([]); setBuildings(null);
                setBarrierSegments([]); setAutoD1(null);
              }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ p: 1.2, borderRadius: 1, border: '2px dashed #90CAF9',
              textAlign: 'center', background: '#E3F2FD' }}>
              <LocationOnIcon sx={{ color: '#1565C0', fontSize: 24, mb: 0.3 }} />
              <Typography variant="body2" color="primary" fontWeight={600}>지도 위 검색창에서 주소 검색</Typography>
              <Typography variant="caption" color="text.secondary">주소 선택 → 지도 이동 → 클릭으로 현장 확정</Typography>
            </Box>
          )}
          <Box mt={1.2}>
            <Typography variant="caption" color="text.secondary">탐색 반경: <b>{radius}m</b></Typography>
            <Slider value={radius} min={100} max={600} step={50} size="small"
              marks={[{ value: 100, label: '100m' }, { value: 300, label: '300m' }, { value: 600, label: '600m' }]}
              onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation((p) => ({ ...p, radius: v })); }}
              valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} />
          </Box>
        </SectionCard>

        {/* ── STEP 3: 방음벽 ── */}
        <SectionCard step={3} title="방음벽 그리기 (선택)" active={!!sourceLocation}>
          {/* 방음벽 높이 */}
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
              방음벽 높이
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Slider value={barrierHeight} min={1} max={12} step={0.5} size="small" sx={{ flex: 1 }}
                onChange={(_, v) => setBarrierHeight(v)}
                valueLabelDisplay="on" valueLabelFormat={(v) => `${v}m`} />
              <TextField size="small" type="number" sx={{ width: 80 }}
                value={barrierHeight} inputProps={{ min: 1, max: 12, step: 0.5 }}
                InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                onChange={(e) => setBarrierHeight(+e.target.value)} />
            </Box>
          </Box>

          {/* 펜 그리기 버튼 */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <Button fullWidth size="small"
              variant={drawMode === 'barrier' ? 'contained' : 'outlined'}
              color={drawMode === 'barrier' ? 'warning' : 'inherit'}
              startIcon={<EditIcon />}
              disabled={!sourceLocation}
              onClick={() => setDrawMode(drawMode === 'barrier' ? null : 'barrier')}>
              {drawMode === 'barrier' ? '그리기 중지' : '펜으로 방음벽 그리기'}
            </Button>
            {barrierSegments.length > 0 && (
              <IconButton size="small" color="error" title="방음벽 모두 삭제"
                onClick={() => { setBarrierSegments([]); setAutoD1(null); }}>
                <DeleteIcon />
              </IconButton>
            )}
          </Box>

          {drawMode === 'barrier' && (
            <Alert severity="warning" icon={false} sx={{ py: 0.5, mb: 1 }}>
              <Typography variant="caption">지도에서 <b>클릭 후 드래그</b>하여 방음벽 선을 그리세요</Typography>
            </Alert>
          )}

          {/* 자동 계산된 d1 표시 */}
          {barrierSegments.length > 0 && (
            <Box sx={{ p: 1.2, borderRadius: 1, background: '#E8F5E9', border: '1px solid #A5D6A7' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" fontWeight={700} color="success.dark">
                  ✅ 방음벽 {barrierSegments.length}선분 그려짐
                </Typography>
                <Chip size="small" label={`높이 ${barrierHeight}m`} color="warning" />
              </Box>
              {autoD1 !== null && sourceLocation && (
                <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">소음원 → 방음벽 (자동계산)</Typography>
                    <Typography variant="body2" fontWeight={800} color="success.dark">d₁ = {autoD1}m</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">방음벽 → 민원인 (건물별 자동계산)</Typography>
                    <Typography variant="body2" fontWeight={700} color="text.secondary">d₂ = 건물마다 계산</Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {!sourceLocation && (
            <Typography variant="caption" color="text.disabled">
              ※ 소음 발생 위치를 먼저 설정하세요
            </Typography>
          )}
        </SectionCard>

        {/* ── STEP 4: 공사 기간 ── */}
        <SectionCard step={4} title="공사 기간" active={true}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Slider value={sufferingMonths} min={1} max={36} step={1} size="small" sx={{ flex: 1 }}
              marks={[{ value: 1, label: '1개월' }, { value: 12, label: '1년' }, { value: 36, label: '3년' }]}
              onChange={(_, v) => setSufferingMonths(v)}
              valueLabelDisplay="on" valueLabelFormat={(v) => `${v}개월`} />
            <Box sx={{ width: 64, textAlign: 'center', p: 0.8, borderRadius: 1,
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
                환경분쟁조정위원회 피해배상 기준 (원/인, 2026.1.1~)
              </Typography>
            </Box>
            {/* 헤더 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', px: 1, py: 0.4, background: '#607D8B' }}>
              {['소음도', '초과소음도', `${sufferingMonths}개월 인당`].map((h) => (
                <Typography key={h} variant="caption" color="white" fontWeight={700} fontSize={10}>{h}</Typography>
              ))}
            </Box>
            {COMP_TABLE.map((c) => {
              // 해당 기간에 맞는 인당 보상액 계산 (noiseEngine과 동일 로직)
              const m = Math.min(sufferingMonths, 36);
              const PERIODS = [
                { endMonth: 6,  amounts: [1_480_000, 2_088_000, 2_959_000, 4_148_000] },
                { endMonth: 12, amounts: [1_894_000, 2_682_000, 3_789_000, 5_365_000] },
                { endMonth: 24, amounts: [2_309_000, 3_263_000, 4_618_000, 6_527_000] },
                { endMonth: 36, amounts: [2_558_000, 3_622_000, 5_117_000, 7_232_000] },
              ];
              const bandIdx = ['level1','level2','level3','level4'].indexOf(c.key);
              let prev = { endMonth: 0, amount: 0 };
              let perPerson = 0;
              for (const p of PERIODS) {
                const curr = { endMonth: p.endMonth, amount: p.amounts[bandIdx] };
                if (m <= curr.endMonth) {
                  const t = (m - prev.endMonth) / (curr.endMonth - prev.endMonth);
                  perPerson = Math.round(prev.amount + t * (curr.amount - prev.amount));
                  break;
                }
                prev = { endMonth: curr.endMonth, amount: curr.amount };
                perPerson = curr.amount;
              }
              return (
                <Box key={c.key} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
                  px: 1, py: 0.5, background: c.bg, borderBottom: '1px solid #E0E0E0' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    <Typography variant="caption" fontWeight={600} color={c.color}>{c.range}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">{c.excessRange}</Typography>
                  <Typography variant="caption" fontWeight={700} color={c.color}>
                    ₩{perPerson.toLocaleString()}
                  </Typography>
                </Box>
              );
            })}
            <Box sx={{ px: 1, py: 0.5, background: '#ECEFF1' }}>
              <Typography variant="caption" color="text.secondary">
                * 수인한도 65dB 초과분 기준 · 인당 총액 (누적)
              </Typography>
            </Box>
          </Box>
        </SectionCard>

        {/* ── 분석 버튼 ── */}
        <Button variant="contained" size="large" fullWidth
          sx={{ fontWeight: 800, fontSize: 15, py: 1.5, borderRadius: 2, my: 0.5 }}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
          disabled={!sourceLocation || loading}
          onClick={handleCalculate}>
          {loading ? '주변 건물 분석 중...' : '소음 영향 분석 시작'}
        </Button>

        {/* ── 결과 ── */}
        {results.length > 0 && (
          <ResultList
            results={results} exceeding={exceeding} totalComp={totalComp}
            sufferingMonths={sufferingMonths} expandedId={expandedId}
            onToggle={(r) => setExpandedId(expandedId === r.id ? null : r.id)}
          />
        )}
      </Box>

      {/* ════════ 오른쪽 지도 ════════ */}
      <Box sx={{ flex: 1, position: 'relative' }}>

        {/* ── 지도 위 주소 검색창 오버레이 ── */}
        <Box sx={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, width: '90%', maxWidth: 480,
        }}>
          <Box sx={{ display: 'flex', gap: 0.8, boxShadow: 4, borderRadius: 2, overflow: 'visible' }}>
            <TextField
              size="small" fullWidth
              placeholder="공사현장 주소 검색 (예: 강남구 역삼동 123)"
              value={addrQuery}
              onChange={(e) => { setAddrQuery(e.target.value); if (!e.target.value.trim()) setAddrResults([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddrSearch(); if (e.key === 'Escape') setAddrResults([]); }}
              sx={{
                background: 'white',
                borderRadius: '8px 0 0 8px',
                '& .MuiOutlinedInput-root': { borderRadius: '8px 0 0 8px', background: 'white' },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 20, color: '#1565C0' }} />
                  </InputAdornment>
                ),
                endAdornment: addrQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => { setAddrQuery(''); setAddrResults([]); }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <Button
              variant="contained" size="small"
              sx={{ px: 2, borderRadius: '0 8px 8px 0', minWidth: 64, flexShrink: 0, fontSize: 13, fontWeight: 700 }}
              onClick={handleAddrSearch}
              disabled={addrLoading || !addrQuery.trim()}
            >
              {addrLoading ? <CircularProgress size={16} color="inherit" /> : '검색'}
            </Button>
          </Box>

          {/* 검색 결과 드롭다운 */}
          {addrResults.length > 0 && (
            <Paper elevation={6} sx={{
              mt: 0.5, borderRadius: 1.5, overflow: 'hidden',
              maxHeight: 260, overflowY: 'auto',
              border: '1px solid #E0E0E0',
            }}>
              <List dense disablePadding>
                {addrResults.map((item, idx) => {
                  const parts = item.display_name.split(',');
                  const main = parts.slice(0, 2).join(' ').trim();
                  const sub  = parts.slice(2, 5).join(', ').trim();
                  return (
                    <ListItem key={item.place_id} disablePadding divider={idx < addrResults.length - 1}>
                      <ListItemButton
                        onClick={() => handleAddrSelect(item)}
                        sx={{ py: 1, '&:hover': { background: '#E3F2FD' } }}
                      >
                        <LocationOnIcon sx={{ fontSize: 18, color: '#1565C0', mr: 1, flexShrink: 0 }} />
                        <ListItemText
                          primary={main}
                          secondary={sub}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                          secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary', noWrap: true }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          )}

          {/* 위치 미확정 안내 배너 */}
          {!sourceLocation && addrResults.length === 0 && !addrLoading && (
            <Box sx={{
              mt: 0.8, px: 1.5, py: 0.8, borderRadius: 1.5,
              background: 'rgba(21,101,192,0.88)', color: 'white',
              display: 'flex', alignItems: 'center', gap: 1,
              backdropFilter: 'blur(4px)',
            }}>
              <LocationOnIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" fontWeight={600}>
                주소 검색 후 지도를 클릭하면 소음 발생 위치가 설정됩니다
              </Typography>
            </Box>
          )}
        </Box>

        <MapLibre3D
          sourceLocation={sourceLocation}
          barrierCoords={barrierSegments}
          buildingGeoJSON={buildings}
          drawMode={drawMode}
          barrierHeight={barrierHeight}
          flyToLocation={flyToLocation}
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

        {/* 단계 안내 오버레이 */}
        {drawMode === 'barrier' && (
          <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(230,81,0,0.92)', color: 'white', borderRadius: 2, px: 2.5, py: 1,
            boxShadow: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2" fontWeight={700}>
              클릭 후 드래그 → 방음벽 그리기 | 완료 후 "그리기 중지" 클릭
            </Typography>
          </Box>
        )}
        {!sourceLocation && drawMode !== 'barrier' && (
          <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(21,101,192,0.9)', color: 'white', borderRadius: 2, px: 2.5, py: 1,
            boxShadow: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOnIcon sx={{ fontSize: 20 }} />
            <Typography variant="body2" fontWeight={700}>지도를 클릭하여 소음 발생 위치를 선택하세요</Typography>
          </Box>
        )}
        {sourceLocation && barrierSegments.length === 0 && drawMode !== 'barrier' && step === 2 && (
          <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.65)', color: 'white', borderRadius: 2, px: 2, py: 0.8,
            boxShadow: 2 }}>
            <Typography variant="caption" fontWeight={600}>
              방음벽을 그리거나 (선택) → "소음 영향 분석 시작" 버튼을 누르세요
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ── 결과 목록 ──────────────────────────────────────────── */
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
                  border: `1.5px solid ${isExpanded ? '#1565C0' : r.exceeds_65db ? c.color + '66' : '#E0E0E0'}`,
                  background: isExpanded ? '#E3F2FD' : r.exceeds_65db ? c.bg : 'white',
                  '&:hover': { background: '#F5F5F5' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>{r.name || '건물'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.floors}층 · {r.distance}m
                      {r.barrier_d1 > 0 && ` · d₁=${r.barrier_d1}m d₂=${r.barrier_d2}m`}
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
                      인당 ₩{r.total_compensation.toLocaleString()} ({sufferingMonths}개월)
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

/* ── 층별 소음 테이블 ───────────────────────────────────── */
function FloorTable({ building, sufferingMonths }) {
  const { floor_results = [], total_compensation, floors, distance, name, barrier_d1, barrier_d2 } = building;
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
      <Box sx={{ px: 1.5, py: 0.6, background: '#E3F2FD', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
        <Typography variant="caption">{distance}m · {floors}층</Typography>
        {barrier_d1 > 0 && (
          <Typography variant="caption" color="success.dark">
            방음벽 d₁={barrier_d1}m / d₂={barrier_d2}m
          </Typography>
        )}
        <Typography variant="caption" fontWeight={700} color="error.main">
          인당 {sufferingMonths}개월 총 ₩{total_compensation.toLocaleString()}
        </Typography>
      </Box>
      <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ '& th': { background: '#F5F5F5', py: 0.5, fontSize: 11, fontWeight: 700 } }}>
              <TableCell>층</TableCell>
              <TableCell>높이</TableCell>
              <TableCell>소음도 / 초과</TableCell>
              <TableCell>방음벽 감쇠</TableCell>
              <TableCell>인당 보상금</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {floor_results.map((f) => {
              const c = COMP_MAP[f.noise_level] || COMP_MAP.safe;
              return (
                <TableRow key={f.floor}
                  sx={{ background: f.exceeds_65db ? c.bg : 'transparent', '& td': { py: 0.4, fontSize: 11 } }}>
                  <TableCell sx={{ fontWeight: 600 }}>{f.floor}층</TableCell>
                  <TableCell>{f.height_m}m</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <Typography variant="caption" fontWeight={800} color={c.color}>{f.noise_db}dB</Typography>
                    </Box>
                    {f.exceeds_65db && (
                      <Typography variant="caption" color="error.main" sx={{ fontSize: 10 }}>
                        +{f.excess_db}dB 초과
                      </Typography>
                    )}
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

/* ── 섹션 카드 ──────────────────────────────────────────── */
function SectionCard({ step, title, active, children }) {
  return (
    <Card elevation={0} sx={{
      border: `1px solid ${active ? '#E0E0E0' : '#EEEEEE'}`,
      borderRadius: 2, mb: 1.5,
      opacity: active ? 1 : 0.6,
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
          <Box sx={{ width: 24, height: 24, borderRadius: '50%',
            background: active ? '#1565C0' : '#90A4AE',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{step}</Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}
