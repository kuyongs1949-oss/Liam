import React, { useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Grid, Paper,
} from '@mui/material';
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

function TabPanel({ children, value, index }) {
  return value === index ? <>{children}</> : null;
}

const TABS = [
  { icon: <GraphicEqIcon sx={{ fontSize: 16 }} />, label: '소음 현장분석' },
  { icon: <CalculateIcon sx={{ fontSize: 16 }} />, label: '간편 계산' },
  { icon: <GroupsIcon sx={{ fontSize: 16 }} />, label: '다중 세대' },
  { icon: <StraightenIcon sx={{ fontSize: 16 }} />, label: '거리재기' },
  { icon: <StreetviewIcon sx={{ fontSize: 16 }} />, label: '거리뷰' },
];

export default function CalculationPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F4F4F4' }}>

      {/* ── 상단 헤더 (네이버 지도 스타일) ── */}
      <Box sx={{
        height: 48, flexShrink: 0,
        background: '#03C75A',
        display: 'flex', alignItems: 'center', px: 2, gap: 1.5,
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        zIndex: 100,
      }}>
        {/* 로고 */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0,
        }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '6px',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GraphicEqIcon sx={{ fontSize: 18, color: 'white' }} />
          </Box>
          <Box>
            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: 13, lineHeight: 1.2, letterSpacing: '-0.3px' }}>
              현대엔지니어링
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, lineHeight: 1 }}>
              소음영향모델링
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, letterSpacing: '0.02em' }}>
          ISO 9613-2  ·  환경분쟁조정위원회 2026
        </Typography>
      </Box>

      {/* ── 탭 바 ── */}
      <Box sx={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E5E5',
        flexShrink: 0, px: 1,
      }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {TABS.map((t, i) => (
            <Tab
              key={i}
              icon={t.icon}
              iconPosition="start"
              label={t.label}
              sx={{ minHeight: 44, gap: 0.5 }}
            />
          ))}
        </Tabs>
      </Box>

      {/* ── 본문 ── */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TabPanel value={tab} index={0}>
          <SiteAnalysisPage />
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Box sx={{ p: 2, height: 'calc(100vh - 92px)', overflowY: 'auto' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><CalculationForm mode="quick" /></Grid>
              <Grid item xs={12} md={8}><CompensationTable /></Grid>
            </Grid>
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Box sx={{ p: 2, height: 'calc(100vh - 92px)', overflowY: 'auto' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><CalculationForm mode="multi" /></Grid>
              <Grid item xs={12} md={8}>
                <Paper elevation={0} sx={{ height: 420, mb: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #E5E5E5' }}>
                  <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MapIcon sx={{ fontSize: 15, color: '#03C75A' }} />
                    <Typography variant="body2" fontWeight={600} color="primary">소음 영향 지도</Typography>
                  </Box>
                  <Box sx={{ height: 'calc(100% - 38px)' }}><MapViewer /></Box>
                </Paper>
                <CompensationTable />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={3}>
          <DistancePage />
        </TabPanel>

        <TabPanel value={tab} index={4}>
          <StreetViewPage />
        </TabPanel>
      </Box>
    </Box>
  );
}
