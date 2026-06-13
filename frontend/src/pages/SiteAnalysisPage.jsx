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
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ShieldIcon from '@mui/icons-material/Shield';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ApartmentIcon from '@mui/icons-material/Apartment';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';

import MapLibre3D from '../components/MapLibre3D';
import { queryBuildings } from '../services/buildingService';
import { calculateBuildingNoise, getEquipments } from '../services/noiseEngine';

const EQUIPMENT_LIST = getEquipments();

const LEVELS = {
  safe:   { label: '안전',     color: '#5F6368', bg: '#F1F3F4' },
  level1: { label: '경미',     color: '#0F9D58', bg: '#E6F4EA' },
  level2: { label: '보통',     color: '#E37400', bg: '#FEF7E0' },
  level3: { label: '심각',     color: '#C5221F', bg: '#FCE8E6' },
  level4: { label: '매우심각', color: '#B31412', bg: '#FCE8E6' },
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

function getCompAmt(key, months) {
  const idx = ['level1','level2','level3','level4'].indexOf(key);
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
  const [equipments, setEquipments]       = useState([{ id: 'excavator', count: 2 }]);
  const [sourceLocation, setSourceLocation] = useState(null);
  const [radius, setRadius]               = useState(300);
  const [barrierSegments, setBarrierSegments] = useState([]);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [drawMode, setDrawMode]           = useState(null);
  const [sufferingMonths, setSufferingMonths] = useState(3);
  const [addrQuery, setAddrQuery]         = useState('');
  const [addrResults, setAddrResults]     = useState([]);
  const [addrLoading, setAddrLoading]     = useState(false);
  const [flyToLocation, setFlyToLocation] = useState(null);
  const [buildings, setBuildings]         = useState(null);
  const [results, setResults]             = useState([]);
  const [expandedId, setExpandedId]       = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [panelOpen, setPanelOpen]         = useState(true);  // 사이드 패널 토글

  const lwTotal = useMemo(() => combineLw(equipments), [equipments]);
  const drawModeRef = useRef(drawMode);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  const handleAddrSearch = useCallback(async () => {
    const q = addrQuery.trim(); if (!q) return;
    setAddrLoading(true); setAddrResults([]);
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=kr&accept-language=ko`);
      const data = await res.json();
      setAddrResults(data);
      if (!data.length) setError('주소 검색 결과가 없습니다.');
    } catch { setError('주소 검색 실패.'); } finally { setAddrLoading(false); }
  }, [addrQuery]);

  const handleAddrSelect = useCallback((item) => {
    setFlyToLocation({ lng: parseFloat(item.lon), lat: parseFloat(item.lat), zoom: 16 });
    setAddrResults([]); setAddrQuery(item.display_name.split(',')[0]);
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
    if (!sourceLocation) { setError('지도를 클릭해 현장 위치를 선택하세요.'); return; }
    if (!barrierSegments.length) { setError('방음벽을 먼저 그려주세요. 방음벽은 필수 입력 항목입니다.'); return; }
    setLoading(true); setError('');
    try {
      const geoJSON = await queryBuildings(sourceLocation.lat, sourceLocation.lng, radius);
      if (!geoJSON.features.length) {
        setError('주변 건물 데이터가 없습니다. 반경을 늘려 다시 시도하세요.');
        setLoading(false); return;
      }
      const calcResults = geoJSON.features.map((f) =>
        calculateBuildingNoise({
          lwTotal, sourceLat: sourceLocation.lat, sourceLng: sourceLocation.lng,
          building: f.properties, barrierSegments,
          barrierHeight, sufferingMonths,
        })
      );

      // OSM 주소가 없는 건물만 Nominatim 역지오코딩 (최대 5건 병렬)
      const noAddr = calcResults.filter((r) => !r.addr);
      const chunks = [];
      for (let i = 0; i < noAddr.length; i += 5) chunks.push(noAddr.slice(i, i + 5));
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (r) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${r.centroid_lat}&lon=${r.centroid_lng}&format=json&accept-language=ko`,
              { headers: { 'User-Agent': 'NoiseAssessmentSystem/1.0' } }
            );
            const data = await res.json();
            const a = data.address || {};
            r.addr = [a.road, a.house_number].filter(Boolean).join(' ')
              || a.suburb || a.quarter || a.neighbourhood || data.display_name?.split(',')[0] || '';
            if (!r.name || r.name === '건물') {
              r.name = a.building || a.amenity || a.leisure || '건물';
            }
          } catch { /* 실패 시 공백 유지 */ }
        }));
      }

      setBuildings({
        ...geoJSON,
        features: geoJSON.features.map((f, i) => {
          const r = calcResults[i];
          return { ...f, properties: {
            id: r.id, name: r.name || '건물', floors: r.floors,
            height: r.height || r.floors * 3, color: r.color,
            max_noise_db: r.max_noise_db, noise_level: r.noise_level || 'safe',
            exceeds_65db: r.exceeds_65db ? 1 : 0, exceeding_floors: r.exceeding_floors,
            distance: r.distance,
          }};
        }),
      });
      setResults(calcResults.sort((a, b) => b.max_noise_db - a.max_noise_db));
    } catch (e) { setError(`오류: ${e.message}`); } finally { setLoading(false); }
  };

  const exceeding = results.filter((r) => r.exceeds_65db);
  const totalComp = exceeding.reduce((s, r) => s + r.total_compensation, 0);

  return (
    <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>

      {/* ══════ 지도 (전체 배경) ══════ */}
      <Box sx={{ position: 'absolute', inset: 0 }}>
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

      {/* ══════ 플로팅 검색창 (구글 지도 스타일) ══════ */}
      <Box sx={{
        position: 'absolute', top: 16, left: panelOpen ? 392 : 16, right: 16,
        zIndex: 20, display: 'flex', gap: 1, transition: 'left 0.25s ease',
        maxWidth: 480,
      }}>
        <Box sx={{ flex: 1, position: 'relative' }}>
          <TextField
            fullWidth size="small"
            placeholder="공사현장 주소 검색..."
            value={addrQuery}
            onChange={(e) => { setAddrQuery(e.target.value); if (!e.target.value.trim()) setAddrResults([]); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddrSearch(); if (e.key === 'Escape') setAddrResults([]); }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#5F6368', fontSize: 20 }} /></InputAdornment>,
              endAdornment: addrQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setAddrQuery(''); setAddrResults([]); }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 28, background: '#fff', height: 48,
                boxShadow: '0 2px 6px rgba(60,64,67,0.3)',
                '&:hover': { boxShadow: '0 2px 8px rgba(60,64,67,0.35)' },
              },
            }}
          />
          {addrResults.length > 0 && (
            <Paper elevation={3} sx={{ mt: 0.5, borderRadius: 2, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
              {addrResults.map((item, i) => (
                <Box key={item.place_id} onClick={() => handleAddrSelect(item)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.2,
                  cursor: 'pointer', borderBottom: i < addrResults.length - 1 ? '1px solid #F1F3F4' : 'none',
                  '&:hover': { background: '#F8F9FA' },
                }}>
                  <LocationOnIcon sx={{ fontSize: 18, color: '#EA4335', flexShrink: 0 }} />
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {item.display_name.split(',').slice(0, 2).join(' ')}
                    </Typography>
                    <Typography variant="caption" noWrap>
                      {item.display_name.split(',').slice(2, 5).join(', ')}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          )}
        </Box>

        <Button
          variant="contained" color="primary" onClick={handleAddrSearch}
          disabled={addrLoading || !addrQuery.trim()}
          sx={{ height: 48, px: 2.5, borderRadius: 24, flexShrink: 0, boxShadow: '0 2px 6px rgba(60,64,67,0.3)' }}>
          {addrLoading ? <CircularProgress size={16} color="inherit" /> : '검색'}
        </Button>
      </Box>

      {/* ══════ 왼쪽 사이드 패널 ══════ */}
      <Box sx={{
        position: 'relative', zIndex: 10,
        width: panelOpen ? 376 : 0, flexShrink: 0,
        overflow: 'hidden', transition: 'width 0.25s ease',
      }}>
        <Box sx={{
          width: 376, height: '100%',
          background: '#FFFFFF',
          boxShadow: '2px 0 8px rgba(60,64,67,0.2)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { background: '#BDC1C6', borderRadius: 2 },
        }}>

          {error && (
            <Alert severity="error" onClose={() => setError('')} sx={{ m: 1.5, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* 1. 장비 선택 */}
          <GoogleSection icon={<VolumeUpIcon sx={{ fontSize: 18, color: '#1A73E8' }} />} title="소음 발생 장비">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 1.5 }}>
              {equipments.map((eq, i) => {
                const info = EQUIPMENT_LIST.find((e) => e.id === eq.id);
                const rowLw = info ? +(info.Lw + 10 * Math.log10(Math.max(eq.count, 1))).toFixed(1) : 0;
                return (
                  <Box key={i} sx={{
                    display: 'flex', gap: 0.8, alignItems: 'center',
                    p: 1, borderRadius: 2, background: '#F8F9FA',
                    '&:hover': { background: '#F1F3F4' },
                  }}>
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <Select value={eq.id} sx={{ fontSize: 13, borderRadius: 2, background: '#fff' }}
                        onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}>
                        {EQUIPMENT_LIST.map((e) => (
                          <MenuItem key={e.id} value={e.id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                              <Typography variant="body2">{e.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{e.Lw}dB</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField size="small" type="number" sx={{ width: 68 }}
                      value={eq.count} inputProps={{ min: 1, max: 30 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end"><Typography variant="caption">대</Typography></InputAdornment>,
                        sx: { borderRadius: 2, background: '#fff' },
                      }}
                      onChange={(e) => setEquipments((p) => p.map((x, j) => j === i ? { ...x, count: +e.target.value } : x))} />
                    <Box sx={{ textAlign: 'center', minWidth: 40 }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>Lw합산</Typography>
                      <Typography variant="caption" fontWeight={600} color="primary">{rowLw}</Typography>
                    </Box>
                    <IconButton size="small" disabled={equipments.length === 1}
                      onClick={() => setEquipments((p) => p.filter((_, j) => j !== i))}>
                      <DeleteIcon sx={{ fontSize: 16, color: '#EA4335' }} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setEquipments((p) => [...p, { id: 'crane', count: 1 }])}
                sx={{ borderRadius: 20, fontSize: 12 }}>
                장비 추가
              </Button>
              <Box sx={{
                px: 2, py: 0.8, borderRadius: 20,
                background: '#E8F0FE', display: 'flex', alignItems: 'baseline', gap: 0.5,
              }}>
                <Typography fontWeight={700} color="primary" sx={{ fontSize: 18, lineHeight: 1 }}>
                  {lwTotal.toFixed(1)}
                </Typography>
                <Typography variant="caption" color="primary" fontWeight={500}>dB(A)</Typography>
              </Box>
            </Box>
          </GoogleSection>

          {/* 2. 현장 위치 */}
          <GoogleSection icon={<MyLocationIcon sx={{ fontSize: 18, color: '#EA4335' }} />} title="소음원 위치">
            {sourceLocation ? (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2,
                background: '#E6F4EA', mb: 1.5,
              }}>
                <CheckCircleIcon sx={{ color: '#0F9D58', fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} color="secondary">위치 설정 완료</Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {sourceLocation.lat.toFixed(5)}, {sourceLocation.lng.toFixed(5)}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => { setSourceLocation(null); setResults([]); setBuildings(null); setBarrierSegments([]); }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ p: 2, borderRadius: 2, background: '#F8F9FA', textAlign: 'center', mb: 1.5 }}>
                <LocationOnIcon sx={{ color: '#BDC1C6', fontSize: 28, mb: 0.5 }} />
                <Typography variant="body2" color="text.secondary">지도를 클릭해 현장 위치 선택</Typography>
              </Box>
            )}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">탐색 반경</Typography>
                <Typography variant="caption" fontWeight={600} color="primary">{radius}m</Typography>
              </Box>
              <Slider value={radius} min={100} max={600} step={50}
                marks={[{value:100,label:'100m'},{value:300,label:'300m'},{value:600,label:'600m'}]}
                onChange={(_, v) => { setRadius(v); if (sourceLocation) setSourceLocation((p) => ({...p, radius: v})); }}
                valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}m`} />
            </Box>
          </GoogleSection>

          {/* 3. 방음벽 */}
          <GoogleSection icon={<ShieldIcon sx={{ fontSize: 18, color: '#C5221F' }} />} title="방음벽 설정" required={!barrierSegments.length}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28, flexShrink: 0 }}>높이</Typography>
              <Slider value={barrierHeight} min={1} max={12} step={0.5} sx={{ flex: 1 }}
                onChange={(_, v) => setBarrierHeight(v)}
                valueLabelDisplay="on" valueLabelFormat={(v) => `${v}m`} />
              <TextField size="small" type="number" sx={{ width: 72 }}
                value={barrierHeight} inputProps={{ min: 1, max: 12, step: 0.5 }}
                InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  sx: { borderRadius: 2 } }}
                onChange={(e) => setBarrierHeight(+e.target.value)} />
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button fullWidth size="small"
                variant={drawMode === 'barrier' ? 'contained' : 'outlined'}
                color={drawMode === 'barrier' ? 'warning' : 'primary'}
                startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                disabled={!sourceLocation}
                onClick={() => setDrawMode(drawMode === 'barrier' ? null : 'barrier')}
                sx={{ borderRadius: 20, fontSize: 12 }}>
                {drawMode === 'barrier' ? '그리기 중지' : '펜으로 그리기'}
              </Button>
              {barrierSegments.length > 0 && (
                <Button size="small" color="error" variant="text"
                  onClick={() => setBarrierSegments([])} sx={{ flexShrink: 0, borderRadius: 20, fontSize: 12 }}>
                  삭제
                </Button>
              )}
            </Box>

            {barrierSegments.length > 0 && (
              <Box sx={{ mt: 1.5, p: 1.2, borderRadius: 2, background: '#E8F0FE' }}>
                <Typography variant="caption" fontWeight={600} color="primary" display="block" mb={0.5}>
                  방음벽 {barrierSegments.length}선분 — ISO 9613-2 경로차 감쇠
                </Typography>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>소음원 → 방음벽</Typography>
                    <Typography variant="caption" fontWeight={700} color="primary">d₁ = 건물별 자동</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>방음벽 → 수음점</Typography>
                    <Typography variant="caption" fontWeight={700} color="primary">d₂ = 건물별 자동</Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </GoogleSection>

          {/* 4. 공사 기간 */}
          <GoogleSection icon={<AccessTimeIcon sx={{ fontSize: 18, color: '#E37400' }} />} title="공사 기간">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Slider value={sufferingMonths} min={1} max={36} step={1} sx={{ flex: 1 }}
                marks={[{value:1,label:'1개월'},{value:12,label:'1년'},{value:36,label:'3년'}]}
                onChange={(_, v) => setSufferingMonths(v)}
                valueLabelDisplay="on" valueLabelFormat={(v) => `${v}개월`} />
              <Box sx={{ minWidth: 52, textAlign: 'center', p: 1, borderRadius: 2, background: '#FEF7E0' }}>
                <Typography fontWeight={700} color="warning.main" sx={{ fontSize: 18, lineHeight: 1 }}>{sufferingMonths}</Typography>
                <Typography variant="caption" color="warning.main">개월</Typography>
              </Box>
            </Box>

            {/* 보상표 */}
            <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #E8EAED' }}>
              <Box sx={{ px: 2, py: 1, background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  환경분쟁조정위원회 배상 기준 (2026.1.1~) — 인당 누적
                </Typography>
              </Box>
              {['level1','level2','level3','level4'].map((key, bi) => {
                const lv = LEVELS[key];
                const ranges  = ['65~70dB','70~75dB','75~80dB','80dB↑'];
                const excess  = ['1~5dB','6~10dB','11~15dB','16dB↑'];
                const amt     = getCompAmt(key, sufferingMonths);
                return (
                  <Box key={key} sx={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    px: 2, py: 0.8, alignItems: 'center',
                    background: lv.bg,
                    borderBottom: bi < 3 ? '1px solid #E8EAED' : 'none',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: lv.color }} />
                      <Typography variant="caption" fontWeight={600} sx={{ color: lv.color }}>{ranges[bi]}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">초과 {excess[bi]}</Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ color: lv.color }}>
                      ₩{amt.toLocaleString()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </GoogleSection>

          {/* 분석 버튼 */}
          <Box sx={{ p: 2, borderTop: '1px solid #E8EAED' }}>
            <Button variant="contained" color="primary" size="large" fullWidth
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
              disabled={!sourceLocation || !barrierSegments.length || loading} onClick={handleCalculate}
              sx={{ height: 48, borderRadius: 24, fontSize: 15, fontWeight: 500,
                boxShadow: '0 2px 6px rgba(26,115,232,0.4)' }}>
              {loading ? '분석 중...' : '소음 영향 분석'}
            </Button>
            {sourceLocation && !barrierSegments.length && (
              <Box sx={{ mt: 1, p: 1.2, borderRadius: 2, background: '#FCE8E6', display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldIcon sx={{ fontSize: 16, color: '#C5221F', flexShrink: 0 }} />
                <Typography variant="caption" color="error" fontWeight={500}>
                  방음벽을 그려야 분석할 수 있습니다
                </Typography>
              </Box>
            )}
          </Box>

          {/* ── 결과 ── */}
          {results.length > 0 && (
            <Box>
              <Divider />
              {/* 요약 카드 */}
              <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                {[
                  { v: results.length, u: '동', l: '분석', c: '#1A73E8', bg: '#E8F0FE' },
                  { v: exceeding.length, u: '동', l: '초과', c: '#C5221F', bg: '#FCE8E6' },
                  { v: `${Math.round(totalComp/10000)}만`, u: '원', l: `${sufferingMonths}개월`, c: '#E37400', bg: '#FEF7E0' },
                ].map(({ v, u, l, c, bg }) => (
                  <Box key={l} sx={{ textAlign: 'center', p: 1.2, borderRadius: 2, background: bg }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.2 }}>
                      <Typography fontWeight={700} sx={{ color: c, fontSize: 20, lineHeight: 1 }}>{v}</Typography>
                      <Typography variant="caption" sx={{ color: c, fontWeight: 600 }}>{u}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">{l}</Typography>
                  </Box>
                ))}
              </Box>

              {/* 건물 목록 */}
              {results.map((r) => {
                const lv  = LEVELS[r.noise_level] || LEVELS.safe;
                const isE = expandedId === r.id;
                return (
                  <Box key={r.id}>
                    <Box onClick={() => setExpandedId(isE ? null : r.id)} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 2, py: 1.2, cursor: 'pointer',
                      borderBottom: '1px solid #F1F3F4',
                      background: isE ? lv.bg : '#fff',
                      '&:hover': { background: isE ? lv.bg : '#F8F9FA' },
                    }}>
                      <Box sx={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: r.exceeds_65db ? lv.bg : '#F1F3F4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${r.exceeds_65db ? lv.color : '#E8EAED'}`,
                      }}>
                        <ApartmentIcon sx={{ fontSize: 16, color: r.exceeds_65db ? lv.color : '#BDC1C6' }} />
                      </Box>
                      <Box sx={{ flex: 1, overflow: 'hidden' }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {r.name && r.name !== '건물' ? r.name : `건물 (${r.distance}m)`}
                        </Typography>
                        {r.addr && (
                          <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ fontSize: 11 }}>
                            {r.addr}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                          <Typography variant="caption" color="text.secondary">
                            {r.floors}층 · {r.distance}m
                          </Typography>
                          {r.barrier_d1 > 0 && (
                            <Typography variant="caption" fontWeight={600} color="primary" sx={{ fontSize: 11 }}>
                              d₁={r.barrier_d1}m d₂={r.barrier_d2}m
                            </Typography>
                          )}
                        </Box>
                        <LinearProgress variant="determinate"
                          value={Math.min(100, Math.max(0, (r.max_noise_db - 40) / 60 * 100))}
                          sx={{ mt: 0.5, height: 3, '& .MuiLinearProgress-bar': { background: lv.color } }} />
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography fontWeight={700} sx={{ color: lv.color, fontSize: 14 }}>{r.max_noise_db} dB</Typography>
                        {r.exceeds_65db && (
                          <Typography variant="caption" sx={{ color: lv.color, fontSize: 10 }}>
                            ₩{Math.round(r.total_compensation/10000)}만
                          </Typography>
                        )}
                      </Box>
                      {isE ? <ExpandLessIcon sx={{ fontSize: 18, color: '#9AA0A6' }} />
                            : <ChevronRightIcon sx={{ fontSize: 18, color: '#9AA0A6' }} />}
                    </Box>
                    <Collapse in={isE}>
                      <FloorTable building={r} sufferingMonths={sufferingMonths} />
                    </Collapse>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* ══════ 구글 지도 스타일 하단 HUD ══════ */}
      {/* 패널 토글 버튼 */}
      <Box sx={{
        position: 'absolute', top: 80, left: panelOpen ? 392 : 16, zIndex: 20,
        transition: 'left 0.25s ease',
      }}>
        <Button variant="contained" color="inherit"
          onClick={() => setPanelOpen(!panelOpen)}
          sx={{
            minWidth: 0, width: 40, height: 40, borderRadius: '50%', p: 0,
            background: '#fff', color: '#5F6368',
            boxShadow: '0 2px 6px rgba(60,64,67,0.3)',
            '&:hover': { background: '#F1F3F4' },
          }}>
          {panelOpen ? <ChevronRightIcon /> : <TuneIcon />}
        </Button>
      </Box>

      {/* 범례 (우하단) */}
      <Paper elevation={2} sx={{
        position: 'absolute', bottom: 28, right: 16, zIndex: 10,
        borderRadius: 2, p: 1.5, minWidth: 120,
      }}>
        <Typography variant="caption" fontWeight={600} display="block" mb={0.8} color="text.secondary">
          소음도
        </Typography>
        {[
          ['65dB 미만', '#5F6368'],
          ['65~70dB',   '#0F9D58'],
          ['70~75dB',   '#E37400'],
          ['75~80dB',   '#C5221F'],
          ['80dB 이상', '#B31412'],
        ].map(([l, c]) => (
          <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">{l}</Typography>
          </Box>
        ))}
      </Paper>

      {/* 방음벽 모드 힌트 */}
      {drawMode === 'barrier' && (
        <Paper elevation={3} sx={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, borderRadius: 24, px: 3, py: 1.2,
          display: 'flex', alignItems: 'center', gap: 1.5, pointerEvents: 'none',
        }}>
          <EditIcon sx={{ fontSize: 16, color: '#1A73E8' }} />
          <Typography variant="body2" fontWeight={500}>
            클릭 후 드래그하여 방음벽 선을 그리세요
          </Typography>
        </Paper>
      )}

      {/* 위치 선택 안내 */}
      {!sourceLocation && !drawMode && (
        <Paper elevation={3} sx={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, borderRadius: 24, px: 3, py: 1.2,
          display: 'flex', alignItems: 'center', gap: 1.5, pointerEvents: 'none',
        }}>
          <LocationOnIcon sx={{ fontSize: 16, color: '#EA4335' }} />
          <Typography variant="body2" fontWeight={500}>
            지도를 클릭하여 소음 발생 위치를 선택하세요
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

/* ── 구글 스타일 섹션 ── */
function GoogleSection({ icon, title, dimmed, required, children }) {
  return (
    <Box sx={{
      borderBottom: '1px solid #E8EAED',
      opacity: dimmed ? 0.5 : 1,
      transition: 'opacity 0.2s',
      background: required ? '#FFF8F7' : 'transparent',
    }}>
      <Box sx={{ px: 2, pt: 2, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        <Typography variant="subtitle2" color={required ? 'error' : 'text.primary'}>{title}</Typography>
        {required && (
          <Box sx={{ ml: 'auto', px: 1, py: 0.2, borderRadius: 10, background: '#FCE8E6' }}>
            <Typography variant="caption" fontWeight={700} color="error" sx={{ fontSize: 10 }}>필수</Typography>
          </Box>
        )}
      </Box>
      <Box sx={{ px: 2, pb: 2, pt: 1 }}>{children}</Box>
    </Box>
  );
}

/* ── 층별 테이블 ── */
function FloorTable({ building, sufferingMonths }) {
  const { floor_results = [], total_compensation, name, addr, barrier_d1, barrier_d2, floors, distance } = building;
  const displayName = name && name !== '건물' ? name : `건물`;
  return (
    <Box sx={{ background: '#F8F9FA', borderBottom: '3px solid #1A73E8' }}>
      <Box sx={{ px: 2, py: 1, background: '#E8F0FE' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ApartmentIcon sx={{ fontSize: 14, color: '#1A73E8' }} />
            <Typography variant="caption" fontWeight={700} color="primary">{displayName}</Typography>
          </Box>
          <Typography variant="caption" fontWeight={700} color="error">인당 ₩{total_compensation.toLocaleString()}</Typography>
        </Box>
        {addr && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 11, mt: 0.2 }}>
            {addr} · {floors}층 · {distance}m
          </Typography>
        )}
      </Box>
      {barrier_d1 > 0 && (
        <Box sx={{ px: 2, py: 0.6, background: '#E8F0FE', borderBottom: '1px solid #BDC1C6' }}>
          <Typography variant="caption" color="primary" fontWeight={500}>
            d₁ = {barrier_d1}m (소음원→방음벽) &nbsp;/&nbsp; d₂ = {barrier_d2}m (방음벽→수음점)
          </Typography>
        </Box>
      )}
      <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {['층', '소음도', '방음벽 감쇠', '배상금(인당)'].map((h) => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {floor_results.map((f) => {
              const lv = LEVELS[f.noise_level] || LEVELS.safe;
              return (
                <TableRow key={f.floor} sx={{ background: f.exceeds_65db ? lv.bg : 'transparent' }}>
                  <TableCell fontWeight={500}>{f.floor}층</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: lv.color }} />
                      <Typography variant="caption" fontWeight={700} sx={{ color: lv.color }}>{f.noise_db}dB</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {f.A_barrier > 0
                      ? <Typography variant="caption" fontWeight={600} color="primary">-{f.A_barrier}dB</Typography>
                      : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell>
                    {f.compensation > 0
                      ? <Typography variant="caption" fontWeight={700} color="error">₩{f.compensation.toLocaleString()}</Typography>
                      : <Typography variant="caption" color="text.disabled">—</Typography>}
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
