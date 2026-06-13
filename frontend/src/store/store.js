import { configureStore } from '@reduxjs/toolkit';
import calculationReducer from './calculationSlice';

export const store = configureStore({
  reducer: {
    calculation: calculationReducer,
  },
});
