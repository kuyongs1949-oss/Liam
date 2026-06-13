import axios from 'axios';
import * as localEngine from './noiseEngine.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : 'https://noise-backend-2ucp.onrender.com/api');

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

export const calculationService = {
  async quickCalculate(payload) {
    try {
      const res = await api.post('/calculations/quick', payload);
      return res.data?.data ?? res.data;
    } catch {
      // 백엔드 불가 시 브라우저에서 직접 계산
      return localEngine.quickCalculate(payload);
    }
  },

  async multiCalculate(payload) {
    try {
      const res = await api.post('/calculations/multi', payload, { timeout: 15_000 });
      return res.data?.data ?? res.data;
    } catch {
      return localEngine.multiCalculate(payload);
    }
  },

  async getEquipments() {
    try {
      const res = await api.get('/calculations/equipments');
      return res.data;
    } catch {
      return { data: { equipments: localEngine.getEquipments() } };
    }
  },

  async getCompensationStandards() {
    try {
      const res = await api.get('/compensation/standards');
      return res.data;
    } catch {
      return { data: { standards: [] } };
    }
  },
};
