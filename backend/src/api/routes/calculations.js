/**
 * 계산 API 라우터
 * - Python Calculator 없을 때 noiseEngine(Node.js) 으로 자동 fallback
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const CompensationService = require('../services/compensationService');
const noiseEngine = require('../services/noiseEngine');

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

/** POST /api/calculations/quick */
router.post(
  '/quick',
  [
    body('equipments').isArray({ min: 1 }),
    body('d1').isFloat({ min: 1 }),
    body('d2').isFloat({ min: 1 }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      // Python 서버 시도 → 실패하면 Node.js 엔진 사용
      let result;
      try {
        result = (await CompensationService.quickCalculate(req.body)).data ?? await CompensationService.quickCalculate(req.body);
      } catch {
        result = noiseEngine.quickCalculate(req.body);
      }
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/** POST /api/calculations/multi */
router.post(
  '/multi',
  [
    body('equipments').isArray({ min: 1 }),
    body('source_lat').isFloat(),
    body('source_lng').isFloat(),
    body('receptors').isArray({ min: 1 }),
    body('suffering_months').isFloat({ min: 0.5 }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      let result;
      try {
        const r = await CompensationService.multiCalculate(req.body);
        result = r.data ?? r;
      } catch {
        result = noiseEngine.multiCalculate(req.body);
      }
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/** GET /api/calculations/equipments */
router.get('/equipments', async (req, res) => {
  try {
    let equipments;
    try {
      const axios = require('axios');
      const r = await axios.get(`${process.env.CALCULATOR_URL || 'http://localhost:8000'}/equipments`, { timeout: 2000 });
      equipments = r.data.equipments;
    } catch {
      equipments = noiseEngine.getEquipments();
    }
    res.json({ success: true, data: { equipments } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
