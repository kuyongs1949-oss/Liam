import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { calculationService } from '../services/calculationService';

// ── 비동기 액션 ──────────────────────────────
export const runQuickCalculation = createAsyncThunk(
  'calculation/quick',
  async (payload, { rejectWithValue }) => {
    try {
      return await calculationService.quickCalculate(payload);
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message);
    }
  }
);

export const runMultiCalculation = createAsyncThunk(
  'calculation/multi',
  async (payload, { rejectWithValue }) => {
    try {
      return await calculationService.multiCalculate(payload);
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message);
    }
  }
);

export const fetchEquipments = createAsyncThunk(
  'calculation/fetchEquipments',
  async (_, { rejectWithValue }) => {
    try {
      return await calculationService.getEquipments();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ── 슬라이스 ─────────────────────────────────
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
    // Quick Calculate
    builder
      .addCase(runQuickCalculation.pending, (state) => {
        state.loading = true; state.error = null;
      })
      .addCase(runQuickCalculation.fulfilled, (state, { payload }) => {
        state.loading = false; state.quickResult = payload;
      })
      .addCase(runQuickCalculation.rejected, (state, { payload }) => {
        state.loading = false; state.error = payload;
      });

    // Multi Calculate
    builder
      .addCase(runMultiCalculation.pending, (state) => {
        state.loading = true; state.error = null;
      })
      .addCase(runMultiCalculation.fulfilled, (state, { payload }) => {
        state.loading = false; state.multiResult = payload;
      })
      .addCase(runMultiCalculation.rejected, (state, { payload }) => {
        state.loading = false; state.error = payload;
      });

    // Fetch Equipments
    builder
      .addCase(fetchEquipments.fulfilled, (state, { payload }) => {
        state.equipments = payload.data?.equipments || [];
      });
  },
});

export const { setActiveTab, clearError, clearResults } = calculationSlice.actions;
export default calculationSlice.reducer;
