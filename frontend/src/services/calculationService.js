import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const calculationService = {
  async quickCalculate(payload) {
    const res = await api.post('/calculations/quick', payload);
    return res.data;
  },
  async multiCalculate(payload) {
    const res = await api.post('/calculations/multi', payload);
    return res.data;
  },
  async getEquipments() {
    const res = await api.get('/calculations/equipments');
    return res.data;
  },
  async getCompensationStandards() {
    const res = await api.get('/compensation/standards');
    return res.data;
  },
};
