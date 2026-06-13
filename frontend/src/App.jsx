import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CalculationPage from './pages/CalculationPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#03C75A', light: '#05E066', dark: '#02A64C', contrastText: '#fff' },
    secondary:  { main: '#0068C3', contrastText: '#fff' },
    error:      { main: '#FA2828' },
    warning:    { main: '#FF8A00' },
    success:    { main: '#03C75A' },
    background: { default: '#F4F4F4', paper: '#FFFFFF' },
    text:       { primary: '#222222', secondary: '#767676' },
    divider:    '#E5E5E5',
  },
  typography: {
    fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 13,
    h6:       { fontWeight: 700, fontSize: '1rem' },
    subtitle1:{ fontWeight: 600, fontSize: '0.9rem' },
    subtitle2:{ fontWeight: 600, fontSize: '0.8rem' },
    body1:    { fontSize: '0.85rem' },
    body2:    { fontSize: '0.8rem' },
    caption:  { fontSize: '0.72rem' },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': { boxSizing: 'border-box', margin: 0, padding: 0 },
        body: { background: '#F4F4F4' },
        '::-webkit-scrollbar':       { width: 4 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': { background: '#CCCCCC', borderRadius: 4 },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none', boxShadow: 'none' } },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8, background: '#FFFFFF',
          border: '1px solid #E5E5E5', boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        containedPrimary: {
          background: '#03C75A', fontWeight: 700,
          '&:hover': { background: '#02A64C' },
        },
        outlinedPrimary: {
          borderColor: '#03C75A', color: '#03C75A',
          '&:hover': { background: '#F0FCF5', borderColor: '#02A64C' },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root:  { color: '#03C75A' },
        thumb: { background: '#fff', border: '2px solid #03C75A', width: 16, height: 16 },
        track: { height: 4 },
        rail:  { height: 4, background: '#E0E0E0' },
        markLabel: { fontSize: 10, color: '#999' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: '#FFFFFF', fontSize: 13,
          '& fieldset': { borderColor: '#E0E0E0' },
          '&:hover fieldset': { borderColor: '#BBBBBB' },
          '&.Mui-focused fieldset': { borderColor: '#03C75A', borderWidth: 1.5 },
        },
        input: { padding: '8px 12px' },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: 13, color: '#888', '&.Mui-focused': { color: '#03C75A' } },
      },
    },
    MuiSelect: {
      styleOverrides: { icon: { color: '#999' } },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 13,
          '&:hover': { background: '#F5F5F5' },
          '&.Mui-selected': { background: '#F0FCF5', color: '#02A64C' },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 500, fontSize: 13,
          minHeight: 44, padding: '0 14px', color: '#555',
          '&.Mui-selected': { color: '#03C75A', fontWeight: 700 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { background: '#03C75A', height: 2.5 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: 11, borderRadius: 4 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: 12, borderRadius: 6 },
        standardInfo:    { background: '#EAF4FB', color: '#0060AF' },
        standardSuccess: { background: '#E8FAF0', color: '#027A38' },
        standardWarning: { background: '#FFF4E5', color: '#B35D00' },
        standardError:   { background: '#FEF0F0', color: '#C41E1E' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { background: '#EEEEEE', borderRadius: 4, height: 5 },
        bar:  { borderRadius: 4 },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: '#EBEBEB' } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            background: '#F7F7F7', color: '#555',
            fontWeight: 700, fontSize: 11,
            borderBottom: '1px solid #E5E5E5',
            padding: '8px 10px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid #F0F0F0', fontSize: 12, padding: '7px 10px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:hover .MuiTableCell-root': { background: '#FAFAFA' } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 6 },
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
