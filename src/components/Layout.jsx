import React, { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  IconButton,
  Button,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  PointOfSale,
  Inventory,
  LocalShipping,
  LocalGasStation,
  People,
  Assessment,
  EventAvailable,
  Category,
  CurrencyRupee,
  Storage,
  Schedule,
  History,
  Logout,
  UploadFile,
  AccountBalance,
  ReceiptLong,
  ManageAccounts,
  AssignmentTurnedIn,
  CreditCard,
  DeleteSweep,
} from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const drawerWidth = 240

const salesOpsItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Sales', icon: <PointOfSale />, path: '/sales' },
  { text: 'Sales on Credit', icon: <CreditCard />, path: '/sales-credit' },
  { text: 'Inventory', icon: <Inventory />, path: '/inventory' },
  { text: 'Reports', icon: <Assessment />, path: '/reports' },
  { text: 'Tanker Receipts', icon: <LocalShipping />, path: '/tanker-receipts' },
  { text: 'Daily Close', icon: <EventAvailable />, path: '/daily-close' },
]

const configItems = [
  { text: 'Dispensers', icon: <LocalGasStation />, path: '/dispensers' },
  { text: 'Employees', icon: <People />, path: '/employees' },
  { text: 'Bulk Upload', icon: <UploadFile />, path: '/bulk-upload' },
  { text: 'Customers', icon: <People />, path: '/customers' },
  { text: 'Products', icon: <Category />, path: '/products' },
  { text: 'Product Prices', icon: <CurrencyRupee />, path: '/product-prices' },
  { text: 'Tanks', icon: <Storage />, path: '/tanks' },
  { text: 'Shifts', icon: <Schedule />, path: '/shifts' },
  { text: 'Audit', icon: <History />, path: '/audit' },
  { text: 'Deleted Records', icon: <DeleteSweep />, path: '/deleted-records' },
  { text: 'My Tasks', icon: <AssignmentTurnedIn />, path: '/my-tasks' },
  { text: 'User Management', icon: <ManageAccounts />, path: '/users' },
]

const financeItems = [
  { text: 'Bank Accounts', icon: <AccountBalance />, path: '/bank-accounts' },
  { text: 'Financial Mgmt', icon: <ReceiptLong />, path: '/financial-management' },
]

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canOps = useMemo(() => ['admin', 'manager', 'operator'].includes(role), [role])
  const isAdmin = role === 'admin'

  const [closingPromptOpen, setClosingPromptOpen] = useState(false)
  const [closingPromptCount, setClosingPromptCount] = useState(0)

  useEffect(() => {
    const run = async () => {
      if (!canOps) return
      const today = todayISO()
      const dismissedKey = `closingPromptDismissed:${today}`
      if (localStorage.getItem(dismissedKey) === '1') return

      try {
        const res = await api.get('/tanks/dips/closing-required', { params: { business_date: today } })
        const required = !!res.data?.required
        const missingCount = (res.data?.missing_tank_ids || []).length
        if (required && missingCount > 0) {
          setClosingPromptCount(missingCount)
          setClosingPromptOpen(true)
        }
      } catch (e) {
        // silently ignore (no prompt) if backend is unavailable
      }
    }
    run()
  }, [canOps])

  const menuItems = isAdmin
    ? [...salesOpsItems, ...configItems, ...financeItems]
    : canOps
      ? salesOpsItems
      : []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const dismissClosingPrompt = () => {
    const today = todayISO()
    localStorage.setItem(`closingPromptDismissed:${today}`, '1')
    setClosingPromptOpen(false)
  }

  const goToTanksForClosing = () => {
    setClosingPromptOpen(false)
    navigate('/tanks')
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <Dialog open={closingPromptOpen} onClose={dismissClosingPrompt} maxWidth="sm" fullWidth>
        <DialogTitle>Closing Stock Update Required</DialogTitle>
        <DialogContent>
          <Typography>
            Closing dip entries are missing for {closingPromptCount} tank(s) today.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please update today’s closing dips so tomorrow’s opening stock can be carried forward automatically.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={dismissClosingPrompt}>Later</Button>
          <Button variant="contained" onClick={goToTanksForClosing}>
            Update Closing Stock
          </Button>
        </DialogActions>
      </Dialog>

      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Fuel Station Management
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.full_name || user?.username}
          </Typography>
          <IconButton color="inherit" onClick={handleLogout}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}

export default Layout
