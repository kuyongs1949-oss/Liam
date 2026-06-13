import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Slider,
  TextField, Chip, CircularProgress, Alert, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem,
  LinearProgress, Collapse, InputAdornment, List, ListItem, ListItemButton, ListItemText,
  Paper, Divider,
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ShieldIcon from '@mui/icons-material/Shield';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ForestIcon from '@mui/icons-material/Forest';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();

const COMP_TABLE = [
  { key: 'level1', range: '65~70dB',  excessRange: '초과 1~5dB',   color: '#16A34A', bg: '#DCFCE7', label: '경미' },
  { key: 'level2', range: '70~75dB',  excessRange: '초과 6~10dB',  color: '#D97706', bg: '#FEF3C7', label: '보통' },
  { key: 'level3', range: '75~80dB',  excessRange: '초과 11~15dB', color: '#EA580C', bg: '#FFF7ED', label: '심각' },
  { key: 'level4', range: '80dB 이상', excessRange: '초과 16dB~',  color: '#DC2626', bg: '#FEF2F2', label: '매우심각' },
];
const COMP_MAP = {
  level1: COMP_TABLE[0], level2: COMP_TABLE[1],
  level3: COMP_TABLE[2], level4: COMP_TABLE[3],
  safe: { range: '65dB 미만', excessRange: '-', color: '#6B7280', bg: '#F9FAFB', label: '안전' },
};

