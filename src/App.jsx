import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

// Components
import Layout from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Sales from './pages/Sales'
import SalesCredit from './pages/SalesCredit'
import DeletedRecords from './pages/DeletedRecords'
import Inventory from './pages/Inventory'
import Dispensers from './pages/Dispensers'
import Employees from './pages/Employees'
import Customers from './pages/Customers'
import Reports from './pages/Reports'
import DailyClose from './pages/DailyClose'
import Products from './pages/Products'
import ProductPrices from './pages/ProductPrices'
import Tanks from './pages/Tanks'
import Shifts from './pages/Shifts'
import Audit from './pages/Audit'
import TankerReceipts from './pages/TankerReceipts'
import BulkUpload from './pages/BulkUpload'
import BankAccounts from './pages/BankAccounts'
import FinancialManagement from './pages/FinancialManagement'
import UserManagement from './pages/UserManagement'
import MyTasks from './pages/MyTasks'

import { ToastProvider } from './context/ToastContext'

// Context
import { AuthProvider, useAuth } from './context/AuthContext'

const queryClient = new QueryClient()

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f4c5c',
      light: '#1f6f8b',
      dark: '#0b3541',
      contrastText: '#f8fafc',
    },
    secondary: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#b45309',
      contrastText: '#1f2937',
    },
    success: { main: '#16a34a' },
    warning: { main: '#f97316' },
    error: { main: '#dc2626' },
    info: { main: '#0284c7' },
    background: {
      default: '#eef2f6',
      paper: 'rgba(255, 255, 255, 0.86)',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    divider: 'rgba(148, 163, 184, 0.35)',
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Manrope", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: 0.4,
    },
    h6: {
      fontWeight: 600,
      letterSpacing: 0.2,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '@import': [
          'url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap")',
        ],
        body: {
          backgroundImage:
            'radial-gradient(circle at 10% 15%, rgba(14, 116, 144, 0.18), transparent 45%), radial-gradient(circle at 90% 20%, rgba(249, 115, 22, 0.16), transparent 40%), linear-gradient(180deg, #f8fafc 0%, #eef2f6 60%, #e7edf4 100%)',
          backgroundAttachment: 'fixed',
        },
        '#root': {
          minHeight: '100vh',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.75))',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)',
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(120deg, rgba(15, 76, 92, 0.95), rgba(31, 111, 139, 0.92))',
          borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
          boxShadow: '0 16px 30px rgba(2, 6, 23, 0.2)',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(226, 232, 240, 0.9))',
          borderRight: '1px solid rgba(148, 163, 184, 0.4)',
          boxShadow: '8px 0 24px rgba(15, 23, 42, 0.08)',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingLeft: 18,
          paddingRight: 18,
          transition: 'all 0.2s ease',
          boxShadow: 'none',
        },
        contained: {
          backgroundImage: 'linear-gradient(135deg, #0f4c5c, #1f6f8b)',
          boxShadow: '0 12px 20px rgba(15, 76, 92, 0.25)',
        },
        outlined: {
          borderColor: 'rgba(15, 76, 92, 0.4)',
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(8px)',
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&:active': {
            transform: 'translateY(1px) scale(0.99)',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '4px 10px',
          '&.Mui-selected': {
            backgroundImage: 'linear-gradient(135deg, rgba(15, 76, 92, 0.18), rgba(31, 111, 139, 0.15))',
            border: '1px solid rgba(15, 76, 92, 0.25)',
          },
          '&.Mui-selected:hover': {
            backgroundImage: 'linear-gradient(135deg, rgba(15, 76, 92, 0.25), rgba(31, 111, 139, 0.2))',
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 76, 92, 0.08)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: '#0f172a',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0f172a',
        },
      },
    },
  },
})

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function normalizeRole(role) {
  return role === 'cashier' ? 'operator' : role
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  const role = normalizeRole(user.role)
  return roles.includes(role) ? children : <Navigate to="/" replace />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ToastProvider>
          <Router>
            <Routes>
              <Route path="/setup" element={<Setup />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route
                  path="sales"
                  element={
                    <RoleRoute roles={['admin', 'manager', 'operator']}>
                      <Sales />
                    </RoleRoute>
                  }
                />
                <Route
                  path="sales-credit"
                  element={
                    <RoleRoute roles={['admin', 'manager', 'operator']}>
                      <SalesCredit />
                    </RoleRoute>
                  }
                />
                <Route
                  path="deleted-records"
                  element={
                    <RoleRoute roles={['admin']}>
                      <DeletedRecords />
                    </RoleRoute>
                  }
                />
                <Route
                  path="inventory"
                  element={
                    <RoleRoute roles={['admin', 'manager', 'operator']}>
                      <Inventory />
                    </RoleRoute>
                  }
                />
                <Route
                  path="dispensers"
                  element={
                    <RoleRoute roles={['admin']}>
                      <Dispensers />
                    </RoleRoute>
                  }
                />
                <Route path="pumps" element={<Navigate to="/dispensers" replace />} />
                <Route
                  path="employees"
                  element={
                    <RoleRoute roles={['admin']}>
                      <Employees />
                    </RoleRoute>
                  }
                />
                <Route
                  path="customers"
                  element={
                    <RoleRoute roles={['admin']}>
                      <Customers />
                    </RoleRoute>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <RoleRoute roles={['admin', 'manager', 'operator']}>
                      <Reports />
                    </RoleRoute>
                  }
                />
                <Route
                  path="daily-close"
                  element={
                    <RoleRoute roles={['admin', 'manager', 'operator']}>
                      <DailyClose />
                    </RoleRoute>
                  }
                />
                <Route
                  path="products"
                  element={
                    <RoleRoute roles={['admin']}>
                      <Products />
                    </RoleRoute>
                  }
                />
                <Route
                  path="product-prices"
                  element={
                    <RoleRoute roles={['admin']}>
                      <ProductPrices />
                    </RoleRoute>
                  }
                />
                <Route
                  path="tanks"
                  element={
                    <RoleRoute roles={['admin']}>
                      <Tanks />
                    </RoleRoute>
                  }
                />
                <Route
                  path="tanker-receipts"
                  element={
                    <RoleRoute roles={['admin', 'manager', 'operator']}>
                      <TankerReceipts />
                    </RoleRoute>
                  }
                />
                <Route
                  path="bulk-upload"
                  element={
                    <RoleRoute roles={['admin']}>
                      <BulkUpload />
                    </RoleRoute>
                  }
                />
                <Route
                  path="shifts"
                  element={
                    <RoleRoute roles={['admin']}>
                      <Shifts />
                    </RoleRoute>
                  }
                />
                <Route
                  path="audit"
                  element={
                    <RoleRoute roles={['admin']}>
                      <Audit />
                    </RoleRoute>
                  }
                />
                <Route
                  path="my-tasks"
                  element={
                    <RoleRoute roles={['admin']}>
                      <MyTasks />
                    </RoleRoute>
                  }
                />
                <Route
                  path="users"
                  element={
                    <RoleRoute roles={['admin']}>
                      <UserManagement />
                    </RoleRoute>
                  }
                />
                <Route
                  path="bank-accounts"
                  element={
                    <RoleRoute roles={['admin']}>
                      <BankAccounts />
                    </RoleRoute>
                  }
                />
                <Route
                  path="financial-management"
                  element={
                    <RoleRoute roles={['admin']}>
                      <FinancialManagement />
                    </RoleRoute>
                  }
                />
              </Route>
            </Routes>
          </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
