import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CalculationPage from './pages/CalculationPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#16A34A', light: '#4ADE80', dark: '#15803D', contrastText: '#fff' },
    secondary:  { main: '#0EA5E9', light: '#38BDF8', dark: '#0284C7', contrastText: '#fff' },
    error:      { main: '#EF4444' },
    warning:    { main: '#F59E0B' },
    success:    { main: '#16A34A' },
    background: { default: '#F0FDF4', paper: '#FFFFFF' },
    text:       { primary: '#14532D', secondary: '#4B7A56' },
    divider:    '#BBF7D0',
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
          background: '#FFFFFF',
          border: '1px solid #D1FAE5',
          boxShadow: '0 2px 12px rgba(22,163,74,0.07)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
          boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
          fontWeight: 700,
          '&:hover': {
            background: 'linear-gradient(135deg, #15803D 0%, #16A34A 100%)',
            boxShadow: '0 6px 20px rgba(22,163,74,0.4)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
          boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
          fontWeight: 700,
        },
        outlinedPrimary: {
          borderColor: '#86EFAC',
          color: '#16A34A',
          '&:hover': { background: '#F0FDF4', borderColor: '#16A34A' },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root:  { color: '#16A34A' },
        track: { boxShadow: '0 0 6px rgba(22,163,74,0.35)' },
        thumb: {
          background: '#fff',
          border: '2px solid #16A34A',
          boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
          '&:hover': { boxShadow: '0 2px 14px rgba(22,163,74,0.45)' },
        },
        markLabel: { color: '#6B8F71', fontSize: 10 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: '#FAFFFE',
          '& fieldset': { borderColor: '#BBF7D0' },
          '&:hover fieldset': { borderColor: '#4ADE80' },
          '&.Mui-focused fieldset': { borderColor: '#16A34A', borderWidth: 2 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: '#6B8F71', '&.Mui-focused': { color: '#16A34A' } },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: '#6B8F71' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': { background: '#F0FDF4' },
          '&.Mui-selected': { background: '#DCFCE7' },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardError:   { background: '#FEF2F2', border: '1px solid #FECACA' },
        standardWarning: { background: '#FFFBEB', border: '1px solid #FDE68A' },
        standardSuccess: { background: '#F0FDF4', border: '1px solid #BBF7D0' },
        standardInfo:    { background: '#F0F9FF', border: '1px solid #BAE6FD' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { background: '#E7F7EC', borderRadius: 4, height: 6 },
        bar:  { borderRadius: 4 },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#D1FAE5' },
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
            background: '#F0FDF4',
            borderBottom: '2px solid #BBF7D0',
            color: '#15803D',
            fontWeight: 700,
            fontSize: 12,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover .MuiTableCell-root': { background: '#F0FDF4' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid #ECFDF5' },
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
