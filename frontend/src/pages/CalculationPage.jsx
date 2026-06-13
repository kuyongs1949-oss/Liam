import React, { useState } from 'react';
import {
  Box, Container, AppBar, Toolbar, Typography,
  Tabs, Tab, Grid, Paper,
} from '@mui/material';
import EngineeringIcon from '@mui/icons-material/Engineering';
import CalculateIcon from '@mui/icons-material/Calculate';
import GroupsIcon from '@mui/icons-material/Groups';
import MapIcon from '@mui/icons-material/Map';
import ViewInArIcon from '@mui/icons-material/ViewInAr';

import CalculationForm from '../components/CalculationForm';
import MapViewer from '../components/MapViewer';
import CompensationTable from '../components/CompensationTable';
import SiteAnalysisPage from './SiteAnalysisPage';

function TabPanel({ children, value, index }) {
  return value === index ? <Box>{children}</Box> : null;
}

const GRID_BG = `
  linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
`;

export default function CalculationPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100vh', background: '#03071E', backgroundImage: GRID_BG, backgroundSize: '40px 40px' }}>

      {/* ── 헤더 ── */}
      <AppBar position="static" elevation={0} sx={{
        background: 'linear-gradient(180deg, #060D1A 0%, #080F1E 100%)',
        borderBottom: '1px solid rgba(0,212,255,0.18)',
        boxShadow: '0 2px 24px rgba(0,212,255,0.08)',
      }}>
        <Toolbar sx={{ gap: 2 }}>
          {/* 로고 아이콘 */}
          <Box sx={{
            width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,102,255,0.2) 100%)',
            border: '1px solid rgba(0,212,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,212,255,0.25)',
          }}>
            <EngineeringIcon sx={{ fontSize: 22, color: '#00D4FF' }} />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{
              lineHeight: 1.2, fontWeight: 800, letterSpacing: '0.02em',
              background: 'linear-gradient(90deg, #00D4FF 0%, #66E5FF 60%, #E0F4FF 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              현대엔지니어링 환경경영팀 소음영향모델링 시스템
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(0,212,255,0.55)', letterSpacing: '0.08em', fontSize: 10 }}>
              CONSTRUCTION NOISE IMPACT ASSESSMENT  ·  ISO 9613-2  ·  환경분쟁조정위원회 2026
            </Typography>
          </Box>

          {/* 상태 표시 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexShrink: 0 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#00E676', boxShadow: '0 0 8px #00E676' }} />
            <Typography variant="caption" sx={{ color: 'rgba(0,230,118,0.8)', letterSpacing: '0.1em', fontSize: 10 }}>
              ONLINE
            </Typography>
          </Box>
        </Toolbar>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': {
              color: 'rgba(180,220,255,0.45)', fontWeight: 600, fontSize: 13,
              letterSpacing: '0.04em', minHeight: 44,
            },
            '& .Mui-selected': { color: '#00D4FF' },
            '& .MuiTabs-indicator': {
              background: 'linear-gradient(90deg, #00D4FF, #66E5FF)',
              height: 2, boxShadow: '0 0 10px rgba(0,212,255,0.6)',
            },
          }}
        >
          <Tab icon={<ViewInArIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="3D 현장 분석" />
          <Tab icon={<CalculateIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="간편 계산" />
          <Tab icon={<GroupsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="다중 세대 계산" />
        </Tabs>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>

        <TabPanel value={tab} index={0}>
          <SiteAnalysisPage />
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <CalculationForm mode="quick" />
            </Grid>
            <Grid item xs={12} md={8}>
              <CompensationTable />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <CalculationForm mode="multi" />
            </Grid>
            <Grid item xs={12} md={8}>
              <Paper elevation={0} sx={{
                height: 450, mb: 2, borderRadius: 2, overflow: 'hidden',
                border: '1px solid rgba(0,212,255,0.12)',
                background: '#0A1628',
              }}>
                <Box sx={{
                  px: 2, py: 1,
                  background: 'linear-gradient(90deg, rgba(0,212,255,0.12), rgba(0,102,255,0.08))',
                  borderBottom: '1px solid rgba(0,212,255,0.15)',
                  display: 'flex', alignItems: 'center', gap: 1,
                }}>
                  <MapIcon sx={{ fontSize: 16, color: '#00D4FF' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#00D4FF', letterSpacing: '0.05em' }}>
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
      </Container>

      {/* ── 하단 기준 안내 ── */}
      <Box component="footer" sx={{
        mt: 4, py: 2, px: 3,
        borderTop: '1px solid rgba(0,212,255,0.1)',
        background: 'rgba(6,13,26,0.8)',
        textAlign: 'center',
      }}>
        <Typography variant="caption" sx={{ color: 'rgba(0,212,255,0.35)', letterSpacing: '0.08em', fontSize: 10 }}>
          ⚖ 환경분쟁조정위원회 보상 기준 적용 &nbsp;·&nbsp;
          📐 ISO 9613-2 소음 전파 계산 &nbsp;·&nbsp;
          🔊 ISO 6395 장비 음향파워레벨 기준
        </Typography>
      </Box>
    </Box>
  );
}
