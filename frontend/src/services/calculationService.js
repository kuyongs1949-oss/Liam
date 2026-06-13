import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : 'https://noise-backend-2ucp.onrender.com/api');

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

// 에러 인터셉터: 타임아웃/네트워크 오류 메시지 한국어로
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED') {
      return Promise.reject(new Error('서버 응답 시간 초과 (20초). 잠시 후 다시 시도해주세요.'));
    }
    if (!err.response) {
      return Promise.reject(new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'));
    }
    return Promise.reject(err);
  }
);

export const calculationService = {
  async quickCalculate(payload) {
    const res = await api.post('/calculations/quick', payload);
    return res.data;
  },
  async multiCalculate(payload) {
    const res = await api.post('/calculations/multi', payload, { timeout: 30_000 });
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
