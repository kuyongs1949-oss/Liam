import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Box, Typography, Button, TextField, InputAdornment,
  CircularProgress, Paper, List, ListItem,
  IconButton, Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StreetviewIcon from '@mui/icons-material/Streetview';

const STYLE = 'https://tiles.openfreemap.org/styles/bright';

export default function StreetViewPage() {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const loadedRef    = useRef(false);
  const markerRef    = useRef(null);

  const [picked, setPicked]         = useState(null);   // { lng, lat }
  const [addrQuery, setAddrQuery]   = useState('');
  const [addrResults, setAddrResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [viewMode, setViewMode]     = useState(null);  // 'naver' | 'kakao' | null

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

    map.on('load', () => { loadedRef.current = true; });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setPicked({ lng, lat });
      setViewMode(null);
      // 마커
      markerRef.current?.remove();
      const el = document.createElement('div');
      el.style.cssText = `
        width:32px; height:32px; background:#0EA5E9; border-radius:50% 50% 50% 0;
        border:3px solid white; transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(14,165,233,0.5); cursor:pointer;
      `;
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom-left' })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current = marker;
    });

    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; };
  }, []);

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
    const lng = parseFloat(item.lon), lat = parseFloat(item.lat);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 17, duration: 800 });
    setAddrResults([]);
    setAddrQuery(item.display_name.split(',')[0]);
  };

  // 네이버 로드뷰 새 탭
  const openNaverRoadview = () => {
    if (!picked) return;
    const url = `https://map.naver.com/p/entry/address/${picked.lng},${picked.lat}?c=${picked.lng},${picked.lat},17,0,0,0,dh&mode=roadview`;
    window.open(url, '_blank');
    setViewMode('naver');
  };

  // 카카오 로드뷰 새 탭
  const openKakaoRoadview = () => {
    if (!picked) return;
    const url = `https://map.kakao.com/?map_type=TYPE_ROADVIEW&urlX=${picked.lng}&urlY=${picked.lat}&urlLevel=3`;
    window.open(url, '_blank');
    setViewMode('kakao');
  };

  // 구글 스트리트뷰 새 탭
  const openGoogleStreetView = () => {
    if (!picked) return;
    const url = `https://www.google.com/maps/@${picked.lat},${picked.lng},3a,75y,0h,90t/data=!3m1!1e3`;
    window.open(url, '_blank');
    setViewMode('google');
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 56px)', position: 'relative' }}>

      {/* 지도 */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} />

        {/* 주소 검색 — 구글 스타일 */}
        <Box sx={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, maxWidth: 460 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" fullWidth placeholder="주소 검색 후 지도를 클릭하세요" value={addrQuery}
              onChange={(e) => { setAddrQuery(e.target.value); if (!e.target.value.trim()) setAddrResults([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddrSearch(); if (e.key === 'Escape') setAddrResults([]); }}
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
        {!picked && (
          <Paper elevation={3} sx={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            zIndex: 5, borderRadius: 24, px: 3, py: 1.2,
            display: 'flex', alignItems: 'center', gap: 1.5, pointerEvents: 'none',
          }}>
            <StreetviewIcon sx={{ color: '#1A73E8', fontSize: 16 }} />
            <Typography variant="body2" fontWeight={500}>
              지도를 클릭하면 거리뷰 위치가 선택됩니다
            </Typography>
          </Paper>
        )}
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
          <StreetviewIcon sx={{ fontSize: 18, color: '#1A73E8' }} />
          <Typography variant="subtitle2" fontWeight={600}>거리뷰 / 로드뷰</Typography>
        </Box>

        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
          {!picked ? (
            <Box sx={{ p: 2.5, borderRadius: 2, background: '#F8F9FA', textAlign: 'center' }}>
              <StreetviewIcon sx={{ color: '#BDC1C6', fontSize: 40, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">지도를 클릭해 위치를 선택하세요</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ p: 1.5, borderRadius: 2, background: '#E8F0FE' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.3}>선택된 위치</Typography>
                <Typography variant="caption" fontWeight={600} color="primary" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                  {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
                </Typography>
              </Box>

              <Typography variant="caption" fontWeight={600} color="text.secondary">거리뷰 서비스 선택</Typography>

              <Button fullWidth variant="contained" size="large" startIcon={<OpenInNewIcon />}
                onClick={openNaverRoadview}
                sx={{ borderRadius: 20, fontWeight: 600, background: '#03C75A', '&:hover': { background: '#02B350' } }}>
                네이버 로드뷰 열기
              </Button>

              <Button fullWidth variant="contained" size="large" startIcon={<OpenInNewIcon />}
                onClick={openKakaoRoadview}
                sx={{ borderRadius: 20, fontWeight: 600, background: '#FEE500', color: '#3C1E1E', '&:hover': { background: '#F0D800' } }}>
                카카오 로드뷰 열기
              </Button>

              <Button fullWidth variant="contained" size="large" startIcon={<OpenInNewIcon />}
                onClick={openGoogleStreetView}
                sx={{ borderRadius: 20, fontWeight: 600, background: '#4285F4', '&:hover': { background: '#3274E0' } }}>
                구글 스트리트뷰 열기
              </Button>

              <Alert severity="info" sx={{ fontSize: 11 }}>
                버튼 클릭 시 새 탭에서 해당 위치의 거리뷰가 열립니다
              </Alert>

              <Button size="small" color="error" variant="outlined" fullWidth
                startIcon={<DeleteIcon />} sx={{ borderRadius: 20 }}
                onClick={() => { setPicked(null); setViewMode(null); markerRef.current?.remove(); }}>
                위치 초기화
              </Button>
            </>
          )}

          <Box sx={{ p: 1.5, borderRadius: 2, background: '#F8F9FA', mt: 'auto' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, lineHeight: 1.7 }}>
              지도 클릭 → 위치 선택<br />
              네이버 로드뷰 (국내 커버리지 최우수)<br />
              카카오 로드뷰 (카카오맵 연동)<br />
              구글 스트리트뷰 (전세계 커버리지)
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
