import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CalculationPage from './pages/CalculationPage';

const theme = createTheme({
  palette: {
    primary: { main: '#1565C0' },
    secondary: { main: '#F44336' },
    background: { default: '#F5F7FA' },
  },
  typography: {
    fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
      },
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CalculationPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
