/**
 * 메인 계산 페이지
 * 간편 계산 / 다중 세대 계산 탭으로 구성
 */

import React, { useState } from 'react';
import {
  Box, Container, AppBar, Toolbar, Typography,
  Tabs, Tab, Grid, Paper, Divider,
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

export default function CalculationPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ minHeight: '100vh', background: '#F5F7FA' }}>
      {/* ── 헤더 ── */}
      <AppBar position="static" elevation={0} sx={{ background: '#1565C0' }}>
        <Toolbar>
          <EngineeringIcon sx={{ mr: 1.5, fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
              현대엔지니어링 환경경영팀 소음영향모델링 시스템
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              건설현장 소음 · 환경부 보상금 산출 | ISO 9613-2
            </Typography>
          </Box>
        </Toolbar>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', fontWeight: 600 },
            '& .Mui-selected': { color: 'white' },
            '& .MuiTabs-indicator': { background: 'white', height: 3 },
          }}
        >
          <Tab icon={<ViewInArIcon />} iconPosition="start" label="3D 현장 분석" />
          <Tab icon={<CalculateIcon />} iconPosition="start" label="간편 계산" />
          <Tab icon={<GroupsIcon />} iconPosition="start" label="다중 세대 계산" />
        </Tabs>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>

        {/* ── 탭 0: 3D 현장 분석 ── */}
        <TabPanel value={tab} index={0}>
          <SiteAnalysisPage />
        </TabPanel>

        {/* ── 탭 1: 간편 계산 ── */}
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

        {/* ── 탭 2: 다중 세대 계산 ── */}
        <TabPanel value={tab} index={2}>
          <Grid container spacing={3}>
            {/* 입력 폼 */}
            <Grid item xs={12} md={4}>
              <CalculationForm mode="multi" />
            </Grid>

            {/* 지도 + 테이블 */}
            <Grid item xs={12} md={8}>
              <Paper
                elevation={0}
                sx={{
                  height: 450, mb: 2, borderRadius: 2, overflow: 'hidden',
                  border: '1px solid #E0E0E0',
                }}
              >
                <Box
                  sx={{
                    px: 2, py: 1, background: '#1565C0', color: 'white',
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}
                >
                  <MapIcon fontSize="small" />
                  <Typography variant="body2" fontWeight={600}>소음 영향 지도</Typography>
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
      <Box
        component="footer"
        sx={{
          mt: 4, py: 2, px: 3, background: '#ECEFF1',
          borderTop: '1px solid #CFD8DC',
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          ⚖️ 환경분쟁조정위원회 보상 기준 적용 &nbsp;|&nbsp;
          📐 ISO 9613-2 소음 전파 계산 &nbsp;|&nbsp;
          🔊 ISO 6395 장비 음향파워레벨 기준
        </Typography>
      </Box>
    </Box>
  );
}
