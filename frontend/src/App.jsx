import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CalculationPage from './pages/CalculationPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#1A73E8', light: '#4285F4', dark: '#1557B0', contrastText: '#fff' },
    secondary:  { main: '#0F9D58', contrastText: '#fff' },
    error:      { main: '#EA4335' },
    warning:    { main: '#FBBC04' },
    success:    { main: '#0F9D58' },
    background: { default: '#F1F3F4', paper: '#FFFFFF' },
    text:       { primary: '#202124', secondary: '#5F6368' },
    divider:    '#DADCE0',
  },
  typography: {
    fontFamily: '"Google Sans", "Roboto", "Noto Sans KR", -apple-system, sans-serif',
    fontSize: 14,
    h6:       { fontWeight: 500, fontSize: '1rem' },
    subtitle1:{ fontWeight: 500, fontSize: '0.9rem' },
    subtitle2:{ fontWeight: 500, fontSize: '0.85rem' },
    body1:    { fontSize: '0.875rem' },
    body2:    { fontSize: '0.8rem' },
    caption:  { fontSize: '0.75rem', color: '#5F6368' },
  },
  shape: { borderRadius: 8 },
  shadows: [
    'none',
    '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px rgba(60,64,67,0.15)',
    '0 1px 2px rgba(60,64,67,0.3), 0 2px 6px rgba(60,64,67,0.15)',
    '0 2px 6px rgba(60,64,67,0.3), 0 1px 2px rgba(60,64,67,0.15)',
    '0 2px 6px rgba(60,64,67,0.3), 0 4px 8px rgba(60,64,67,0.15)',
    ...Array(20).fill('0 4px 12px rgba(60,64,67,0.3)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*':    { boxSizing: 'border-box' },
        body:   { background: '#F1F3F4' },
        '::-webkit-scrollbar':       { width: 6, height: 6 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': { background: '#BDC1C6', borderRadius: 3 },
        '::-webkit-scrollbar-thumb:hover': { background: '#9AA0A6' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 1 },
      styleOverrides: {
        root:        { backgroundImage: 'none' },
        elevation1:  { boxShadow: '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px rgba(60,64,67,0.15)' },
        elevation2:  { boxShadow: '0 1px 2px rgba(60,64,67,0.3), 0 2px 6px rgba(60,64,67,0.15)' },
        elevation3:  { boxShadow: '0 2px 6px rgba(60,64,67,0.3), 0 1px 2px rgba(60,64,67,0.15)' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 1 },
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 500, borderRadius: 20,
          boxShadow: 'none', letterSpacing: '0.01em',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          background: '#1A73E8', fontWeight: 500,
          '&:hover': { background: '#1557B0' },
        },
        outlinedPrimary: {
          borderColor: '#DADCE0', color: '#1A73E8',
          '&:hover': { background: '#E8F0FE', borderColor: '#1A73E8' },
        },
        text: { color: '#1A73E8', '&:hover': { background: '#E8F0FE' } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 24, background: '#FFFFFF', fontSize: 14,
          '& fieldset': { borderColor: 'transparent' },
          '&:hover fieldset': { borderColor: 'transparent' },
          '&.Mui-focused fieldset': { borderColor: 'transparent', borderWidth: 0 },
          boxShadow: '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px rgba(60,64,67,0.15)',
          '&:hover': { boxShadow: '0 2px 6px rgba(60,64,67,0.3), 0 1px 2px rgba(60,64,67,0.15)' },
          '&.Mui-focused': { boxShadow: '0 2px 6px rgba(60,64,67,0.3), 0 4px 8px rgba(60,64,67,0.15)' },
          transition: 'box-shadow 0.2s',
        },
        input: { padding: '10px 16px' },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: '#5F6368', '&.Mui-focused': { color: '#1A73E8' } },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: { borderRadius: 8 },
        icon:  { color: '#5F6368' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 14, borderRadius: 4, mx: 0.5,
          '&:hover':      { background: '#E8F0FE' },
          '&.Mui-selected': { background: '#E8F0FE', color: '#1A73E8' },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 500, fontSize: 14,
          minHeight: 48, color: '#5F6368',
          '&.Mui-selected': { color: '#1A73E8', fontWeight: 600 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { background: '#1A73E8', height: 3, borderRadius: '3px 3px 0 0' },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root:  { color: '#1A73E8' },
        thumb: { background: '#fff', border: '2px solid #1A73E8', width: 18, height: 18 },
        track: { height: 4, borderRadius: 2 },
        rail:  { height: 4, borderRadius: 2, background: '#DADCE0' },
        markLabel: { fontSize: 11, color: '#9AA0A6' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: 12, borderRadius: 8, height: 24 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root:            { fontSize: 13, borderRadius: 8 },
        standardInfo:    { background: '#E8F0FE', color: '#1558D6' },
        standardSuccess: { background: '#E6F4EA', color: '#137333' },
        standardWarning: { background: '#FEF7E0', color: '#B06000' },
        standardError:   { background: '#FCE8E6', color: '#C5221F' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { background: '#E8EAED', borderRadius: 4, height: 4 },
        bar:  { borderRadius: 4 },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: '#E8EAED' } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            background: '#F8F9FA', color: '#5F6368',
            fontWeight: 600, fontSize: 12,
            borderBottom: '1px solid #E8EAED',
            padding: '8px 12px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid #F1F3F4', fontSize: 13, padding: '8px 12px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:hover .MuiTableCell-root': { background: '#F8F9FA' } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 20, '&:hover': { background: '#E8EAED' } },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { background: '#3C4043', fontSize: 12, borderRadius: 4 },
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
