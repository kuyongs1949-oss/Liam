import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Slider,
  TextField, CircularProgress, Alert, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, Select, MenuItem,
  LinearProgress, Collapse, InputAdornment, Paper, Divider,
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ShieldIcon from '@mui/icons-material/Shield';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ApartmentIcon from '@mui/icons-material/Apartment';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();

const LEVELS = {
  safe:   { label: '안전',     color: '#888888', bg: '#F5F5F5' },
  level1: { label: '경미',     color: '#03C75A', bg: '#E8FAF0' },
  level2: { label: '보통',     color: '#FF8A00', bg: '#FFF4E5' },
  level3: { label: '심각',     color: '#FA5B0F', bg: '#FFF0EA' },
  level4: { label: '매우심각', color: '#FA2828', bg: '#FEF0F0' },
};

function combineLw(list) {
  const total = list.reduce((sum, eq) => {
    const info = EQUIPMENT_LIST.find((e) => e.id === eq.id);
    if (!info) return sum;
    return sum + Math.pow(10, (info.Lw + 10 * Math.log10(Math.max(eq.count, 1))) / 10);
  }, 0);
  return total > 0 ? 10 * Math.log10(total) : 0;
}

const COMP_PERIODS = [
  { endMonth: 6,  amounts: [1_480_000, 2_088_000, 2_959_000, 4_148_000] },
  { endMonth: 12, amounts: [1_894_000, 2_682_000, 3_789_000, 5_365_000] },
  { endMonth: 24, amounts: [2_309_000, 3_263_000, 4_618_000, 6_527_000] },
  { endMonth: 36, amounts: [2_558_000, 3_622_000, 5_117_000, 7_232_000] },
];

function getCompAmt(levelKey, months) {
  const idx = ['level1','level2','level3','level4'].indexOf(levelKey);
  if (idx < 0) return 0;
  const m = Math.min(months, 36);
  let prev = { endMonth: 0, amount: 0 };
  for (const p of COMP_PERIODS) {
    const curr = { endMonth: p.endMonth, amount: p.amounts[idx] };
    if (m <= curr.endMonth) {
      const t = (m - prev.endMonth) / (curr.endMonth - prev.endMonth);
      return Math.round(prev.amount + t * (curr.amount - prev.amount));
    }
    prev = { endMonth: curr.endMonth, amount: curr.amount };
  }
  return prev.amount;
}

