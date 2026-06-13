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
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)', position: 'relative', background: '#F0FDF4' }}>

      {/* 지도 */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} />

        {/* 주소 검색 */}
        <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: '90%', maxWidth: 460 }}>
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            <TextField size="small" fullWidth placeholder="주소 검색 후 지도를 클릭하세요" value={addrQuery}
              onChange={(e) => { setAddrQuery(e.target.value); if (!e.target.value.trim()) setAddrResults([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddrSearch(); if (e.key === 'Escape') setAddrResults([]); }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px 0 0 10px', background: 'rgba(255,255,255,0.97)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#0EA5E9' }} /></InputAdornment> }}
            />
            <Button variant="contained" color="secondary" size="small"
              sx={{ px: 2, borderRadius: '0 10px 10px 0', minWidth: 64, flexShrink: 0, fontWeight: 700 }}
              onClick={handleAddrSearch} disabled={searching || !addrQuery.trim()}>
              {searching ? <CircularProgress size={14} color="inherit" /> : '검색'}
            </Button>
          </Box>
          {addrResults.length > 0 && (
            <Paper elevation={3} sx={{ mt: 0.5, borderRadius: 1.5, overflow: 'hidden', maxHeight: 240, overflowY: 'auto', border: '1px solid #BAE6FD' }}>
              <List dense disablePadding>
                {addrResults.map((item, i) => (
                  <ListItem key={item.place_id} disablePadding divider={i < addrResults.length - 1}>
                    <Box component="button" onClick={() => handleAddrSelect(item)}
                      sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', '&:hover': { background: '#F0F9FF' } }}>
                      <LocationOnIcon sx={{ fontSize: 16, color: '#0EA5E9', flexShrink: 0 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600} noWrap>{item.display_name.split(',').slice(0, 2).join(' ')}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{item.display_name.split(',').slice(2, 5).join(', ')}</Typography>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>

        {/* 안내 */}
        {!picked && (
          <Box sx={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            zIndex: 5, background: 'rgba(255,255,255,0.95)', borderRadius: 2,
            px: 2.5, py: 1, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', border: '1px solid #BAE6FD',
            display: 'flex', alignItems: 'center', gap: 1, pointerEvents: 'none',
          }}>
            <StreetviewIcon sx={{ color: '#0EA5E9', fontSize: 18 }} />
            <Typography variant="body2" fontWeight={600} color="text.primary">
              지도를 클릭하면 거리뷰 위치가 선택됩니다
            </Typography>
          </Box>
        )}
      </Box>

      {/* 오른쪽 패널 */}
      <Box sx={{
        width: 280, flexShrink: 0, p: 2,
        background: '#FFFFFF', borderLeft: '2px solid #BAE6FD',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0284C7' }}>
          🔭 거리뷰 / 로드뷰
        </Typography>

        {!picked ? (
          <Box sx={{ p: 2, borderRadius: 2, background: '#F0F9FF', border: '1.5px dashed #BAE6FD', textAlign: 'center' }}>
            <StreetviewIcon sx={{ color: '#0EA5E9', fontSize: 36, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">지도를 클릭해 위치를 선택하세요</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ p: 1.5, borderRadius: 2, background: '#F0F9FF', border: '1.5px solid #BAE6FD' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.3}>선택된 위치</Typography>
              <Typography variant="caption" fontWeight={700} color="#0284C7" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
              </Typography>
            </Box>

            <Typography variant="caption" fontWeight={700} color="text.secondary">거리뷰 서비스 선택</Typography>

            {/* 네이버 로드뷰 */}
            <Button
              fullWidth variant="contained" size="large"
              startIcon={<OpenInNewIcon />}
              onClick={openNaverRoadview}
              sx={{
                py: 1.5, borderRadius: 2, fontWeight: 700, fontSize: 14,
                background: 'linear-gradient(135deg, #03C75A, #00B14F)',
                boxShadow: '0 4px 14px rgba(3,199,90,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #02B350, #009E46)' },
              }}>
              네이버 로드뷰 열기
            </Button>

            {/* 카카오 로드뷰 */}
            <Button
              fullWidth variant="contained" size="large"
              startIcon={<OpenInNewIcon />}
              onClick={openKakaoRoadview}
              sx={{
                py: 1.5, borderRadius: 2, fontWeight: 700, fontSize: 14,
                background: 'linear-gradient(135deg, #FAE100, #F7CD00)',
                color: '#3C1E1E',
                boxShadow: '0 4px 14px rgba(250,225,0,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #F0D800, #E8C200)' },
              }}>
              카카오 로드뷰 열기
            </Button>

            {/* 구글 스트리트뷰 */}
            <Button
              fullWidth variant="contained" size="large"
              startIcon={<OpenInNewIcon />}
              onClick={openGoogleStreetView}
              sx={{
                py: 1.5, borderRadius: 2, fontWeight: 700, fontSize: 14,
                background: 'linear-gradient(135deg, #4285F4, #2B6DE8)',
                boxShadow: '0 4px 14px rgba(66,133,244,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #3274E0, #1A5DD0)' },
              }}>
              구글 스트리트뷰 열기
            </Button>

            <Alert severity="info" sx={{ fontSize: 11 }}>
              버튼 클릭 시 새 탭에서 해당 위치의 거리뷰가 열립니다
            </Alert>

            <Button
              size="small" color="error" variant="outlined" fullWidth
              startIcon={<DeleteIcon />}
              onClick={() => { setPicked(null); setViewMode(null); markerRef.current?.remove(); }}>
              위치 초기화
            </Button>
          </>
        )}

        <Box sx={{ p: 1.2, borderRadius: 1.5, background: '#F0F9FF', border: '1px solid #BAE6FD', mt: 'auto' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, lineHeight: 1.6 }}>
            📍 지도 클릭 → 위치 선택<br />
            🟢 네이버 로드뷰 (국내 커버리지 최우수)<br />
            🟡 카카오 로드뷰 (카카오맵 연동)<br />
            🔵 구글 스트리트뷰 (전세계 커버리지)
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
