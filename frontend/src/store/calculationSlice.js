import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { quickCalculate, multiCalculate } from '../services/noiseEngine.js';

// 로컬 동기 계산 (항상 즉시 결과 반환)
export const runQuickCalculation = createAsyncThunk(
  'calculation/quick',
  (payload) => quickCalculate(payload)
);

export const runMultiCalculation = createAsyncThunk(
  'calculation/multi',
  (payload) => multiCalculate(payload)
);

export const fetchEquipments = createAsyncThunk(
  'calculation/fetchEquipments',
  async () => {
    try {
      const res = await fetch(
        (import.meta.env.VITE_API_BASE_URL ||
          (import.meta.env.DEV
            ? 'http://localhost:3001/api'
            : 'https://noise-backend-2ucp.onrender.com/api')) +
          '/calculations/equipments',
        { signal: AbortSignal.timeout(5000) }
      );
      const json = await res.json();
      return json.data?.equipments || [];
    } catch {
      return [];
    }
  }
);

const calculationSlice = createSlice({
  name: 'calculation',
  initialState: {
    equipments: [],
    quickResult: null,
    multiResult: null,
    loading: false,
    error: null,
    activeTab: 0,
  },
  reducers: {
    setActiveTab(state, action) { state.activeTab = action.payload; },
    clearError(state) { state.error = null; },
    clearResults(state) {
      state.quickResult = null;
      state.multiResult = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(runQuickCalculation.pending, (state) => {
        state.loading = true; state.error = null; state.quickResult = null;
      })
      .addCase(runQuickCalculation.fulfilled, (state, { payload }) => {
        state.loading = false; state.quickResult = payload;
      })
      .addCase(runQuickCalculation.rejected, (state, { error }) => {
        state.loading = false; state.error = error.message;
      });

    builder
      .addCase(runMultiCalculation.pending, (state) => {
        state.loading = true; state.error = null; state.multiResult = null;
      })
      .addCase(runMultiCalculation.fulfilled, (state, { payload }) => {
        state.loading = false; state.multiResult = payload;
      })
      .addCase(runMultiCalculation.rejected, (state, { error }) => {
        state.loading = false; state.error = error.message;
      });

    builder
      .addCase(fetchEquipments.fulfilled, (state, { payload }) => {
        if (payload.length > 0) state.equipments = payload;
      });
  },
});

export const { setActiveTab, clearError, clearResults } = calculationSlice.actions;
export default calculationSlice.reducer;
