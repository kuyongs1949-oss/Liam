/**
 * 소음 계산 입력 폼 컴포넌트
 * - 장비 선택 (대수 포함)
 * - 방음벽 설정
 * - 간편/다중 계산 모드
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, Chip, IconButton,
  Divider, Switch, FormControlLabel, CircularProgress, Alert,
  Accordion, AccordionSummary, AccordionDetails, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CalculateIcon from '@mui/icons-material/Calculate';
import InfoIcon from '@mui/icons-material/Info';
import {
  runQuickCalculation,
  runMultiCalculation,
  fetchEquipments,
  clearError,
} from '../store/calculationSlice';

// 기본 장비 목록 (서버 응답 전 fallback)
const DEFAULT_EQUIPMENTS = [
  { id: 'dozer', name: '불도저', Lw: 113 },
  { id: 'excavator', name: '굴삭기', Lw: 108 },
  { id: 'pump_car', name: '펌프카', Lw: 105 },
  { id: 'crane', name: '크레인', Lw: 102 },
  { id: 'concrete_mixer', name: '콘크리트믹서', Lw: 107 },
  { id: 'compactor', name: '다짐기', Lw: 111 },
  { id: 'pile_driver', name: '항타기', Lw: 118 },
  { id: 'air_compressor', name: '에어컴프레서', Lw: 103 },
  { id: 'jackhammer', name: '잭해머', Lw: 115 },
];

// 샘플 수용자 데이터 (서울 강남 기준)
const SAMPLE_RECEPTORS = [
  { receptor_id: 'r1', name: '현대아파트 101동', address: '서울 강남구 개포로 100', lat: 37.4849, lng: 127.0470, floors: 15, households: 60 },
  { receptor_id: 'r2', name: '삼성빌라', address: '서울 강남구 개포로 150', lat: 37.4860, lng: 127.0490, floors: 5, households: 20 },
  { receptor_id: 'r3', name: '개포주택', address: '서울 강남구 개포동 200번지', lat: 37.4840, lng: 127.0460, floors: 3, households: 6 },
  { receptor_id: 'r4', name: '래미안 203동', address: '서울 강남구 일원로 50', lat: 37.4870, lng: 127.0510, floors: 20, households: 100 },
  { receptor_id: 'r5', name: '개포상가', address: '서울 강남구 개포로 180', lat: 37.4835, lng: 127.0480, floors: 4, households: 15 },
];

export default function CalculationForm({ mode = 'quick' }) {
  const dispatch = useDispatch();
  const { loading, error, equipments: serverEquipments } = useSelector((s) => s.calculation);

  const equipmentList = serverEquipments.length > 0 ? serverEquipments : DEFAULT_EQUIPMENTS;

  // 선택된 장비 목록
  const [selectedEquipments, setSelectedEquipments] = useState([
    { equipment_id: 'excavator', count: 1 },
  ]);

  // 간편 계산 파라미터
  const [d1, setD1] = useState(10);
  const [barrierHeight, setBarrierHeight] = useState(3);
  const [barrierMaterial, setBarrierMaterial] = useState(10);
  const [d2, setD2] = useState(50);
  const [useBarrier, setUseBarrier] = useState(true);

  // 다중 계산 파라미터
  const [sourceLat, setSourceLat] = useState(37.4855);
  const [sourceLng, setSourceLng] = useState(127.0475);
  const [sufferingMonths, setSufferingMonths] = useState(3);
  const [receptors, setReceptors] = useState(SAMPLE_RECEPTORS);

  useEffect(() => {
    dispatch(fetchEquipments());
  }, [dispatch]);

  // 장비 추가
  const addEquipment = () => {
    setSelectedEquipments((prev) => [...prev, { equipment_id: 'excavator', count: 1 }]);
  };

  // 장비 삭제
  const removeEquipment = (idx) => {
    setSelectedEquipments((prev) => prev.filter((_, i) => i !== idx));
  };

  // 장비 변경
  const updateEquipment = (idx, field, value) => {
    setSelectedEquipments((prev) =>
      prev.map((eq, i) => (i === idx ? { ...eq, [field]: value } : eq))
    );
  };

  // 총 음압 미리보기
  const previewLw = () => {
    if (selectedEquipments.length === 0) return '-';
    const total = selectedEquipments.reduce((sum, eq) => {
      const info = equipmentList.find((e) => e.id === eq.equipment_id);
      if (!info) return sum;
      const lw = info.Lw + 10 * Math.log10(eq.count);
      return sum + Math.pow(10, lw / 10);
    }, 0);
    return total > 0 ? (10 * Math.log10(total)).toFixed(1) : '-';
  };

  // 간편 계산 실행
  const handleQuickCalculate = () => {
    dispatch(clearError());
    dispatch(runQuickCalculation({
      equipments: selectedEquipments,
      d1: Number(d1),
      barrier_height: useBarrier ? Number(barrierHeight) : 0,
      barrier_material_loss: Number(barrierMaterial),
      d2: Number(d2),
    }));
  };

  // 다중 계산 실행
  const handleMultiCalculate = () => {
    dispatch(clearError());
    dispatch(runMultiCalculation({
      equipments: selectedEquipments,
      source_lat: Number(sourceLat),
      source_lng: Number(sourceLng),
      receptors,
      barrier: useBarrier ? {
        height: Number(barrierHeight),
        material_loss: Number(barrierMaterial),
        d1: Number(d1),
        d2: Number(d2),
      } : null,
      suffering_months: Number(sufferingMonths),
      filter_65db: true,
    }));
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ── 장비 선택 ── */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={700}>
              🏗️ 소음 발생 장비
            </Typography>
            <Chip label={`합산 Lw: ${previewLw()} dB`} color="primary" size="small" />
          </Box>

          {selectedEquipments.map((eq, idx) => {
            const info = equipmentList.find((e) => e.id === eq.equipment_id);
            return (
              <Grid container spacing={1.5} key={idx} alignItems="center" mb={1}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>장비 선택</InputLabel>
                    <Select
                      value={eq.equipment_id}
                      label="장비 선택"
                      onChange={(e) => updateEquipment(idx, 'equipment_id', e.target.value)}
                    >
                      {equipmentList.map((e) => (
                        <MenuItem key={e.id} value={e.id}>
                          {e.name} ({e.Lw}dB)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    label="대수"
                    type="number"
                    size="small"
                    fullWidth
                    value={eq.count}
                    inputProps={{ min: 1, max: 50 }}
                    onChange={(e) => updateEquipment(idx, 'count', Number(e.target.value))}
                  />
                </Grid>
                <Grid item xs={2}>
                  {info && (
                    <Tooltip title={`단위 음압: ${info.Lw}dB(A)`}>
                      <Chip label={`${info.Lw}dB`} size="small" variant="outlined" />
                    </Tooltip>
                  )}
                </Grid>
                <Grid item xs={1}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeEquipment(idx)}
                    disabled={selectedEquipments.length === 1}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Grid>
              </Grid>
            );
          })}

          <Button startIcon={<AddIcon />} onClick={addEquipment} size="small" sx={{ mt: 1 }}>
            장비 추가
          </Button>
        </CardContent>
      </Card>

      {/* ── 방음벽 설정 ── */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={700}>🧱 거리 및 방음벽</Typography>
            <FormControlLabel
              control={<Switch checked={useBarrier} onChange={(e) => setUseBarrier(e.target.checked)} />}
              label="방음벽 적용"
            />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="d1: 소음원→방음벽 (m)"
                type="number"
                fullWidth
                size="small"
                value={d1}
                onChange={(e) => setD1(e.target.value)}
                helperText="최소 1m"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="d2: 방음벽→수음점 (m)"
                type="number"
                fullWidth
                size="small"
                value={d2}
                onChange={(e) => setD2(e.target.value)}
              />
            </Grid>
            {useBarrier && (
              <>
                <Grid item xs={6}>
                  <TextField
                    label="방음벽 높이 (m)"
                    type="number"
                    fullWidth
                    size="small"
                    value={barrierHeight}
                    inputProps={{ min: 0, max: 20, step: 0.5 }}
                    onChange={(e) => setBarrierHeight(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="재료 감쇠 (dB)"
                    type="number"
                    fullWidth
                    size="small"
                    value={barrierMaterial}
                    helperText="일반 방음벽 10~15dB"
                    onChange={(e) => setBarrierMaterial(e.target.value)}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* ── 다중 계산 전용 설정 ── */}
      {mode === 'multi' && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>📍 소음원 위치 및 평가 기간</Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField label="소음원 위도" size="small" fullWidth value={sourceLat}
                  onChange={(e) => setSourceLat(e.target.value)} />
              </Grid>
              <Grid item xs={4}>
                <TextField label="소음원 경도" size="small" fullWidth value={sourceLng}
                  onChange={(e) => setSourceLng(e.target.value)} />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="고통 기간 (개월)"
                  type="number"
                  size="small"
                  fullWidth
                  value={sufferingMonths}
                  inputProps={{ min: 0.5, step: 0.5 }}
                  onChange={(e) => setSufferingMonths(e.target.value)}
                />
              </Grid>
            </Grid>

            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">수용자 목록 ({receptors.length}개)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {receptors.map((r, i) => (
                  <Chip key={r.receptor_id} label={`${r.name} (${r.households}세대)`}
                    size="small" sx={{ m: 0.5 }} onDelete={() =>
                      setReceptors((prev) => prev.filter((_, idx) => idx !== i))
                    } />
                ))}
                <Button size="small" onClick={() => setReceptors(SAMPLE_RECEPTORS)} sx={{ mt: 1 }}>
                  샘플 데이터 복원
                </Button>
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* ── 계산 버튼 ── */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
        disabled={loading || selectedEquipments.length === 0}
        onClick={mode === 'quick' ? handleQuickCalculate : handleMultiCalculate}
        sx={{ py: 1.5, borderRadius: 2, fontSize: '1rem', fontWeight: 700 }}
      >
        {loading ? '계산 중...' : mode === 'quick' ? '간편 계산' : '다중 세대 계산 (병렬)'}
      </Button>
    </Box>
  );
}
