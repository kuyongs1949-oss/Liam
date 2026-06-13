import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Typography, Button, Chip, Paper, InputAdornment, TextField, CircularProgress, IconButton, List, ListItem, ListItemText } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Undo';
import StraightenIcon from '@mui/icons-material/Straighten';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const STYLE = 'https://tiles.openfreemap.org/styles/bright';
const R_EARTH = 6371000;

function haversineM(lng1, lat1, lng2, lat2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(3)} km`;
  return `${Math.round(m)} m`;
}

export default function DistancePage() {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const mapRef       = useRef(null);
  const loadedRef    = useRef(false);
  const pointsRef    = useRef([]);       // 확정된 지점들
  const mouseRef     = useRef(null);     // 현재 마우스 위치 (lng,lat)

  const [points, setPoints]         = useState([]);   // 확정 지점
  const [totalDist, setTotalDist]   = useState(0);
  const [addrQuery, setAddrQuery]   = useState('');
  const [addrResults, setAddrResults] = useState([]);
  const [searching, setSearching]   = useState(false);

  /* ── 캔버스 초기화 ── */
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }, []);

  /* ── 선/점 그리기 ── */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const map    = mapRef.current;
    if (!canvas || !map || !loadedRef.current) return;
    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const ctx  = canvas.getContext('2d');
    ctx.clearRect(0, 0, rect.width, rect.height);

    const pts = pointsRef.current;
    if (!pts.length) return;

    // 지도 좌표 → 캔버스 픽셀
    const project = ([lng, lat]) => {
      const p = map.project([lng, lat]);
      return { x: p.x, y: p.y };
    };

    const screenPts = pts.map(project);
    const mousePt   = mouseRef.current ? project(mouseRef.current) : null;
    const allPts    = mousePt ? [...screenPts, { ...mousePt, isMouse: true }] : screenPts;

    // ── 선 ──
    if (allPts.length >= 2) {
      // 흰 테두리
      ctx.beginPath();
      ctx.moveTo(allPts[0].x, allPts[0].y);
      for (let i = 1; i < allPts.length; i++) ctx.lineTo(allPts[i].x, allPts[i].y);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth   = 6;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.setLineDash([]);
      ctx.stroke();

      // 빨간 실선
      ctx.beginPath();
      ctx.moveTo(allPts[0].x, allPts[0].y);
      for (let i = 1; i < allPts.length; i++) {
        if (allPts[i].isMouse) ctx.setLineDash([8, 5]);
        else ctx.setLineDash([]);
        ctx.lineTo(allPts[i].x, allPts[i].y);
      }
      ctx.strokeStyle = '#E84040';
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── 구간 거리 라벨 ──
    for (let i = 1; i < allPts.length; i++) {
      const p0 = allPts[i - 1], p1 = allPts[i];
      const coord0 = pts[i - 1] || mouseRef.current;
      const coord1 = pts[i]     || mouseRef.current;
      if (!coord0 || !coord1) continue;
      const segDist = haversineM(coord0[0], coord0[1], coord1[0], coord1[1]);
      if (segDist < 1) continue;
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2 - 14;
      const label = fmtDist(segDist);
      ctx.font = 'bold 12px "Noto Sans KR", Arial, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(30,30,30,0.82)';
      ctx.beginPath();
      ctx.roundRect(mx - tw / 2 - 7, my - 12, tw + 14, 20, 4);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my - 2);
    }

    // ── 확정 지점 원 ──
    screenPts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#16A34A' : 'white';
      ctx.fill();
      ctx.strokeStyle = i === 0 ? 'white' : '#E84040';
      ctx.lineWidth = 3;
      ctx.stroke();
      // 번호
      ctx.fillStyle = i === 0 ? 'white' : '#E84040';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, p.x, p.y);
    });

    // ── 마우스 포인터 원 ──
    if (mousePt) {
      ctx.beginPath();
      ctx.arc(mousePt.x, mousePt.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#E84040';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }, []);

  /* ── 지도 초기화 ── */
  useEffect(() => {
    if (mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [126.978, 37.5665],
      zoom: 15,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      loadedRef.current = true;
      initCanvas();
    });

    map.on('move', () => redraw());
    map.on('zoom', () => redraw());
    map.on('resize', () => { initCanvas(); redraw(); });

    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; };
  }, [initCanvas, redraw]);

  /* ── 이벤트: 클릭/무브 ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onClick = (e) => {
      const map = mapRef.current;
      if (!map || !loadedRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const ll   = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
      const newPts = [...pointsRef.current, [ll.lng, ll.lat]];
      pointsRef.current = newPts;
      setPoints([...newPts]);
      // 총 거리 갱신
      let total = 0;
      for (let i = 1; i < newPts.length; i++) total += haversineM(newPts[i-1][0], newPts[i-1][1], newPts[i][0], newPts[i][1]);
      setTotalDist(total);
      redraw();
    };

    const onMove = (e) => {
      const map = mapRef.current;
      if (!map || !loadedRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const ll   = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
      mouseRef.current = [ll.lng, ll.lat];
      redraw();
    };

    const onLeave = () => { mouseRef.current = null; redraw(); };

    canvas.addEventListener('click',     onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      canvas.removeEventListener('click',     onClick);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [redraw]);

  const handleUndo = () => {
    const newPts = pointsRef.current.slice(0, -1);
    pointsRef.current = newPts;
    setPoints([...newPts]);
    let total = 0;
    for (let i = 1; i < newPts.length; i++) total += haversineM(newPts[i-1][0], newPts[i-1][1], newPts[i][0], newPts[i][1]);
    setTotalDist(total);
    redraw();
  };

  const handleClear = () => {
    pointsRef.current = [];
    mouseRef.current  = null;
    setPoints([]);
    setTotalDist(0);
    redraw();
  };

  const handleAddrSearch = async () => {
    const q = addrQuery.trim();
    if (!q) return;
    setSearching(true); setAddrResults([]);
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=kr&accept-language=ko`);
      const data = await res.json();
      setAddrResults(data);
    } catch { /* ignore */ } finally { setSearching(false); }
  };

  const handleAddrSelect = (item) => {
    mapRef.current?.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 16, duration: 800 });
    setAddrResults([]);
    setAddrQuery(item.display_name.split(',')[0]);
  };

  // 총 거리 (마우스 포함 미리보기)
  const previewTotal = (() => {
    const pts = pointsRef.current;
    if (!pts.length || !mouseRef.current) return totalDist;
    const last = pts[pts.length - 1];
    return totalDist + haversineM(last[0], last[1], mouseRef.current[0], mouseRef.current[1]);
  })();

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 56px)', position: 'relative' }}>

      {/* 지도 영역 */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <canvas ref={canvasRef} style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%', cursor: 'crosshair', zIndex: 3,
        }} />

        {/* 주소 검색 — 구글 스타일 */}
        <Box sx={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, maxWidth: 440 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" fullWidth placeholder="주소 검색..." value={addrQuery}
              onChange={(e) => { setAddrQuery(e.target.value); if (!e.target.value.trim()) setAddrResults([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddrSearch(); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 20, color: '#5F6368' }} /></InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { height: 48, borderRadius: 28, background: '#fff', boxShadow: '0 2px 6px rgba(60,64,67,0.3)', '& fieldset': { border: 'none' } } }}
            />
            <Button variant="contained" color="primary" onClick={handleAddrSearch}
              disabled={searching || !addrQuery.trim()}
              sx={{ height: 48, px: 2.5, borderRadius: 24, flexShrink: 0, boxShadow: '0 2px 6px rgba(60,64,67,0.3)' }}>
              {searching ? <CircularProgress size={16} color="inherit" /> : '검색'}
            </Button>
          </Box>
          {addrResults.length > 0 && (
            <Paper elevation={3} sx={{ mt: 0.5, borderRadius: 2, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
              {addrResults.map((item, i) => (
                <Box key={item.place_id} onClick={() => handleAddrSelect(item)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.2,
                  cursor: 'pointer', borderBottom: i < addrResults.length - 1 ? '1px solid #F1F3F4' : 'none',
                  '&:hover': { background: '#F8F9FA' },
                }}>
                  <LocationOnIcon sx={{ fontSize: 18, color: '#EA4335', flexShrink: 0 }} />
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="body2" fontWeight={500} noWrap>{item.display_name.split(',').slice(0, 2).join(' ')}</Typography>
                    <Typography variant="caption" noWrap>{item.display_name.split(',').slice(2, 5).join(', ')}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          )}
        </Box>

        {/* 안내 */}
        <Paper elevation={3} sx={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 5, borderRadius: 24, px: 3, py: 1.2,
          display: 'flex', alignItems: 'center', gap: 1.5, pointerEvents: 'none',
        }}>
          <StraightenIcon sx={{ color: '#1A73E8', fontSize: 16 }} />
          <Typography variant="body2" fontWeight={500}>
            지도를 클릭해 측정 지점 추가 · 여러 지점을 이어 경로 거리 측정
          </Typography>
        </Paper>
      </Box>

      {/* 오른쪽 패널 — 구글 사이드바 */}
      <Box sx={{
        width: 280, flexShrink: 0,
        background: '#FFFFFF', boxShadow: '-2px 0 8px rgba(60,64,67,0.2)',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: '#BDC1C6', borderRadius: 2 },
      }}>
        <Box sx={{ px: 2, pt: 2, pb: 1, borderBottom: '1px solid #E8EAED', display: 'flex', alignItems: 'center', gap: 1 }}>
          <StraightenIcon sx={{ fontSize: 18, color: '#1A73E8' }} />
          <Typography variant="subtitle2" fontWeight={600}>거리 측정</Typography>
        </Box>

        {/* 총 거리 */}
        <Box sx={{ p: 2, borderBottom: '1px solid #E8EAED' }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>총 거리</Typography>
          <Box sx={{
            p: 2, borderRadius: 2, textAlign: 'center',
            background: points.length ? '#E8F0FE' : '#F8F9FA',
          }}>
            <Typography variant="h4" fontWeight={700} color={points.length ? 'primary' : 'text.disabled'} lineHeight={1}>
              {points.length ? fmtDist(previewTotal) : '—'}
            </Typography>
            {points.length >= 2 && (
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {points.length}개 지점 · {points.length - 1}구간
              </Typography>
            )}
          </Box>
        </Box>

        {/* 구간 목록 */}
        {points.length >= 2 && (
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E8EAED' }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={1}>구간별 거리</Typography>
            {points.slice(1).map((p, i) => {
              const seg = haversineM(points[i][0], points[i][1], p[0], p[1]);
              return (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.8, borderBottom: '1px solid #F1F3F4' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', background: '#1A73E8', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</Box>
                    <Typography variant="caption" color="text.secondary">→ {i + 2}번</Typography>
                  </Box>
                  <Typography variant="caption" fontWeight={700} color="primary">{fmtDist(seg)}</Typography>
                </Box>
              );
            })}
          </Box>
        )}

        <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
          <Button fullWidth variant="outlined" size="small"
            startIcon={<UndoIcon />} onClick={handleUndo} disabled={!points.length}
            sx={{ borderRadius: 20 }}>
            되돌리기
          </Button>
          <Button fullWidth variant="outlined" color="error" size="small"
            startIcon={<DeleteIcon />} onClick={handleClear} disabled={!points.length}
            sx={{ borderRadius: 20 }}>
            초기화
          </Button>
        </Box>

        <Box sx={{ mx: 2, mb: 2, p: 1.5, borderRadius: 2, background: '#F8F9FA', mt: 'auto' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, lineHeight: 1.7 }}>
            클릭으로 지점 추가<br />
            마우스 이동 시 다음 구간 미리보기<br />
            되돌리기로 마지막 지점 제거
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
