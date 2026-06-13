import React, { useState } from 'react';
import {
  Box, AppBar, Toolbar, Typography, Tabs, Tab,
  Container, Grid, Paper,
} from '@mui/material';
import ForestIcon from '@mui/icons-material/Forest';
import CalculateIcon from '@mui/icons-material/Calculate';
import GroupsIcon from '@mui/icons-material/Groups';
import MapIcon from '@mui/icons-material/Map';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import StraightenIcon from '@mui/icons-material/Straighten';
import StreetviewIcon from '@mui/icons-material/Streetview';

import CalculationForm from '../components/CalculationForm';
import MapViewer from '../components/MapViewer';
import CompensationTable from '../components/CompensationTable';
import SiteAnalysisPage from './SiteAnalysisPage';
import DistancePage from './DistancePage';
import StreetViewPage from './StreetViewPage';

function TabPanel({ children, value, index }) {
  return value === index ? <Box>{children}</Box> : null;
}

export default function CalculationPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100vh', background: '#F0FDF4' }}>

      {/* ── 헤더 ── */}
      <AppBar position="static" elevation={0} sx={{
        background: 'linear-gradient(135deg, #14532D 0%, #16A34A 60%, #22C55E 100%)',
        borderBottom: '1px solid #15803D',
      }}>
        <Toolbar sx={{ gap: 1.5 }}>
          {/* 아이콘 */}
          <Box sx={{
            width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ForestIcon sx={{ fontSize: 22, color: 'white' }} />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{
              color: 'white', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em',
            }}>
              현대엔지니어링 환경경영팀 소음영향모델링 시스템
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', letterSpacing: '0.04em', fontSize: 10 }}>
              CONSTRUCTION NOISE IMPACT ASSESSMENT  ·  ISO 9613-2  ·  환경분쟁조정위원회 2026
            </Typography>
          </Box>

          {/* 친환경 배지 */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0,
            px: 1.2, py: 0.5, borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#86EFAC' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 600 }}>
              ECO
            </Typography>
          </Box>
        </Toolbar>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': {
              color: 'rgba(255,255,255,0.65)', fontWeight: 600, fontSize: 13, minHeight: 44,
            },
            '& .Mui-selected': { color: 'white' },
            '& .MuiTabs-indicator': {
              background: 'white', height: 3, borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab icon={<ViewInArIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="3D 현장 분석" />
          <Tab icon={<CalculateIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="간편 계산" />
          <Tab icon={<GroupsIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="다중 세대 계산" />
          <Tab icon={<StraightenIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="거리재기" />
          <Tab icon={<StreetviewIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="거리뷰" />
        </Tabs>
      </AppBar>

      <Container maxWidth="xl" disableGutters sx={{ py: tab >= 3 ? 0 : 2.5 }}>
        <TabPanel value={tab} index={0}>
          <SiteAnalysisPage />
        </TabPanel>


        <TabPanel value={tab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}><CalculationForm mode="quick" /></Grid>
            <Grid item xs={12} md={8}><CompensationTable /></Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}><CalculationForm mode="multi" /></Grid>
            <Grid item xs={12} md={8}>
              <Paper elevation={0} sx={{
                height: 450, mb: 2, borderRadius: 2, overflow: 'hidden',
                border: '1px solid #D1FAE5',
              }}>
                <Box sx={{
                  px: 2, py: 1,
                  background: 'linear-gradient(90deg, #F0FDF4, #FAFFFE)',
                  borderBottom: '1px solid #D1FAE5',
                  display: 'flex', alignItems: 'center', gap: 1,
                }}>
                  <MapIcon sx={{ fontSize: 16, color: '#16A34A' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#16A34A' }}>
                    소음 영향 지도
                  </Typography>
                </Box>
                <Box sx={{ height: 'calc(100% - 40px)' }}>
                  <MapViewer />
                </Box>
              </Paper>
              <CompensationTable />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tab} index={3}>
          <DistancePage />
        </TabPanel>

        <TabPanel value={tab} index={4}>
          <StreetViewPage />
        </TabPanel>
      </Container>

      {/* 하단 */}
      <Box component="footer" sx={{
        mt: 4, py: 2, px: 3,
        borderTop: '1px solid #D1FAE5',
        background: '#FAFFFE',
        textAlign: 'center',
      }}>
        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.04em', fontSize: 10 }}>
          🌿 환경분쟁조정위원회 보상 기준 &nbsp;·&nbsp;
          📐 ISO 9613-2 소음 전파 &nbsp;·&nbsp;
          🔊 ISO 6395 장비 음향파워
        </Typography>
      </Box>
    </Box>
  );
}
