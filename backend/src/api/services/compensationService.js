/**
 * 보상금 서비스 레이어
 * FastAPI Calculator와 통신, DB 저장 담당
 */

const axios = require('axios');
const standards = require('../../config/compensation-standards.json');

const CALCULATOR_URL = process.env.CALCULATOR_URL || 'http://localhost:8000';

class CompensationService {
  /**
   * 간편 계산 (Calculator 서버 호출)
   */
  static async quickCalculate(payload) {
    const resp = await axios.post(`${CALCULATOR_URL}/calculate/quick`, payload, {
      timeout: 5_000,
    });
    return resp.data;
  }

  /**
   * 다중 수용자 병렬 계산
   */
  static async multiCalculate(payload) {
    const resp = await axios.post(`${CALCULATOR_URL}/calculate/multi`, payload, {
      timeout: 10_000,
    });
    return resp.data;
  }

  /**
   * 보상금 기준표 반환 (JSON 파일 기반)
   */
  static getStandards() {
    return standards.standards.map((s) => ({
      ...s,
      example_3months: s.base_monthly * s.coefficient * 3,
      example_6months: s.base_monthly * s.coefficient * 6,
    }));
  }

  /**
   * 계산 결과 요약 통계
   */
  static summarizeResults(results) {
    if (!results || results.length === 0) {
      return { count: 0, totalCompensation: 0, maxNoise: 0, avgNoise: 0 };
    }

    const totalCompensation = results.reduce(
      (sum, r) => sum + (r.compensation?.total || 0),
      0
    );
    const noiseValues = results.map((r) => r.noise_db);

    return {
      count: results.length,
      totalCompensation,
      maxNoise: Math.max(...noiseValues),
      minNoise: Math.min(...noiseValues),
      avgNoise: noiseValues.reduce((a, b) => a + b, 0) / noiseValues.length,
      formattedTotal: `₩${totalCompensation.toLocaleString('ko-KR')}`,
    };
  }

  /**
   * 소음 등급 분류
   */
  static classifyNoise(db) {
    if (db < 65) return { level: 'safe', color: '#2196F3', label: '안전' };
    if (db < 70) return { level: 'level1', color: '#FFC107', label: '경미' };
    if (db < 75) return { level: 'level2', color: '#FF9800', label: '보통' };
    if (db < 80) return { level: 'level3', color: '#F44336', label: '심각' };
    return { level: 'level4', color: '#9C27B0', label: '매우 심각' };
  }
}

module.exports = CompensationService;
