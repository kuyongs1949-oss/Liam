import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip,
  TableSortLabel, Alert, Grid, Paper, Divider,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StraightenIcon from '@mui/icons-material/Straighten';
import ShieldIcon from '@mui/icons-material/Shield';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

const C = {
  bg:     '#030B18',
  card:   'rgba(8,22,42,0.9)',
  border: 'rgba(0,212,255,0.1)',
  borderHi: 'rgba(0,212,255,0.28)',
  cyan:   '#00D4FF',
  text:   '#E0F4FF',
  muted:  'rgba(180,220,255,0.45)',
};

const LEVEL_CONFIG = {
  safe:   { label: '안전',    color: C.muted,   glow: 'transparent',          bg: 'rgba(180,220,255,0.04)' },
  level1: { label: '경미',    color: '#00E676',  glow: 'rgba(0,230,118,0.2)',  bg: 'rgba(0,230,118,0.06)' },
  level2: { label: '보통',    color: '#FFB300',  glow: 'rgba(255,179,0,0.2)',  bg: 'rgba(255,179,0,0.06)' },
  level3: { label: '심각',    color: '#FF6B35',  glow: 'rgba(255,107,53,0.2)', bg: 'rgba(255,107,53,0.06)' },
  level4: { label: '매우심각', color: '#B388FF',  glow: 'rgba(179,136,255,0.2)',bg: 'rgba(179,136,255,0.06)' },
};

function StatCard({ icon, label, value, color, sub }) {
  return (
    <Box sx={{
      p: 1.5, borderRadius: 2,
      background: `${(color || C.cyan)}10`,
      border: `1px solid ${(color || C.cyan)}25`,
      textAlign: 'center',
    }}>
      <Box sx={{ color: color || C.cyan, mb: 0.3, opacity: 0.7 }}>{icon}</Box>
      <Typography variant="h6" fontWeight={900} sx={{ color: color || C.cyan, fontFamily: 'monospace', lineHeight: 1 }}>
        {value}
      </Typography>
      {sub && <Typography variant="caption" sx={{ color: C.muted, display: 'block', fontSize: 9, fontFamily: 'monospace' }}>{sub}</Typography>}
      <Typography variant="caption" sx={{ color: C.muted, fontSize: 10 }}>{label}</Typography>
    </Box>
  );
}