function dbColor(db) {
  if (db < 65) return '#6B7280';
  if (db < 70) return '#16A34A';
  if (db < 75) return '#D97706';
  if (db < 80) return '#EA580C';
  return '#DC2626';
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
  const [barrierSegments, setBarrierSegments] = useState([]);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [drawMode, setDrawMode] = useState(null);
  const [sufferingMonths, setSufferingMonths] = useState(3);
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
  const lwColor = lwTotal >= 115 ? '#DC2626' : lwTotal >= 110 ? '#EA580C' : lwTotal >= 105 ? '#D97706' : '#16A34A';

  const drawModeRef = useRef(drawMode);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  const handleAddrSearch = useCallback(async () => {
    const q = addrQuery.trim();
    if (!q) return;
    setAddrLoading(true); setAddrResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=kr&accept-language=ko`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
      const data = await res.json();
      setAddrResults(data);
      if (data.length === 0) setError('주소 검색 결과가 없습니다.');
    } catch { setError('주소 검색 실패. 네트워크를 확인하세요.'); }
    finally { setAddrLoading(false); }
  }, [addrQuery]);

  const handleAddrSelect = useCallback((item) => {
    setFlyToLocation({ lng: parseFloat(item.lon), lat: parseFloat(item.lat), zoom: 16 });
    setAddrResults([]);
    setAddrQuery(item.display_name.split(',')[0]);
  }, []);

  const handleSourceSet = useCallback(({ lng, lat }) => {
    if (drawModeRef.current === 'barrier') return;
    setSourceLocation({ lng, lat, radius });
    setResults([]); setBuildings(null); setError('');
  }, [radius]);

  const handleBarrierComplete = useCallback((coords) => {
    setBarrierSegments((prev) => [...prev, coords]);
  }, []);

  const handleCalculate = async () => {
    if (!sourceLocation) { setError('지도를 클릭해 공사 현장 위치를 선택하세요.'); return; }
    setLoading(true); setError(''); setExpandedId(null);
    try {
      const geoJSON = await queryBuildings(sourceLocation.lat, sourceLocation.lng, radius);
      if (!geoJSON.features.length) {
        setError('주변에 건물 데이터가 없습니다. 반경을 늘리거나 다른 위치를 선택해보세요.');
        setLoading(false); return;
      }
      const calcResults = geoJSON.features.map((f) =>
        calculateBuildingNoise({
          lwTotal, sourceLat: sourceLocation.lat, sourceLng: sourceLocation.lng,
          building: f.properties, barrierSegments,
          barrierHeight: barrierSegments.length > 0 ? barrierHeight : 0, sufferingMonths,
        })
      );
      setBuildings({
        ...geoJSON,
        features: geoJSON.features.map((f, i) => {
          const r = calcResults[i];
          return { ...f, properties: {
            id: r.id, name: r.name || '건물', floors: r.floors,
            height: r.height || (r.floors * 3), color: r.color,
            max_noise_db: r.max_noise_db, noise_level: r.noise_level || 'safe',
            exceeds_65db: r.exceeds_65db ? 1 : 0, exceeding_floors: r.exceeding_floors,
            distance: r.distance,
          }};
        }),
      });
      setResults(calcResults.sort((a, b) => b.max_noise_db - a.max_noise_db));
    } catch (e) { setError(`오류: ${e.message}`); }
    finally { setLoading(false); }
  };

  const exceeding  = results.filter((r) => r.exceeds_65db);
  const totalComp  = exceeding.reduce((s, r) => s + r.total_compensation, 0);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#F0FDF4' }}>

      {/* ════ 왼쪽 패널 ════ */}
      <Box sx={{
        width: 380, flexShrink: 0, overflowY: 'auto', p: 1.5,
        background: '#FFFFFF',
        borderRight: '2px solid #D1FAE5',
        boxShadow: '2px 0 12px rgba(22,163,74,0.06)',
        '&::-webkit-scrollbar': { width: 5 },
        '&::-webkit-scrollbar-track': { background: '#F0FDF4' },
        '&::-webkit-scrollbar-thumb': { background: '#86EFAC', borderRadius: 4 },
      }}>
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* STEP 1: 장비 */}
        <SectionCard step={1} icon={<GraphicEqIcon sx={{ fontSize: 14 }} />} title="소음 발생 장비 선택">
          <Box sx={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.8, mb: 1 }}>
            {equipments.map((eq, i) => {
              const info = EQUIPMENT_LIST.find((e) => e.id === eq.id);
              const rowLw = info ? +(info.Lw + 10 * Math.log10(Math.max(eq.count, 1))).toFixed(1) : 0;
              return (
                <Box key={i} sx={{
                  display: 'flex', gap: 0.8, alignItems: 'center',
                  p: 1, borderRadius: 1.5,
                  border: '1.5px solid #D1FAE5',
                  background: '#FAFFFE',
                  '&:hover': { border: '1.5px solid #4ADE80' },
                  transition: 'border-color 0.15s',
                }}>
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
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>Lw</Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ color: dbColor(rowLw - 55), display: 'block' }}>
                      {rowLw}
                    </Typography>
                    <IconButton size="small" disabled={equipments.length === 1}
                      onClick={() => setEquipments((p) => p.filter((_, j) => j !== i))} sx={{ p: 0.2 }}>
                      <DeleteIcon sx={{ fontSize: 13, color: '#EF4444' }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" color="primary" fullWidth
              onClick={() => setEquipments((p) => [...p, { id: 'crane', count: 1 }])}>
              장비 추가
            </Button>
            <Box sx={{
              px: 1.5, py: 0.8, borderRadius: 2, flexShrink: 0, minWidth: 110, textAlign: 'center',
              background: `linear-gradient(135deg, ${lwColor}18, ${lwColor}0A)`,
              border: `1.5px solid ${lwColor}40`,
              boxShadow: `0 2px 10px ${lwColor}20`,
            }}>
              <Typography variant="caption" sx={{ color: lwColor, opacity: 0.8, display: 'block', fontSize: 9 }}>합산 음향파워</Typography>
              <Typography variant="h6" fontWeight={900} sx={{ color: lwColor, lineHeight: 1.1 }}>
                {lwTotal.toFixed(1)} dB
              </Typography>
            </Box>
          </Box>
        </SectionCard>

        {/* STEP 2: 소음원 위치 */}
        <SectionCard step={2} icon={<LocationOnIcon sx={{ fontSize: 14 }} />} title="소음 발생 위치">
          {sourceLocation ? (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, p: 1.2, borderRadius: 1.5,
              background: '#DCFCE7', border: '1.5px solid #86EFAC',
            }}>
              <CheckCircleIcon sx={{ color: '#16A34A', fontSize: 20 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700} color="success.main">위치 설정 완료</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                  {sourceLocation.lat.toFixed(5)}, {sourceLocation.lng.toFixed(5)}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => {
                setSourceLocation(null); setResults([]); setBuildings(null); setBarrierSegments([]);
              }}>
                <DeleteIcon fontSize="small" color="error" />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{
              p: 1.5, borderRadius: 1.5,
              border: '2px dashed #86EFAC', textAlign: 'center', background: '#F0FDF4',
            }}>
              <LocationOnIcon sx={{ color: '#16A34A', fontSize: 24, mb: 0.3 }} />
              <Typography variant="body2" color="primary" fontWeight={600}>지도 위 주소 검색 후 클릭</Typography>
              <Typography variant="caption" color="text.secondary">주소 선택 → 지도 이동 → 클릭으로 현장 확정</Typography>
            </Box>
          )}
          <Box mt={1.5}>
            <Typography variant="caption" color="text.secondary">
              탐색 반경: <Box component="span" sx={{ color: '#16A34A', fontWeight: 700 }}>{radius}m</Box>
            </Typography>
            <Slider value={radius} min={100} max={600} step={50} size="small"
              marks={[{ value: 100, label: '100m' }, { value: 300, label: '300m' }, { value: 600, label: '600m' }]}
              onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation((p) => ({ ...p, radius: v })); }}
              valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} />
          </Box>
        </SectionCard>

        {/* STEP 3: 방음벽 */}
        <SectionCard step={3} icon={<ShieldIcon sx={{ fontSize: 14 }} />} title="방음벽 그리기 (선택)" dimmed={!sourceLocation}>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>방음벽 높이</Typography>
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

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <Button fullWidth size="small"
              variant={drawMode === 'barrier' ? 'contained' : 'outlined'}
              color={drawMode === 'barrier' ? 'warning' : 'primary'}
              startIcon={<EditIcon sx={{ fontSize: 15 }} />}
              disabled={!sourceLocation}
              onClick={() => setDrawMode(drawMode === 'barrier' ? null : 'barrier')}
              sx={drawMode === 'barrier' ? {
                background: 'linear-gradient(135deg, #D97706, #F59E0B)',
                boxShadow: '0 3px 12px rgba(217,119,6,0.35)',
                color: 'white', fontWeight: 700,
              } : {}}>
              {drawMode === 'barrier' ? '✏️ 그리기 중지' : '✏️ 펜으로 방음벽 그리기'}
            </Button>
            {barrierSegments.length > 0 && (
              <IconButton size="small" color="error" title="방음벽 모두 삭제"
                onClick={() => setBarrierSegments([])}>
                <DeleteIcon />
              </IconButton>
            )}
          </Box>

          {drawMode === 'barrier' && (
            <Box sx={{
              py: 0.8, px: 1.2, borderRadius: 1.5, mb: 1,
              background: '#FEF3C7', border: '1px solid #FDE68A',
            }}>
              <Typography variant="caption" sx={{ color: '#92400E', fontWeight: 600 }}>
                지도에서 <b>클릭 후 드래그</b>하여 방음벽 선을 그리세요
              </Typography>
            </Box>
          )}

          {barrierSegments.length > 0 && (
            <Box sx={{ p: 1.2, borderRadius: 1.5, background: '#DCFCE7', border: '1px solid #86EFAC' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                <Typography variant="caption" fontWeight={700} color="success.main">
                  방음벽 {barrierSegments.length}선분 완료
                </Typography>
                <Chip size="small" label={`${barrierHeight}m`} color="warning" sx={{ height: 18, fontSize: 10 }} />
              </Box>
              <Box sx={{ p: 0.8, borderRadius: 1, background: 'rgba(255,255,255,0.7)' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                  소음 경로가 방음벽과 교차하는 건물마다
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 0.3 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, display: 'block' }}>소음원 → 방음벽</Typography>
                    <Typography variant="caption" fontWeight={700} color="primary" sx={{ fontSize: 11 }}>d₁ = 방향별 자동계산</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, display: 'block' }}>방음벽 → 민원인</Typography>
                    <Typography variant="caption" fontWeight={700} color="primary" sx={{ fontSize: 11 }}>d₂ = 방향별 자동계산</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </SectionCard>

        {/* STEP 4: 공사 기간 */}
        <SectionCard step={4} icon={<AccessTimeIcon sx={{ fontSize: 14 }} />} title="공사 기간">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Slider value={sufferingMonths} min={1} max={36} step={1} size="small" sx={{ flex: 1 }}
              marks={[{ value: 1, label: '1개월' }, { value: 12, label: '1년' }, { value: 36, label: '3년' }]}
              onChange={(_, v) => setSufferingMonths(v)}
              valueLabelDisplay="on" valueLabelFormat={(v) => `${v}개월`} />
            <Box sx={{
              width: 64, textAlign: 'center', p: 0.8, borderRadius: 1.5, flexShrink: 0,
              background: '#DCFCE7', border: '1.5px solid #86EFAC',
            }}>
              <Typography variant="caption" color="primary" display="block" sx={{ fontSize: 9 }}>기간</Typography>
              <Typography variant="h6" fontWeight={900} color="primary" lineHeight={1}>{sufferingMonths}</Typography>
              <Typography variant="caption" color="primary">개월</Typography>
            </Box>
          </Box>

          {/* 보상 기준표 */}
          <Box sx={{ borderRadius: 1.5, overflow: 'hidden', border: '1px solid #D1FAE5' }}>
            <Box sx={{ px: 1.2, py: 0.7, background: 'linear-gradient(90deg, #14532D, #16A34A)' }}>
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 700, fontSize: 10 }}>
                환경분쟁조정위원회 피해배상 기준 (원/인, 2026.1.1~)
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', px: 1, py: 0.5, background: '#F0FDF4' }}>
              {['소음도', '초과소음도', `${sufferingMonths}개월 인당`].map((h) => (
                <Typography key={h} variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: 9 }}>{h}</Typography>
              ))}
            </Box>
            {COMP_TABLE.map((c) => {
              const m = Math.min(sufferingMonths, 36);
              const PERIODS = [
                { endMonth: 6,  amounts: [1_480_000, 2_088_000, 2_959_000, 4_148_000] },
                { endMonth: 12, amounts: [1_894_000, 2_682_000, 3_789_000, 5_365_000] },
                { endMonth: 24, amounts: [2_309_000, 3_263_000, 4_618_000, 6_527_000] },
                { endMonth: 36, amounts: [2_558_000, 3_622_000, 5_117_000, 7_232_000] },
              ];
              const bandIdx = ['level1','level2','level3','level4'].indexOf(c.key);
              let prev = { endMonth: 0, amount: 0 }; let perPerson = 0;
              for (const p of PERIODS) {
                const curr = { endMonth: p.endMonth, amount: p.amounts[bandIdx] };
                if (m <= curr.endMonth) {
                  const t = (m - prev.endMonth) / (curr.endMonth - prev.endMonth);
                  perPerson = Math.round(prev.amount + t * (curr.amount - prev.amount)); break;
                }
                prev = { endMonth: curr.endMonth, amount: curr.amount };
                perPerson = curr.amount;
              }
              return (
                <Box key={c.key} sx={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
                  px: 1, py: 0.6, background: c.bg, borderBottom: '1px solid #E7F7EC',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: c.color, fontSize: 10 }}>{c.range}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{c.excessRange}</Typography>
                  <Typography variant="caption" fontWeight={800} sx={{ color: c.color, fontSize: 10 }}>
                    ₩{perPerson.toLocaleString()}
                  </Typography>
                </Box>
              );
            })}
            <Box sx={{ px: 1, py: 0.4, background: '#F0FDF4' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                * 수인한도 65dB 초과 기준 · 인당 총액 (누적)
              </Typography>
            </Box>
          </Box>
        </SectionCard>

        {/* 분석 버튼 */}
        <Button
          variant="contained" color="primary" size="large" fullWidth
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
          disabled={!sourceLocation || loading}
          onClick={handleCalculate}
          sx={{ fontWeight: 800, fontSize: 14, py: 1.5, borderRadius: 2, my: 0.5, letterSpacing: '0.03em' }}>
          {loading ? '주변 건물 분석 중...' : '🌿 소음 영향 분석 시작'}
        </Button>

        {/* 결과 */}
        {results.length > 0 && (
          <ResultList
            results={results} exceeding={exceeding} totalComp={totalComp}
            sufferingMonths={sufferingMonths} expandedId={expandedId}
            onToggle={(r) => setExpandedId(expandedId === r.id ? null : r.id)}
          />
        )}
      </Box>

      {/* ════ 오른쪽 지도 ════ */}
      <Box sx={{ flex: 1, position: 'relative' }}>

        {/* 주소 검색창 */}
        <Box sx={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, width: '90%', maxWidth: 480,
        }}>
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            <TextField
              size="small" fullWidth
              placeholder="공사현장 주소 검색 (예: 강남구 역삼동 123)"
              value={addrQuery}
              onChange={(e) => { setAddrQuery(e.target.value); if (!e.target.value.trim()) setAddrResults([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddrSearch(); if (e.key === 'Escape') setAddrResults([]); }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px 0 0 10px',
                  background: 'rgba(255,255,255,0.97)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: '#16A34A' }} />
                  </InputAdornment>
                ),
                endAdornment: addrQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => { setAddrQuery(''); setAddrResults([]); }}>
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <Button
              variant="contained" color="primary" size="small"
              sx={{ px: 2, borderRadius: '0 10px 10px 0', minWidth: 64, flexShrink: 0, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}
              onClick={handleAddrSearch}
              disabled={addrLoading || !addrQuery.trim()}
            >
              {addrLoading ? <CircularProgress size={14} color="inherit" /> : '검색'}
            </Button>
          </Box>

          {addrResults.length > 0 && (
            <Paper elevation={3} sx={{
              mt: 0.5, borderRadius: 1.5, overflow: 'hidden',
              maxHeight: 260, overflowY: 'auto',
              border: '1px solid #D1FAE5',
            }}>
              <List dense disablePadding>
                {addrResults.map((item, idx) => {
                  const parts = item.display_name.split(',');
                  return (
                    <ListItem key={item.place_id} disablePadding divider={idx < addrResults.length - 1}>
                      <ListItemButton onClick={() => handleAddrSelect(item)}
                        sx={{ py: 1, '&:hover': { background: '#F0FDF4' } }}>
                        <LocationOnIcon sx={{ fontSize: 16, color: '#16A34A', mr: 1, flexShrink: 0 }} />
                        <ListItemText
                          primary={parts.slice(0, 2).join(' ').trim()}
                          secondary={parts.slice(2, 5).join(', ').trim()}
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

          {!sourceLocation && addrResults.length === 0 && !addrLoading && (
            <Box sx={{
              mt: 0.8, px: 1.5, py: 0.8, borderRadius: 1.5,
              background: 'rgba(255,255,255,0.92)', border: '1px solid #86EFAC',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', gap: 1,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <LocationOnIcon sx={{ fontSize: 15, color: '#16A34A' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#15803D' }}>
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
        <Box sx={{
          position: 'absolute', bottom: 32, right: 12,
          background: 'rgba(255,255,255,0.96)', borderRadius: 1.5, p: 1.2,
          border: '1px solid #D1FAE5', boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        }}>
          <Typography variant="caption" fontWeight={700} display="block" mb={0.6}
            sx={{ color: '#15803D', fontSize: 10 }}>소음도 범례</Typography>
          {[
            ['65dB 미만', '#6B7280'],
            ['65~70dB', '#16A34A'],
            ['70~75dB', '#D97706'],
            ['75~80dB', '#EA580C'],
            ['80dB 이상', '#DC2626'],
          ].map(([l, c]) => (
            <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4 }}>
              <Box sx={{ width: 11, height: 11, borderRadius: '3px', background: c, flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{l}</Typography>
            </Box>
          ))}
        </Box>

        {/* 방음벽 그리기 배너 */}
        {drawMode === 'barrier' && (
          <Box sx={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255,251,235,0.96)', border: '1.5px solid #FDE68A',
            borderRadius: 2, px: 2.5, py: 1, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <EditIcon sx={{ fontSize: 16, color: '#D97706' }} />
            <Typography variant="body2" fontWeight={700} sx={{ color: '#92400E' }}>
              클릭 후 드래그 → 방음벽 그리기 &nbsp;·&nbsp; 완료 후 "그리기 중지" 클릭
            </Typography>
          </Box>
        )}
        {!sourceLocation && drawMode !== 'barrier' && (
          <Box sx={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(240,253,244,0.96)', border: '1.5px solid #86EFAC',
            borderRadius: 2, px: 2.5, py: 1, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <LocationOnIcon sx={{ fontSize: 18, color: '#16A34A' }} />
            <Typography variant="body2" fontWeight={700} color="primary">
              지도를 클릭하여 소음 발생 위치를 선택하세요
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ── 결과 목록 ── */
function ResultList({ results, exceeding, totalComp, sufferingMonths, expandedId, onToggle }) {
  return (
    <Box>
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1.5 }}>
        {[
          { value: results.length, unit: '동', label: '분석 건물', color: '#0EA5E9' },
          { value: exceeding.length, unit: '동', label: '65dB 초과', color: '#DC2626' },
          { value: `${(totalComp / 10000).toFixed(0)}만`, unit: '', label: `${sufferingMonths}개월 보상`, color: '#D97706' },
        ].map(({ value, unit, label, color }) => (
          <Box key={label} sx={{
            textAlign: 'center', p: 1.2, borderRadius: 1.5,
            border: `1.5px solid ${color}25`, background: `${color}08`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.3 }}>
              <Typography variant="h6" fontWeight={900} sx={{ color, lineHeight: 1 }}>{value}</Typography>
              {unit && <Typography variant="caption" sx={{ color, fontWeight: 700 }}>{unit}</Typography>}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5} sx={{ fontSize: 10 }}>
        ▼ 건물 클릭 시 층별 소음 상세 보기
      </Typography>

      <Box sx={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {results.map((r) => {
          const isExpanded = expandedId === r.id;
          const c = COMP_MAP[r.noise_level] || COMP_MAP.safe;
          return (
            <Box key={r.id}>
              <Box onClick={() => onToggle(r)} sx={{
                p: 1, borderRadius: 1.5, cursor: 'pointer',
                border: `1.5px solid ${isExpanded ? '#16A34A' : r.exceeds_65db ? c.color + '55' : '#E5E7EB'}`,
                background: isExpanded ? '#DCFCE7' : r.exceeds_65db ? c.bg : 'white',
                '&:hover': { border: `1.5px solid ${c.color || '#4ADE80'}`, background: '#F0FDF4' },
                transition: 'all 0.15s',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>{r.name || '건물'}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                      {r.floors}층 · {r.distance}m
                    </Typography>
                    {r.barrier_d1 > 0 && (
                      <Typography variant="caption" sx={{ color: '#16A34A', fontFamily: 'monospace', fontSize: 9, display: 'block' }}>
                        d₁={r.barrier_d1}m · d₂={r.barrier_d2}m
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Box sx={{ px: 1, py: 0.2, borderRadius: 1, background: c.bg, border: `1px solid ${c.color}30` }}>
                      <Typography variant="body2" fontWeight={900} sx={{ color: c.color }}>{r.max_noise_db} dB</Typography>
                    </Box>
                    {r.exceeds_65db && (
                      <Typography variant="caption" fontWeight={700} color="error" display="block" sx={{ fontSize: 10 }}>
                        초과 {r.exceeding_floors}층
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ mt: 0.8 }}>
                  <LinearProgress variant="determinate"
                    value={Math.min(100, Math.max(0, (r.max_noise_db - 40) / 60 * 100))}
                    sx={{ '& .MuiLinearProgress-bar': { background: c.color || '#16A34A' } }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.4 }}>
                  {r.exceeds_65db ? (
                    <Typography variant="caption" fontWeight={700} color="error" sx={{ fontSize: 10 }}>
                      인당 ₩{r.total_compensation.toLocaleString()} ({sufferingMonths}개월)
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>보상 대상 아님</Typography>
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

/* ── 층별 소음 테이블 ── */
function FloorTable({ building, sufferingMonths }) {
  const { floor_results = [], total_compensation, floors, distance, name, barrier_d1, barrier_d2 } = building;
  const exceeding = floor_results.filter((f) => f.exceeds_65db);
  return (
    <Box sx={{ ml: 1, mb: 1, borderRadius: 1.5, overflow: 'hidden', border: '1.5px solid #86EFAC' }}>
      <Box sx={{ px: 1.5, py: 0.8, background: 'linear-gradient(90deg, #15803D, #16A34A)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ApartmentIcon sx={{ fontSize: 14, color: 'white' }} />
          <Typography variant="body2" fontWeight={700} sx={{ color: 'white' }}>{name} — 층별 소음</Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 10 }}>초과 {exceeding.length}/{floors}층</Typography>
      </Box>
      <Box sx={{ px: 1.5, py: 0.6, background: '#F0FDF4', borderBottom: '1px solid #D1FAE5',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{distance}m · {floors}층</Typography>
        {barrier_d1 > 0 && (
          <Typography variant="caption" color="success.main" fontWeight={600} sx={{ fontSize: 10 }}>
            d₁={barrier_d1}m / d₂={barrier_d2}m
          </Typography>
        )}
        <Typography variant="caption" fontWeight={700} color="error" sx={{ fontSize: 10 }}>
          인당 {sufferingMonths}개월 총 ₩{total_compensation.toLocaleString()}
        </Typography>
      </Box>
      <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {['층', '높이', '소음도', '방음벽', '보상금'].map((h) => (
                <TableCell key={h} sx={{ py: 0.5, fontSize: 10 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {floor_results.map((f) => {
              const c = COMP_MAP[f.noise_level] || COMP_MAP.safe;
              return (
                <TableRow key={f.floor} sx={{ background: f.exceeds_65db ? c.bg : 'transparent' }}>
                  <TableCell sx={{ py: 0.4, fontSize: 11, fontWeight: 600 }}>{f.floor}층</TableCell>
                  <TableCell sx={{ py: 0.4, fontSize: 11, color: '#6B7280' }}>{f.height_m}m</TableCell>
                  <TableCell sx={{ py: 0.4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <Typography variant="caption" fontWeight={800} sx={{ color: c.color, fontSize: 11 }}>{f.noise_db}dB</Typography>
                    </Box>
                    {f.exceeds_65db && (
                      <Typography variant="caption" color="error" sx={{ fontSize: 9 }}>+{f.excess_db}dB</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 0.4 }}>
                    {f.A_barrier > 0
                      ? <Typography variant="caption" fontWeight={700} color="success.main" sx={{ fontSize: 11 }}>-{f.A_barrier}dB</Typography>
                      : <Typography variant="caption" color="text.disabled">-</Typography>}
                  </TableCell>
                  <TableCell sx={{ py: 0.4 }}>
                    {f.compensation > 0
                      ? <Typography variant="caption" fontWeight={800} color="error" sx={{ fontSize: 11 }}>₩{f.compensation.toLocaleString()}</Typography>
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

/* ── 섹션 카드 ── */
function SectionCard({ step, icon, title, dimmed, children }) {
  return (
    <Box sx={{
      border: `1.5px solid ${dimmed ? '#E5E7EB' : '#D1FAE5'}`,
      borderRadius: 2, mb: 1.5,
      background: dimmed ? '#FAFAFA' : '#FFFFFF',
      boxShadow: dimmed ? 'none' : '0 2px 8px rgba(22,163,74,0.06)',
      opacity: dimmed ? 0.55 : 1,
      transition: 'opacity 0.2s',
    }}>
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
          <Box sx={{
            width: 24, height: 24, borderRadius: '7px', flexShrink: 0,
            background: dimmed ? '#F3F4F6' : 'linear-gradient(135deg, #16A34A, #22C55E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dimmed ? '#9CA3AF' : 'white',
            boxShadow: dimmed ? 'none' : '0 2px 8px rgba(22,163,74,0.3)',
          }}>
            {icon || <Typography sx={{ fontSize: 11, fontWeight: 900 }}>{step}</Typography>}
          </Box>
          <Typography variant="subtitle2" sx={{ color: dimmed ? '#9CA3AF' : '#14532D', fontSize: 12 }}>
            {title}
          </Typography>
          <Box sx={{
            ml: 'auto', px: 0.8, py: 0.1, borderRadius: 1,
            background: dimmed ? '#F3F4F6' : '#DCFCE7',
          }}>
            <Typography sx={{ fontSize: 9, color: dimmed ? '#9CA3AF' : '#15803D', fontWeight: 700 }}>
              0{step}
            </Typography>
          </Box>
        </Box>
        {children}
      </Box>
    </Box>
  );
}
