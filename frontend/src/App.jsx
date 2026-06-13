import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CalculationPage from './pages/CalculationPage';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#00D4FF' },
    secondary:  { main: '#FF6B35' },
    error:      { main: '#FF4D6D' },
    warning:    { main: '#FFB300' },
    success:    { main: '#00E676' },
    background: { default: '#03071E', paper: '#0A1628' },
    text:       { primary: '#E0F4FF', secondary: 'rgba(180,220,255,0.55)' },
    divider:    'rgba(0,212,255,0.1)',
  },
  typography: {
    fontFamily: '"Noto Sans KR", "Inter", "Roboto", sans-serif',
    h6:  { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: 'rgba(10,28,52,0.85)',
          border: '1px solid rgba(0,212,255,0.1)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: 'linear-gradient(135deg, #0099CC 0%, #00D4FF 100%)',
          boxShadow: '0 0 20px rgba(0,212,255,0.35)',
          fontWeight: 700,
          '&:hover': {
            background: 'linear-gradient(135deg, #00B8E6 0%, #33DDFF 100%)',
            boxShadow: '0 0 28px rgba(0,212,255,0.55)',
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { color: '#00D4FF' },
        track: { boxShadow: '0 0 8px rgba(0,212,255,0.5)' },
        thumb: {
          boxShadow: '0 0 10px rgba(0,212,255,0.6)',
          '&:hover': { boxShadow: '0 0 16px rgba(0,212,255,0.8)' },
        },
        markLabel: { color: 'rgba(180,220,255,0.5)', fontSize: 10 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: 'rgba(0,212,255,0.04)',
          '& fieldset': { borderColor: 'rgba(0,212,255,0.18)' },
          '&:hover fieldset': { borderColor: 'rgba(0,212,255,0.4)' },
          '&.Mui-focused fieldset': { borderColor: '#00D4FF', boxShadow: '0 0 0 2px rgba(0,212,255,0.15)' },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: 'rgba(180,220,255,0.5)', '&.Mui-focused': { color: '#00D4FF' } },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: 'rgba(0,212,255,0.5)' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': { background: 'rgba(0,212,255,0.08)' },
          '&.Mui-selected': { background: 'rgba(0,212,255,0.12)' },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardError:   { background: 'rgba(255,77,109,0.12)', border: '1px solid rgba(255,77,109,0.3)' },
        standardWarning: { background: 'rgba(255,179,0,0.1)',   border: '1px solid rgba(255,179,0,0.25)' },
        standardSuccess: { background: 'rgba(0,230,118,0.1)',   border: '1px solid rgba(0,230,118,0.25)' },
        standardInfo:    { background: 'rgba(0,212,255,0.08)',  border: '1px solid rgba(0,212,255,0.2)' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { background: 'rgba(255,255,255,0.06)', borderRadius: 4 },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(0,212,255,0.1)' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            background: 'rgba(0,212,255,0.06)',
            borderBottom: '1px solid rgba(0,212,255,0.15)',
            color: '#00D4FF',
            fontWeight: 700,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover .MuiTableCell-root': { background: 'rgba(0,212,255,0.04)' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(0,212,255,0.06)' },
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
