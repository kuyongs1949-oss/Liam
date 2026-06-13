import React, { useState } from 'react';
import { Box, Typography, Grid, Paper, Tooltip } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import CalculateIcon from '@mui/icons-material/Calculate';
import GroupsIcon from '@mui/icons-material/Groups';
import MapIcon from '@mui/icons-material/Map';
import StraightenIcon from '@mui/icons-material/Straighten';
import StreetviewIcon from '@mui/icons-material/Streetview';

import CalculationForm from '../components/CalculationForm';
import MapViewer from '../components/MapViewer';
import CompensationTable from '../components/CompensationTable';
import SiteAnalysisPage from './SiteAnalysisPage';
import DistancePage from './DistancePage';
import StreetViewPage from './StreetViewPage';

const NAV_ITEMS = [
  { icon: <GraphicEqIcon />,  label: '현장 분석' },
  { icon: <CalculateIcon />,  label: '간편 계산' },
  { icon: <GroupsIcon />,     label: '다중 세대' },
  { icon: <StraightenIcon />, label: '거리재기' },
  { icon: <StreetviewIcon />, label: '거리뷰'   },
];

export default function CalculationPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#F1F3F4' }}>

      {/* ── 왼쪽 네비게이션 레일 ── */}
      <Box sx={{
        width: 88, flexShrink: 0,
        background: '#FFFFFF',
        boxShadow: '1px 0 0 #E8EAED',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        pt: 1.5, pb: 2,
        zIndex: 200,
      }}>
        {/* 로고 + 타이틀 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2.5, gap: 0.8 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4285F4 0%, #0F9D58 50%, #FBBC04 75%, #EA4335 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <GraphicEqIcon sx={{ fontSize: 22, color: 'white' }} />
          </Box>
          <Box sx={{ textAlign: 'center', px: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#202124', lineHeight: 1.3, wordBreak: 'keep-all' }}>
              현대엔지니어링
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 500, color: '#1A73E8', lineHeight: 1.3, wordBreak: 'keep-all' }}>
              소음영향
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 500, color: '#1A73E8', lineHeight: 1.3, wordBreak: 'keep-all' }}>
              모델링
            </Typography>
          </Box>
        </Box>

        {/* 구분선 */}
        <Box sx={{ width: '80%', height: 1, background: '#E8EAED', mb: 1.5 }} />

        {/* 탭 버튼들 — 세로 배열 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', px: 0.5 }}>
          {NAV_ITEMS.map((item, i) => {
            const active = tab === i;
            return (
              <Tooltip key={i} title={item.label} placement="right" arrow>
                <Box onClick={() => setTab(i)} sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 0.4,
                  py: 1.2, px: 0.5, borderRadius: 2, cursor: 'pointer',
                  background: active ? '#E8F0FE' : 'transparent',
                  color: active ? '#1A73E8' : '#5F6368',
                  transition: 'all 0.15s',
                  '&:hover': {
                    background: active ? '#E8F0FE' : '#F1F3F4',
                    color: active ? '#1A73E8' : '#202124',
                  },
                }}>
                  <Box sx={{ fontSize: 0, '& svg': { fontSize: 22, color: 'inherit', display: 'block' } }}>
                    {item.icon}
                  </Box>
                  <Typography sx={{
                    fontSize: 10, fontWeight: active ? 700 : 500,
                    color: 'inherit', lineHeight: 1, textAlign: 'center',
                    letterSpacing: '-0.2px', wordBreak: 'keep-all',
                  }}>
                    {item.label}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* ── 본문 ── */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 0 && <SiteAnalysisPage />}

        {tab === 1 && (
          <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}><CalculationForm mode="quick" /></Grid>
              <Grid item xs={12} md={8}><CompensationTable /></Grid>
            </Grid>
          </Box>
        )}

        {tab === 2 && (
          <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}><CalculationForm mode="multi" /></Grid>
              <Grid item xs={12} md={8}>
                <Paper elevation={1} sx={{ height: 420, mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ px: 2, py: 1.2, borderBottom: '1px solid #E8EAED', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MapIcon sx={{ fontSize: 16, color: '#1A73E8' }} />
                    <Typography variant="body2" fontWeight={500} color="primary">소음 영향 지도</Typography>
                  </Box>
                  <Box sx={{ height: 'calc(100% - 42px)' }}><MapViewer /></Box>
                </Paper>
                <CompensationTable />
              </Grid>
            </Grid>
          </Box>
        )}

        {tab === 3 && <DistancePage />}
        {tab === 4 && <StreetViewPage />}
      </Box>
    </Box>
  );
}
