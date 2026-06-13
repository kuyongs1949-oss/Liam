import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Grid, Paper } from '@mui/material';
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

export default function CalculationPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F1F3F4' }}>

      {/* ── 구글 스타일 상단 앱바 ── */}
      <Box sx={{
        height: 56, flexShrink: 0, background: '#FFFFFF',
        boxShadow: '0 1px 0 #E8EAED',
        display: 'flex', alignItems: 'center', px: 2, gap: 2, zIndex: 100,
      }}>
        {/* 로고 영역 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4285F4 0%, #0F9D58 50%, #FBBC04 75%, #EA4335 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GraphicEqIcon sx={{ fontSize: 18, color: 'white' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: 16, color: '#202124', letterSpacing: '-0.2px', lineHeight: 1.2 }}>
              소음영향모델링
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#5F6368', lineHeight: 1 }}>
              현대엔지니어링 환경경영팀
            </Typography>
          </Box>
        </Box>

        {/* 탭 */}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flex: 1 }}>
          <Tab icon={<GraphicEqIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="현장 분석" />
          <Tab icon={<CalculateIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="간편 계산" />
          <Tab icon={<GroupsIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="다중 세대" />
          <Tab icon={<StraightenIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="거리재기" />
          <Tab icon={<StreetviewIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="거리뷰" />
        </Tabs>

        <Typography sx={{ fontSize: 11, color: '#9AA0A6', flexShrink: 0 }}>
          ISO 9613-2
        </Typography>
      </Box>

      {/* ── 본문 ── */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TabPanel value={tab} index={0}><SiteAnalysisPage /></TabPanel>

        <TabPanel value={tab} index={1}>
          <Box sx={{ p: 3, height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}><CalculationForm mode="quick" /></Grid>
              <Grid item xs={12} md={8}><CompensationTable /></Grid>
            </Grid>
          </Box>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Box sx={{ p: 3, height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
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
        </TabPanel>

        <TabPanel value={tab} index={3}><DistancePage /></TabPanel>
        <TabPanel value={tab} index={4}><StreetViewPage /></TabPanel>
      </Box>
    </Box>
  );
}