export default function CompensationTable() {
  const { multiResult, quickResult } = useSelector((s) => s.calculation);
  const [sortBy, setSortBy]   = useState('noise_db');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  /* ── 간편 계산 결과 ── */
  if (quickResult && !multiResult) {
    const nr  = quickResult.noise_result;
    const cp  = quickResult.compensation_preview;
    const lvl = LEVEL_CONFIG[cp.noise_level] || LEVEL_CONFIG.safe;

    return (
      <Box sx={{
        borderRadius: 2, overflow: 'hidden',
        border: `1px solid ${C.border}`,
        background: C.card,
        backdropFilter: 'blur(12px)',
      }}>
        <Box sx={{
          px: 2, py: 1.2,
          background: 'linear-gradient(90deg, rgba(0,212,255,0.1), transparent)',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <Typography variant="subtitle2" sx={{ color: C.cyan, letterSpacing: '0.06em', fontSize: 12 }}>
            간편 계산 결과
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          {/* 메인 수치 */}
          <Box sx={{
            p: 2, mb: 2, borderRadius: 2, textAlign: 'center',
            background: lvl.bg,
            border: `1px solid ${lvl.color}30`,
            boxShadow: `0 0 24px ${lvl.glow}`,
          }}>
            <Typography variant="caption" sx={{ color: lvl.color, letterSpacing: '0.12em', fontSize: 10, display: 'block', mb: 0.5 }}>
              수음점 소음도
            </Typography>
            <Typography sx={{
              fontSize: 48, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1,
              color: lvl.color, textShadow: `0 0 20px ${lvl.color}66`,
            }}>
              {nr.L_receiver.toFixed(1)}
            </Typography>
            <Typography variant="caption" sx={{ color: lvl.color, fontSize: 14, fontWeight: 700 }}>dB(A)</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={lvl.label} size="small" sx={{
                background: `${lvl.color}20`, color: lvl.color,
                border: `1px solid ${lvl.color}40`, fontWeight: 700, fontSize: 11,
              }} />
            </Box>
          </Box>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6}>
              <StatCard icon={<VolumeUpIcon sx={{ fontSize: 18 }} />} label="합산 음압" value={`${nr.lw_total}dB`} color={C.cyan} />
            </Grid>
            <Grid item xs={6}>
              <StatCard icon={<StraightenIcon sx={{ fontSize: 18 }} />} label="거리 감쇠 d1" value={`-${nr.A_d1}dB`} color="#FFB300" />
            </Grid>
            <Grid item xs={6}>
              <StatCard icon={<ShieldIcon sx={{ fontSize: 18 }} />} label="방음벽 삽입손실" value={`-${nr.A_barrier}dB`} color="#00E676" />
            </Grid>
            <Grid item xs={6}>
              <StatCard icon={<TrendingDownIcon sx={{ fontSize: 18 }} />} label="거리 감쇠 d2" value={`-${nr.A_d2}dB`} color="#FF6B35" />
            </Grid>
          </Grid>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="caption" sx={{ color: C.muted, display: 'block', mb: 0.8, letterSpacing: '0.06em', fontSize: 10 }}>
            보상금 미리보기 (1세대, 3개월 기준)
          </Typography>
          <Typography sx={{
            fontSize: 28, fontWeight: 900, fontFamily: 'monospace',
            color: cp.noise_level === 'safe' ? C.muted : '#FF4D6D',
            textShadow: cp.noise_level === 'safe' ? 'none' : '0 0 16px rgba(255,77,109,0.4)',
          }}>
            ₩{cp.per_household_3months?.toLocaleString('ko-KR') || '0'}
          </Typography>
          <Typography variant="caption" sx={{ color: C.muted, fontSize: 10 }}>{cp.description}</Typography>
        </Box>
      </Box>
    );
  }

  /* ── 결과 없음 ── */
  if (!multiResult) {
    return (
      <Box sx={{
        borderRadius: 2, border: `1px solid ${C.border}`,
        background: C.card, backdropFilter: 'blur(12px)',
        textAlign: 'center', py: 6,
      }}>
        <Box sx={{
          width: 56, height: 56, borderRadius: '14px', mx: 'auto', mb: 2,
          background: 'rgba(0,212,255,0.06)', border: `1px solid ${C.borderHi}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: 24 }}>📋</Typography>
        </Box>
        <Typography sx={{ color: C.muted, fontSize: 13 }}>
          계산을 실행하면 세대별 보상금이 표시됩니다
        </Typography>
      </Box>
    );
  }

  const { summary, results } = multiResult;

  const sorted = [...(results || [])].sort((a, b) => {
    let va, vb;
    if (sortBy === 'noise_db')  { va = a.noise_db;         vb = b.noise_db; }
    else if (sortBy === 'total'){ va = a.compensation.total; vb = b.compensation.total; }
    else if (sortBy === 'distance') { va = a.distance; vb = b.distance; }
    else { va = a.map.name; vb = b.map.name; }
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  return (
    <Box>
      {/* 요약 */}
      <Grid container spacing={1.5} mb={2}>
        <Grid item xs={6} md={3}>
          <StatCard icon={<Typography sx={{ fontSize: 18 }}>🏘️</Typography>} label="총 수용자" value={`${summary.total_receptors}`} sub="세대" color={C.cyan} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<WarningAmberIcon sx={{ fontSize: 18 }} />} label="65dB 초과" value={`${summary.exceeds_65db_count}`} sub="세대" color="#FF4D6D" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<Typography sx={{ fontSize: 18 }}>💰</Typography>} label="총 보상금" value={`${(summary.total_compensation / 1_000_000).toFixed(0)}`} sub="만원" color="#FFB300" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<Typography sx={{ fontSize: 18 }}>⚡</Typography>} label="계산 시간" value={`${summary.calculation_time_ms}`} sub="ms" color="#00E676" />
        </Grid>
      </Grid>

      {results.length === 0 ? (
        <Alert icon={<CheckCircleIcon />} severity="success" sx={{ borderRadius: 2 }}>
          65dB 초과 세대 없음 — 모든 수용자가 기준 이하입니다
        </Alert>
      ) : (
        <Box sx={{
          borderRadius: 2, overflow: 'hidden',
          border: `1px solid ${C.border}`,
          background: C.card, backdropFilter: 'blur(12px)',
        }}>
          <Box sx={{
            px: 2, py: 1.2,
            background: 'linear-gradient(90deg, rgba(255,77,109,0.1), transparent)',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <WarningAmberIcon sx={{ fontSize: 16, color: '#FF4D6D' }} />
            <Typography variant="subtitle2" sx={{ color: '#FF4D6D', letterSpacing: '0.04em', fontSize: 12 }}>
              65dB 초과 세대 보상금 ({results.length}건)
            </Typography>
          </Box>

          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 130 }}>건물명</TableCell>
                  <TableCell>층수/세대</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'noise_db'}
                      direction={sortBy === 'noise_db' ? sortDir : 'asc'}
                      onClick={() => handleSort('noise_db')}
                      sx={{ color: `${C.cyan} !important`, '& .MuiTableSortLabel-icon': { color: `${C.cyan} !important` } }}
                    >소음도</TableSortLabel>
                  </TableCell>
                  <TableCell>등급</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'distance'}
                      direction={sortBy === 'distance' ? sortDir : 'asc'}
                      onClick={() => handleSort('distance')}
                      sx={{ color: `${C.cyan} !important`, '& .MuiTableSortLabel-icon': { color: `${C.cyan} !important` } }}
                    >거리</TableSortLabel>
                  </TableCell>
                  <TableCell>세대당 보상</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'total'}
                      direction={sortBy === 'total' ? sortDir : 'asc'}
                      onClick={() => handleSort('total')}
                      sx={{ color: `${C.cyan} !important`, '& .MuiTableSortLabel-icon': { color: `${C.cyan} !important` } }}
                    >총 보상금</TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((r) => {
                  const lvl = LEVEL_CONFIG[r.compensation.noise_level] || LEVEL_CONFIG.safe;
                  return (
                    <TableRow key={r.receptor_id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ color: C.text }}>{r.map.name}</Typography>
                        <Typography variant="caption" sx={{ color: C.muted }}>{r.map.address}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: C.text, fontFamily: 'monospace' }}>{r.map.floors}층</Typography>
                        <Typography variant="caption" sx={{ color: C.muted }}>{r.compensation.households}세대</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={800} sx={{ color: lvl.color, fontFamily: 'monospace', textShadow: `0 0 8px ${lvl.color}55` }}>
                          {r.noise_db.toFixed(1)} dB
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={lvl.label} size="small" sx={{
                          background: lvl.bg, color: lvl.color,
                          border: `1px solid ${lvl.color}30`, fontWeight: 700, fontSize: '0.65rem',
                          height: 20,
                        }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: C.muted, fontFamily: 'monospace' }}>{r.distance}m</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: C.text, fontFamily: 'monospace' }}>
                          ₩{r.compensation.per_household.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={800} sx={{ color: '#FF4D6D', fontFamily: 'monospace', textShadow: '0 0 8px rgba(255,77,109,0.4)' }}>
                          ₩{r.compensation.total.toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* 합계 행 */}
                <TableRow sx={{ '& .MuiTableCell-root': { background: 'rgba(255,179,0,0.06)', borderTop: '1px solid rgba(255,179,0,0.2)' } }}>
                  <TableCell colSpan={5}>
                    <Typography fontWeight={700} sx={{ color: '#FFB300', fontSize: 12, letterSpacing: '0.06em' }}>합계</Typography>
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <Typography fontWeight={900} sx={{
                      color: '#FF4D6D', fontFamily: 'monospace', fontSize: 15,
                      textShadow: '0 0 12px rgba(255,77,109,0.5)',
                    }}>
                      ₩{summary.total_compensation.toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}
