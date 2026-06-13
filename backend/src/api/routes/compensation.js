/**
 * 보상금 API 라우터
 */
const express = require('express');
const CompensationService = require('../services/compensationService');

const router = express.Router();

/**
 * GET /api/compensation/standards
 * 환경부 보상금 기준표
 */
router.get('/standards', (req, res) => {
  try {
    const standards = CompensationService.getStandards();
    res.json({ success: true, data: standards });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/compensation/calculate
 * 단일 세대 보상금 계산
 */
router.post('/calculate', (req, res) => {
  try {
    const { noise_db, households = 1, suffering_months = 3 } = req.body;

    if (typeof noise_db !== 'number') {
      return res.status(400).json({ success: false, error: 'noise_db 값이 필요합니다' });
    }

    const classify = CompensationService.classifyNoise(noise_db);
    const standards = CompensationService.getStandards();
    const std = standards.find((s) => s.level === classify.level);

    if (!std) {
      return res.json({
        success: true,
        data: {
          noise_db,
          level: 'safe',
          total_compensation: 0,
          message: '65dB 미만 - 보상 대상 아님',
        },
      });
    }

    const per_household = std.base_monthly * std.coefficient * suffering_months;
    const total = per_household * households;

    res.json({
      success: true,
      data: {
        noise_db,
        noise_level: classify.level,
        color: classify.color,
        label: classify.label,
        base_monthly: std.base_monthly,
        coefficient: std.coefficient,
        suffering_months,
        households,
        per_household_compensation: Math.round(per_household),
        total_compensation: Math.round(total),
        formatted_total: `₩${Math.round(total).toLocaleString('ko-KR')}`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