export default function SiteAnalysisPage() {
  const [equipments, setEquipments]     = useState([{ id: 'excavator', count: 2 }]);
  const [sourceLocation, setSourceLocation] = useState(null);
  const [radius, setRadius]             = useState(300);
  const [barrierSegments, setBarrierSegments] = useState([]);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [drawMode, setDrawMode]         = useState(null);
  const [sufferingMonths, setSufferingMonths] = useState(3);
  const [addrQuery, setAddrQuery]       = useState('');
  const [addrResults, setAddrResults]   = useState([]);
  const [addrLoading, setAddrLoading]   = useState(false);
  const [flyToLocation, setFlyToLocation] = useState(null);
  const [buildings, setBuildings]       = useState(null);
  const [results, setResults]           = useState([]);
  const [expandedId, setExpandedId]     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [activePanel, setActivePanel]   = useState('equipment');

  const lwTotal = useMemo(() => combineLw(equipments), [equipments]);

  const drawModeRef = useRef(drawMode);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  const handleAddrSearch = useCallback(async () => {
    const q = addrQuery.trim(); if (!q) return;
    setAddrLoading(true); setAddrResults([]);
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=kr&accept-language=ko`, { headers: { 'Accept-Language': 'ko' } });
      const data = await res.json();
      setAddrResults(data);
      if (!data.length) setError('주소 검색 결과가 없습니다.');
    } catch { setError('주소 검색 실패.'); } finally { setAddrLoading(false); }
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
      setActivePanel('results');
    } catch (e) { setError(`오류: ${e.message}`); } finally { setLoading(false); }
  };

  const exceeding = results.filter((r) => r.exceeds_65db);
  const totalComp = exceeding.reduce((s, r) => s + r.total_compensation, 0);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 92px)' }}>

      {/* ══════ 왼쪽 사이드바 ══════ */}
      <Box sx={{
        width: 380, flexShrink: 0,
        background: '#FFFFFF', borderRight: '1px solid #E5E5E5',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { background: '#D0D0D0', borderRadius: 2 },
      }}>

        {/* 검색창 */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid #EBEBEB', background: '#FAFAFA' }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <TextField size="small" fullWidth placeholder="공사현장 주소 검색" value={addrQuery}
              onChange={(e) => { setAddrQuery(e.target.value); if (!e.target.value.trim()) setAddrResults([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddrSearch(); if (e.key === 'Escape') setAddrResults([]); }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px 0 0 6px', background: '#fff', height: 36 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: '#999' }} /></InputAdornment> }}
            />
            <Button variant="contained" color="primary"
              sx={{ px: 1.5, borderRadius: '0 6px 6px 0', minWidth: 52, height: 36, fontSize: 12 }}
              onClick={handleAddrSearch} disabled={addrLoading || !addrQuery.trim()}>
              {addrLoading ? <CircularProgress size={12} color="inherit" /> : '검색'}
            </Button>
          </Box>
          {addrResults.length > 0 && (
            <Paper elevation={2} sx={{ mt: 0.5, borderRadius: 1, border: '1px solid #E5E5E5', overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
              {addrResults.map((item, idx) => {
                const parts = item.display_name.split(',');
                return (
                  <Box key={item.place_id} onClick={() => handleAddrSelect(item)} sx={{
                    display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.9,
                    cursor: 'pointer', borderBottom: idx < addrResults.length - 1 ? '1px solid #F5F5F5' : 'none',
                    '&:hover': { background: '#F8F8F8' },
                  }}>
                    <LocationOnIcon sx={{ fontSize: 14, color: '#03C75A', flexShrink: 0 }} />
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{parts.slice(0, 2).join(' ')}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>{parts.slice(2, 5).join(', ')}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Paper>
          )}
        </Box>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mx: 1.5, mt: 1, borderRadius: 1 }}>{error}</Alert>}

        {/* 아코디언 */}
        <NaverAccordion id="equipment" active={activePanel} onToggle={setActivePanel}
          icon={<GraphicEqIcon sx={{ fontSize: 15 }} />} title="소음 발생 장비"
          badge={`${equipments.length}종`} badgeColor="#03C75A">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, mb: 1 }}>
            {equipments.map((eq, i) => {
              const info = EQUIPMENT_LIST.find((e) => e.id === eq.id);
              const rowLw = info ? +(info.Lw + 10 * Math.log10(Math.max(eq.count, 1))).toFixed(1) : 0;
              return (
                <Box key={i} sx={{ display: 'flex', gap: 0.6, alignItems: 'center', p: 0.8, borderRadius: 1, border: '1px solid #EBEBEB', '&:hover': { border: '1px solid #C0C0C0' } }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <Select value={eq.id} sx={{ fontSize: 12 }}
                      onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}>
                      {EQUIPMENT_LIST.map((e) => (
                        <MenuItem key={e.id} value={e.id}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                            <Typography variant="caption">{e.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{e.Lw}dB</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField size="small" type="number" sx={{ width: 64 }}
                    value={eq.count} inputProps={{ min: 1, max: 30 }}
                    InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption">대</Typography></InputAdornment> }}
                    onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, count: +e.target.value } : x))} />
                  <Box sx={{ textAlign: 'right', minWidth: 44 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>합산Lw</Typography>
                    <Typography variant="caption" fontWeight={700} color="primary">{rowLw}</Typography>
                  </Box>
                  <IconButton size="small" disabled={equipments.length === 1}
                    onClick={() => setEquipments((p) => p.filter((_, j) => j !== i))}>
                    <DeleteIcon sx={{ fontSize: 14, color: '#FA2828' }} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 13 }} />} variant="outlined" color="primary"
              onClick={() => setEquipments((p) => [...p, { id: 'crane', count: 1 }])} sx={{ fontSize: 11 }}>
              장비 추가
            </Button>
            <Box sx={{ ml: 'auto', textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" display="block">합산 음향파워레벨</Typography>
              <Typography variant="h6" fontWeight={900} color="primary" lineHeight={1}>{lwTotal.toFixed(1)} dB</Typography>
            </Box>
          </Box>
        </NaverAccordion>

        <NaverAccordion id="location" active={activePanel} onToggle={setActivePanel}
          icon={<LocationOnIcon sx={{ fontSize: 15 }} />} title="소음원 위치"
          badge={sourceLocation ? '설정완료' : '미설정'} badgeColor={sourceLocation ? '#03C75A' : '#999'}>
          {sourceLocation ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, background: '#E8FAF0', border: '1px solid #C0EDCF' }}>
              <CheckCircleIcon sx={{ color: '#03C75A', fontSize: 18 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700} color="primary">위치 설정 완료</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  {sourceLocation.lat.toFixed(5)}, {sourceLocation.lng.toFixed(5)}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => { setSourceLocation(null); setResults([]); setBuildings(null); setBarrierSegments([]); }}>
                <DeleteIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ p: 1.5, borderRadius: 1, background: '#FAFAFA', border: '1px dashed #D0D0D0', textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">지도를 클릭해 현장 위치 설정</Typography>
            </Box>
          )}
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
              <Typography variant="caption" color="text.secondary">탐색 반경</Typography>
              <Typography variant="caption" fontWeight={700} color="primary">{radius}m</Typography>
            </Box>
            <Slider value={radius} min={100} max={600} step={50}
              marks={[{ value: 100, label: '100m' }, { value: 300, label: '300m' }, { value: 600, label: '600m' }]}
              onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation((p) => ({ ...p, radius: v })); }}
              valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} />
          </Box>
        </NaverAccordion>

        <NaverAccordion id="barrier" active={activePanel} onToggle={setActivePanel}
          icon={<ShieldIcon sx={{ fontSize: 15 }} />} title="방음벽 설정"
          badge={barrierSegments.length ? `${barrierSegments.length}선분` : '없음'} badgeColor={barrierSegments.length ? '#0068C3' : '#999'}
          dimmed={!sourceLocation}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>높이</Typography>
            <Slider value={barrierHeight} min={1} max={12} step={0.5} sx={{ flex: 1 }}
              onChange={(_, v) => setBarrierHeight(v)}
              valueLabelDisplay="on" valueLabelFormat={(v) => `${v}m`} />
            <TextField size="small" type="number" sx={{ width: 64 }}
              value={barrierHeight} inputProps={{ min: 1, max: 12, step: 0.5 }}
              InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
              onChange={(e) => setBarrierHeight(+e.target.value)} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            <Button fullWidth size="small" variant={drawMode === 'barrier' ? 'contained' : 'outlined'}
              color={drawMode === 'barrier' ? 'warning' : 'primary'}
              startIcon={<EditIcon sx={{ fontSize: 13 }} />}
              disabled={!sourceLocation}
              onClick={() => setDrawMode(drawMode === 'barrier' ? null : 'barrier')} sx={{ fontSize: 11 }}>
              {drawMode === 'barrier' ? '그리기 중지' : '펜으로 그리기'}
            </Button>
            {barrierSegments.length > 0 && (
              <Button size="small" color="error" variant="outlined" sx={{ flexShrink: 0, px: 1, fontSize: 11 }}
                onClick={() => setBarrierSegments([])}>삭제</Button>
            )}
          </Box>
          {drawMode === 'barrier' && (
            <Box sx={{ mt: 1, p: 0.8, borderRadius: 1, background: '#FFF4E5', border: '1px solid #FFD89B' }}>
              <Typography variant="caption" color="warning.main" fontWeight={600}>
                지도에서 클릭 후 드래그하여 방음벽을 그리세요
              </Typography>
            </Box>
          )}
        </NaverAccordion>

        <NaverAccordion id="period" active={activePanel} onToggle={setActivePanel}
          icon={<AccessTimeIcon sx={{ fontSize: 15 }} />} title="공사 기간"
          badge={`${sufferingMonths}개월`} badgeColor="#888">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Slider value={sufferingMonths} min={1} max={36} step={1} sx={{ flex: 1 }}
              marks={[{ value: 1, label: '1개월' }, { value: 12, label: '1년' }, { value: 36, label: '3년' }]}
              onChange={(_, v) => setSufferingMonths(v)}
              valueLabelDisplay="on" valueLabelFormat={(v) => `${v}개월`} />
            <Box sx={{ minWidth: 48, textAlign: 'center', p: 0.8, borderRadius: 1, background: '#F5F5F5', border: '1px solid #E0E0E0' }}>
              <Typography fontWeight={900} color="primary" sx={{ fontSize: 16, lineHeight: 1 }}>{sufferingMonths}</Typography>
              <Typography variant="caption" color="text.secondary">개월</Typography>
            </Box>
          </Box>
          <Box sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid #E5E5E5' }}>
            <Box sx={{ px: 1.5, py: 0.6, background: '#03C75A' }}>
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 700, fontSize: 10 }}>
                환경분쟁조정위원회 배상 기준 (2026.1.1~) — 인당 총액
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', px: 1, py: 0.4, background: '#F7F7F7', borderBottom: '1px solid #E5E5E5' }}>
              {['소음도', '초과범위', `${sufferingMonths}개월`].map((h) => (
                <Typography key={h} variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 700 }}>{h}</Typography>
              ))}
            </Box>
            {['level1','level2','level3','level4'].map((key, bi) => {
              const lv = LEVELS[key];
              const ranges = ['65~70dB','70~75dB','75~80dB','80dB↑'];
              const excess = ['1~5dB','6~10dB','11~15dB','16dB↑'];
              return (
                <Box key={key} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', px: 1, py: 0.4, background: lv.bg, borderBottom: '1px solid #EBEBEB' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: lv.color, flexShrink: 0 }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: lv.color, fontSize: 10 }}>{ranges[bi]}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>초과 {excess[bi]}</Typography>
                  <Typography variant="caption" fontWeight={800} sx={{ color: lv.color, fontSize: 10 }}>₩{getCompAmt(key, sufferingMonths).toLocaleString()}</Typography>
                </Box>
              );
            })}
          </Box>
        </NaverAccordion>

        {/* 분석 버튼 */}
        <Box sx={{ p: 1.5, borderTop: '1px solid #EBEBEB', background: '#FAFAFA' }}>
          <Button variant="contained" color="primary" size="large" fullWidth
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CalculateIcon />}
            disabled={!sourceLocation || loading}
            onClick={handleCalculate}
            sx={{ height: 42, fontSize: 14, borderRadius: 1 }}>
            {loading ? '분석 중...' : '소음 영향 분석'}
          </Button>
        </Box>

        {/* 결과 */}
        {results.length > 0 && (
          <Box>
            <Divider />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', p: 1.5, gap: 1, background: '#FAFAFA', borderBottom: '1px solid #EBEBEB' }}>
              {[
                { v: results.length, u: '동', l: '분석 건물', c: '#0068C3' },
                { v: exceeding.length, u: '동', l: '65dB 초과', c: '#FA2828' },
                { v: `${Math.round(totalComp / 10000)}만`, u: '원', l: `${sufferingMonths}개월`, c: '#FF8A00' },
              ].map(({ v, u, l, c }) => (
                <Box key={l} sx={{ textAlign: 'center', p: 1, borderRadius: 1, background: '#fff', border: '1px solid #EBEBEB' }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.2 }}>
                    <Typography fontWeight={900} sx={{ color: c, fontSize: 18, lineHeight: 1 }}>{v}</Typography>
                    <Typography variant="caption" sx={{ color: c, fontWeight: 700 }}>{u}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{l}</Typography>
                </Box>
              ))}
            </Box>

            {results.map((r) => {
              const lv = LEVELS[r.noise_level] || LEVELS.safe;
              const isExp = expandedId === r.id;
              return (
                <Box key={r.id}>
                  <Box onClick={() => setExpandedId(isExp ? null : r.id)} sx={{
                    display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.1,
                    cursor: 'pointer', borderBottom: '1px solid #F0F0F0',
                    background: isExp ? lv.bg : '#fff',
                    '&:hover': { background: lv.bg }, transition: 'background 0.1s',
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: r.exceeds_65db ? lv.color : '#D0D0D0' }} />
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{r.name || '건물'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.floors}층 · {r.distance}m{r.barrier_d1 > 0 ? ` · d₁=${r.barrier_d1}m` : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography fontWeight={800} sx={{ color: lv.color, fontSize: 13 }}>{r.max_noise_db} dB</Typography>
                      {r.exceeds_65db && <Typography variant="caption" color="error" sx={{ fontSize: 10 }}>₩{r.total_compensation.toLocaleString()}</Typography>}
                    </Box>
                    {isExp ? <ExpandLessIcon sx={{ fontSize: 16, color: '#999', flexShrink: 0 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 16, color: '#999', flexShrink: 0 }} />}
                  </Box>
                  <LinearProgress variant="determinate"
                    value={Math.min(100, Math.max(0, (r.max_noise_db - 40) / 60 * 100))}
                    sx={{ height: 2, '& .MuiLinearProgress-bar': { background: lv.color } }} />
                  <Collapse in={isExp}>
                    <FloorTable building={r} sufferingMonths={sufferingMonths} />
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ══════ 오른쪽 지도 ══════ */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {drawMode === 'barrier' && (
          <Box sx={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 5, background: 'rgba(255,255,255,0.96)', borderRadius: 1,
            px: 2, py: 0.8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: '1px solid #FFD89B',
            display: 'flex', alignItems: 'center', gap: 1, pointerEvents: 'none',
          }}>
            <EditIcon sx={{ fontSize: 15, color: '#FF8A00' }} />
            <Typography variant="body2" fontWeight={600} sx={{ color: '#B35D00' }}>클릭 후 드래그 → 방음벽 선 그리기</Typography>
          </Box>
        )}
        {!sourceLocation && drawMode !== 'barrier' && (
          <Box sx={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 5, background: 'rgba(255,255,255,0.96)', borderRadius: 1,
            px: 2, py: 0.8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 1, pointerEvents: 'none',
          }}>
            <LocationOnIcon sx={{ fontSize: 15, color: '#03C75A' }} />
            <Typography variant="body2" fontWeight={600} color="primary">지도를 클릭하여 소음 발생 위치를 선택하세요</Typography>
          </Box>
        )}
        <Box sx={{
          position: 'absolute', bottom: 32, right: 10, zIndex: 5,
          background: 'rgba(255,255,255,0.96)', borderRadius: 1,
          p: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #E5E5E5',
        }}>
          <Typography variant="caption" fontWeight={700} display="block" mb={0.5} color="text.secondary">소음도</Typography>
          {[['65dB 미만','#888'],['65~70dB','#03C75A'],['70~75dB','#FF8A00'],['75~80dB','#FA5B0F'],['80dB↑','#FA2828']].map(([l, c]) => (
            <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.3 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '2px', background: c, flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{l}</Typography>
            </Box>
          ))}
        </Box>
        <MapLibre3D
          sourceLocation={sourceLocation} barrierCoords={barrierSegments}
          buildingGeoJSON={buildings} drawMode={drawMode} barrierHeight={barrierHeight}
          flyToLocation={flyToLocation} onSourceSet={handleSourceSet}
          onBarrierComplete={handleBarrierComplete}
          onBuildingSelect={(props) => {
            if (!props) return;
            const r = results.find((r) => r.id === props.id);
            if (r) setExpandedId((p) => p === r.id ? null : r.id);
          }}
        />
      </Box>
    </Box>
  );
}

function NaverAccordion({ id, active, onToggle, icon, title, badge, badgeColor, dimmed, children }) {
  const isOpen = active === id;
  return (
    <Box sx={{ borderBottom: '1px solid #EBEBEB', opacity: dimmed ? 0.45 : 1 }}>
      <Box onClick={() => !dimmed && onToggle(isOpen ? null : id)} sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.1,
        cursor: dimmed ? 'default' : 'pointer',
        '&:hover': !dimmed ? { background: '#F8F8F8' } : {}, userSelect: 'none',
      }}>
        <Box sx={{ color: isOpen ? '#03C75A' : '#888', flexShrink: 0 }}>{icon}</Box>
        <Typography variant="body2" fontWeight={600} sx={{ flex: 1, color: isOpen ? '#222' : '#444' }}>{title}</Typography>
        {badge && (
          <Box sx={{ px: 0.8, py: 0.1, borderRadius: 0.5, background: `${badgeColor}18` }}>
            <Typography variant="caption" sx={{ color: badgeColor, fontWeight: 700, fontSize: 10 }}>{badge}</Typography>
          </Box>
        )}
        {isOpen ? <ExpandLessIcon sx={{ fontSize: 16, color: '#999', flexShrink: 0 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 16, color: '#999', flexShrink: 0 }} />}
      </Box>
      <Collapse in={isOpen}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function FloorTable({ building, sufferingMonths }) {
  const { floor_results = [], total_compensation, name, barrier_d1, barrier_d2 } = building;
  return (
    <Box sx={{ background: '#FAFAFA', borderBottom: '2px solid #03C75A' }}>
      <Box sx={{ px: 1.5, py: 0.8, background: '#F2F2F2', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ApartmentIcon sx={{ fontSize: 13, color: '#555' }} />
          <Typography variant="caption" fontWeight={700}>{name} 층별 소음</Typography>
        </Box>
        <Typography variant="caption" color="error" fontWeight={700}>인당 ₩{total_compensation.toLocaleString()}</Typography>
      </Box>
      {barrier_d1 > 0 && (
        <Box sx={{ px: 1.5, py: 0.4, background: '#E8FAF0', borderBottom: '1px solid #C0EDCF' }}>
          <Typography variant="caption" color="primary" fontWeight={600} sx={{ fontSize: 10 }}>
            방음벽 d₁={barrier_d1}m / d₂={barrier_d2}m
          </Typography>
        </Box>
      )}
      <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {['층','소음도','방음벽','배상금'].map((h) => <TableCell key={h} sx={{ py: 0.4, fontSize: 10 }}>{h}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {floor_results.map((f) => {
              const lv = LEVELS[f.noise_level] || LEVELS.safe;
              return (
                <TableRow key={f.floor} sx={{ background: f.exceeds_65db ? lv.bg : 'transparent' }}>
                  <TableCell sx={{ fontWeight: 600 }}>{f.floor}층</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: lv.color, flexShrink: 0 }} />
                      <Typography variant="caption" fontWeight={800} sx={{ color: lv.color }}>{f.noise_db}dB</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {f.A_barrier > 0 ? <Typography variant="caption" fontWeight={700} color="primary">-{f.A_barrier}dB</Typography>
                      : <Typography variant="caption" color="text.disabled">-</Typography>}
                  </TableCell>
                  <TableCell>
                    {f.compensation > 0 ? <Typography variant="caption" fontWeight={800} color="error">₩{f.compensation.toLocaleString()}</Typography>
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
