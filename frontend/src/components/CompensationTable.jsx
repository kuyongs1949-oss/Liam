/**
 * 보상금 결과 테이블 컴포넌트
 * - 65dB 초과 세대만 표시
 * - 소음도 높은 순 정렬
 * - 각 세대별 보상금 표시
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Card, CardContent, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip,
  TableSortLabel, Tooltip, Alert, Divider, Grid, Paper,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const LEVEL_CONFIG = {
  safe:   { label: '안전', color: '#2196F3', bg: '#E3F2FD' },
  level1: { label: '경미', color: '#4CAF50', bg: '#E8F5E9' },
  level2: { label: '보통', color: '#FF9800', bg: '#FFF3E0' },
  level3: { label: '심각', color: '#F44336', bg: '#FFEBEE' },
  level4: { label: '매우심각', color: '#9C27B0', bg: '#F3E5F5' },
};

// 요약 통계 카드
function SummaryCard({ icon, label, value, color }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, background: '#F8F9FA', textAlign: 'center' }}>
      <Typography variant="h4">{icon}</Typography>
      <Typography variant="h6" fontWeight={700} color={color || 'text.primary'}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

export default function CompensationTable() {
  const { multiResult, quickResult } = useSelector((s) => s.calculation);
  const [sortBy, setSortBy] = useState('noise_db');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  // ── 간편 계산 결과 ──────────────────────────────
  if (quickResult && !multiResult) {
    const nr = quickResult.noise_result;
    const cp = quickResult.compensation_preview;
    const levelCfg = LEVEL_CONFIG[cp.noise_level] || LEVEL_CONFIG.safe;

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>📊 간편 계산 결과</Typography>

          <Box sx={{ p: 2, background: levelCfg.bg, borderRadius: 2, mb: 2, textAlign: 'center' }}>
            <Typography variant="h3" fontWeight={800} color={levelCfg.color}>
              {nr.L_receiver.toFixed(1)} dB(A)
            </Typography>
            <Chip label={levelCfg.label} size="small"
              sx={{ background: levelCfg.color, color: 'white', fontWeight: 700, mt: 1 }} />
          </Box>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6}>
              <SummaryCard icon="🔊" label="합산 음압" value={`${nr.lw_total} dB`} />
            </Grid>
            <Grid item xs={6}>
              <SummaryCard icon="📏" label="거리 감쇠 (d1)" value={`-${nr.A_d1} dB`} />
            </Grid>
            <Grid item xs={6}>
              <SummaryCard icon="🧱" label="방음벽 삽입손실" value={`-${nr.A_barrier} dB`} />
            </Grid>
            <Grid item xs={6}>
              <SummaryCard icon="📏" label="거리 감쇠 (d2)" value={`-${nr.A_d2} dB`} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary" mb={1}>
            💰 보상금 미리보기 (1세대, 3개월 기준)
          </Typography>
          <Typography variant="h5" fontWeight={700} color={cp.noise_level === 'safe' ? 'text.secondary' : '#e53935'}>
            ₩{cp.per_household_3months?.toLocaleString('ko-KR') || '0'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {cp.description}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // ── 다중 계산 결과 ──────────────────────────────
  if (!multiResult) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h3" mb={2}>📋</Typography>
          <Typography color="text.secondary">
            계산을 실행하면 세대별 보상금이 표시됩니다
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const { summary, results } = multiResult;

  // 정렬
  const sorted = [...(results || [])].sort((a, b) => {
    let va, vb;
    if (sortBy === 'noise_db') { va = a.noise_db; vb = b.noise_db; }
    else if (sortBy === 'total') { va = a.compensation.total; vb = b.compensation.total; }
    else if (sortBy === 'distance') { va = a.distance; vb = b.distance; }
    else { va = a.map.name; vb = b.map.name; }
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  return (
    <Box>
      {/* 요약 통계 */}
      <Grid container spacing={1.5} mb={2}>
        <Grid item xs={6} md={3}>
          <SummaryCard icon="🏘️" label="총 수용자" value={`${summary.total_receptors}세대`} />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard icon="⚠️" label="65dB 초과" value={`${summary.exceeds_65db_count}세대`} color="#F44336" />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard icon="💰" label="총 보상금" value={`₩${(summary.total_compensation / 1_000_000).toFixed(0)}만`} color="#E53935" />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard icon="⚡" label="계산 시간" value={`${summary.calculation_time_ms}ms`} />
        </Grid>
      </Grid>

      {results.length === 0 ? (
        <Alert icon={<CheckCircleIcon />} severity="success">
          65dB 초과 세대 없음 — 모든 수용자가 기준 이하입니다
        </Alert>
      ) : (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box p={2} pb={0}>
              <Typography variant="h6" fontWeight={700}>
                ⚠️ 65dB 초과 세대 보상금 ({results.length}건)
              </Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, minWidth: 130 }}>건물명</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>층수/세대</TableCell>
                    <TableCell sortDirection={sortBy === 'noise_db' ? sortDir : false}>
                      <TableSortLabel
                        active={sortBy === 'noise_db'}
                        direction={sortBy === 'noise_db' ? sortDir : 'asc'}
                        onClick={() => handleSort('noise_db')}
                      >소음도</TableSortLabel>
                    </TableCell>
                    <TableCell>등급</TableCell>
                    <TableCell sortDirection={sortBy === 'distance' ? sortDir : false}>
                      <TableSortLabel
                        active={sortBy === 'distance'}
                        direction={sortBy === 'distance' ? sortDir : 'asc'}
                        onClick={() => handleSort('distance')}
                      >거리</TableSortLabel>
                    </TableCell>
                    <TableCell>세대당 보상</TableCell>
                    <TableCell sortDirection={sortBy === 'total' ? sortDir : false}>
                      <TableSortLabel
                        active={sortBy === 'total'}
                        direction={sortBy === 'total' ? sortDir : 'asc'}
                        onClick={() => handleSort('total')}
                      >총 보상금</TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((r) => {
                    const lvl = LEVEL_CONFIG[r.compensation.noise_level] || LEVEL_CONFIG.safe;
                    return (
                      <TableRow key={r.receptor_id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{r.map.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.map.address}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{r.map.floors}층</Typography>
                          <Typography variant="caption" color="text.secondary">{r.compensation.households}세대</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={700} color={lvl.color}>
                            {r.noise_db.toFixed(1)} dB
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={lvl.label}
                            size="small"
                            sx={{ background: lvl.bg, color: lvl.color, fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{r.distance}m</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            ₩{r.compensation.per_household.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={700} color="#E53935">
                            ₩{r.compensation.total.toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* 합계 행 */}
                  <TableRow sx={{ background: '#FFF8E1' }}>
                    <TableCell colSpan={5}>
                      <Typography fontWeight={700}>합계</Typography>
                    </TableCell>
                    <TableCell />
                    <TableCell>
                      <Typography fontWeight={800} color="#E53935" fontSize="1rem">
                        ₩{summary.total_compensation.toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
