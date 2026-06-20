import React, { useState } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import StraightenIcon from '@mui/icons-material/Straighten';
import StreetviewIcon from '@mui/icons-material/Streetview';

import SiteAnalysisPage from './SiteAnalysisPage';
import DistancePage from './DistancePage';
import StreetViewPage from './StreetViewPage';

const NAV_ITEMS = [
  { icon: <GraphicEqIcon />,  label: '현장 분석' },
  { icon: <StraightenIcon />, label: '거리재기' },
  { icon: <StreetviewIcon />, label: '거리뷰'   },
];

export default function CalculationPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#F1F3F4' }}>

      {/* ── 왼쪽 네비게이션 레일 ── */}
      <Box sx={{
        width: 110, flexShrink: 0,
        background: '#FFFFFF',
        boxShadow: '1px 0 0 #E8EAED',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        pt: 2, pb: 2,
        zIndex: 200,
      }}>
        {/* 로고 + 타이틀 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, gap: 1, width: '100%', px: 1 }}>
          <Box sx={{ width: 96, height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src="https://daoift3qrrnil.cloudfront.net/company_groups/images/000/001/377/original/img.jpg?1691998138"
              alt="현대엔지니어링"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </Box>
          <Box sx={{ textAlign: 'center', width: '100%' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', lineHeight: 1.3 }}>
              소음영향 모델링
            </Typography>
          </Box>
        </Box>

        {/* 구분선 */}
        <Box sx={{ width: '85%', height: 1, background: '#E8EAED', mb: 1.5 }} />

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

        {tab === 1 && <DistancePage />}
        {tab === 2 && <StreetViewPage />}
      </Box>
    </Box>
  );
}
