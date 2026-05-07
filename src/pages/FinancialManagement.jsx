import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { exportRowsToCSV, exportRowsToPDF, exportRowsToXLSX, viewRowsAsPDF } from '../utils/exporting'

function FinancialManagement() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [accountId, setAccountId] = useState('')
  const [entryDate, setEntryDate] = useState('')

  const [cashAdjustments, setCashAdjustments] = useState([])
  const [onlineAllocations, setOnlineAllocations] = useState([])
  const [cashDeposits, setCashDeposits] = useState([])
  const [expenses, setExpenses] = useState([])

  const [cashAdjDialog, setCashAdjDialog] = useState(false)
  const [allocationDialog, setAllocationDialog] = useState(false)
  const [depositDialog, setDepositDialog] = useState(false)
  const [expenseDialog, setExpenseDialog] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)

  const [cashAdjForm, setCashAdjForm] = useState({ amount: '', remarks: '' })
  const [allocationForm, setAllocationForm] = useState({ account_id: '', amount: '', remarks: '' })
  const [depositForm, setDepositForm] = useState({ account_id: '', amount: '', remarks: '' })
  const [expenseForm, setExpenseForm] = useState({
    category_id: '',
    paid_from: 'cash',
    account_id: '',
    amount: '',
    remarks: '',
  })
  const [categoryForm, setCategoryForm] = useState({ category_name: '' })

  const todayISO = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  useEffect(() => {
    if (!isAdmin) return
    const today = todayISO()
    setFromDate(today)
    setToDate(today)
    setEntryDate(today)
    fetchAccounts()
    fetchCategories()
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin || !fromDate || !toDate) return
    fetchSummary()
  }, [isAdmin, fromDate, toDate, accountId])

  useEffect(() => {
    if (!isAdmin || !entryDate) return
    fetchEntries(entryDate)
  }, [isAdmin, entryDate, accountId])

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/financial/bank-accounts')
      setAccounts(res.data || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch bank accounts')
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get('/financial/expense-categories')
      setCategories(res.data || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch expense categories')
    }
  }

  const fetchSummary = async () => {
    setError('')
    try {
      const params = { from_date: fromDate, to_date: toDate }
      if (accountId) params.account_id = accountId
      const res = await api.get('/financial/summary', { params })
      setSummary(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch financial summary')
    }
  }

  const fetchEntries = async (dateValue) => {
    setError('')
    try {
      const params = { from_date: dateValue, to_date: dateValue }
      if (accountId) params.account_id = accountId
      const [adjRes, allocRes, depRes, expRes] = await Promise.all([
        api.get('/financial/cash-adjustments', { params }),
        api.get('/financial/online-allocations', { params }),
        api.get('/financial/cash-deposits', { params }),
        api.get('/financial/expenses', { params }),
      ])
      setCashAdjustments(adjRes.data || [])
      setOnlineAllocations(allocRes.data || [])
      setCashDeposits(depRes.data || [])
      setExpenses(expRes.data || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch daily entries')
    }
  }

  const selectedSummaryDay = useMemo(() => {
    if (!summary?.rows || !entryDate) return null
    return summary.rows.find((row) => row.business_date === entryDate) || null
  }, [summary, entryDate])

  const exportRows = useMemo(() => {
    if (!summary?.rows) return []
    return summary.rows.map((row) => ({
      Date: row.business_date,
      'Opening Cash': row.opening_cash.toFixed(2),
      'Opening Accounts': row.opening_accounts.toFixed(2),
      'Opening Total': row.opening_total.toFixed(2),
      'Sales Quantity': row.sales_quantity.toFixed(2),
      'Sales Amount': row.sales_amount.toFixed(2),
      'Sales Cash': row.sales_cash.toFixed(2),
      'Sales Online': row.sales_online.toFixed(2),
      'Online Allocated': row.online_allocated.toFixed(2),
      'Online Unallocated': row.online_unallocated.toFixed(2),
      'Cash Adjustments': row.cash_adjustments.toFixed(2),
      'Cash Deposits': row.cash_deposits.toFixed(2),
      'Cash Expenses': row.cash_expenses.toFixed(2),
      'Account Expenses': row.account_expenses.toFixed(2),
      'Closing Cash': row.closing_cash.toFixed(2),
      'Closing Accounts': row.closing_accounts.toFixed(2),
      'Closing Total': row.closing_total.toFixed(2),
    }))
  }, [summary])

  const handleAddCashAdjustment = async () => {
    setError('')
    try {
      await api.post('/financial/cash-adjustments', {
        business_date: entryDate,
        amount: parseFloat(cashAdjForm.amount || 0),
        remarks: cashAdjForm.remarks || null,
      })
      setCashAdjDialog(false)
      setCashAdjForm({ amount: '', remarks: '' })
      await fetchEntries(entryDate)
      await fetchSummary()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add cash adjustment')
    }
  }

  const handleAddAllocation = async () => {
    setError('')
    try {
      await api.post('/financial/online-allocations', {
        business_date: entryDate,
        account_id: Number(allocationForm.account_id),
        amount: parseFloat(allocationForm.amount || 0),
        remarks: allocationForm.remarks || null,
      })
      setAllocationDialog(false)
      setAllocationForm({ account_id: '', amount: '', remarks: '' })
      await fetchEntries(entryDate)
      await fetchSummary()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add allocation')
    }
  }

  const handleAddDeposit = async () => {
    setError('')
    try {
      await api.post('/financial/cash-deposits', {
        business_date: entryDate,
        account_id: Number(depositForm.account_id),
        amount: parseFloat(depositForm.amount || 0),
        remarks: depositForm.remarks || null,
      })
      setDepositDialog(false)
      setDepositForm({ account_id: '', amount: '', remarks: '' })
      await fetchEntries(entryDate)
      await fetchSummary()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add cash deposit')
    }
  }

  const handleAddExpense = async () => {
    setError('')
    try {
      const payload = {
        business_date: entryDate,
        category_id: Number(expenseForm.category_id),
        paid_from: expenseForm.paid_from,
        amount: parseFloat(expenseForm.amount || 0),
        remarks: expenseForm.remarks || null,
      }
      if (expenseForm.paid_from === 'account') {
        payload.account_id = Number(expenseForm.account_id)
      }
      await api.post('/financial/expenses', payload)
      setExpenseDialog(false)
      setExpenseForm({ category_id: '', paid_from: 'cash', account_id: '', amount: '', remarks: '' })
      await fetchEntries(entryDate)
      await fetchSummary()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add expense')
    }
  }

  const handleAddCategory = async () => {
    setError('')
    try {
      await api.post('/financial/expense-categories', {
        category_name: categoryForm.category_name.trim(),
        is_active: true,
      })
      setCategoryDialog(false)
      setCategoryForm({ category_name: '' })
      await fetchCategories()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add expense category')
    }
  }

  const handleDelete = async (path, id) => {
    if (!window.confirm('Delete this entry?')) return
    setError('')
    try {
      await api.delete(`${path}/${id}`)
      await fetchEntries(entryDate)
      await fetchSummary()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete entry')
    }
  }

  if (!isAdmin) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Financial Management
        </Typography>
        <Alert severity="info">Only Admin can access Financial Management.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Financial Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => exportRowsToCSV(exportRows, { filename: 'financial_summary.csv' })}>
            Export CSV
          </Button>
          <Button variant="outlined" onClick={() => exportRowsToXLSX(exportRows, { filename: 'financial_summary.xlsx', sheetName: 'Summary' })}>
            Export XLSX
          </Button>
          <Button variant="outlined" onClick={() => exportRowsToPDF(exportRows, { filename: 'financial_summary.pdf', title: 'Financial Summary' })}>
            Export PDF
          </Button>
          <Button variant="outlined" onClick={() => viewRowsAsPDF(exportRows, { title: 'Financial Summary' })}>
            View PDF
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Summary Filters
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            label="From Date"
            type="date"
            size="small"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Account"
            select
            size="small"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">All Accounts</MenuItem>
            {accounts.map((acct) => (
              <MenuItem key={acct.id} value={acct.id}>
                {acct.account_name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', mb: 3 }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary">Opening Total</Typography>
            <Typography variant="h5">{selectedSummaryDay ? selectedSummaryDay.opening_total.toFixed(2) : '0.00'}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary">Sales (Cash + Online)</Typography>
            <Typography variant="h5">{selectedSummaryDay ? (selectedSummaryDay.sales_cash + selectedSummaryDay.sales_online).toFixed(2) : '0.00'}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary">Total Expenses</Typography>
            <Typography variant="h5">
              {selectedSummaryDay ? (selectedSummaryDay.cash_expenses + selectedSummaryDay.account_expenses).toFixed(2) : '0.00'}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary">Closing Total</Typography>
            <Typography variant="h5">{selectedSummaryDay ? selectedSummaryDay.closing_total.toFixed(2) : '0.00'}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Daily Summary
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Opening</TableCell>
                <TableCell align="right">Sales Amount</TableCell>
                <TableCell align="right">Sales Cash</TableCell>
                <TableCell align="right">Sales Online</TableCell>
                <TableCell align="right">Online Allocated</TableCell>
                <TableCell align="right">Cash Deposits</TableCell>
                <TableCell align="right">Expenses</TableCell>
                <TableCell align="right">Closing</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(summary?.rows || []).map((row) => (
                <TableRow key={row.business_date}>
                  <TableCell>{row.business_date}</TableCell>
                  <TableCell align="right">{row.opening_total.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.sales_amount.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.sales_cash.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.sales_online.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.online_allocated.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.cash_deposits.toFixed(2)}</TableCell>
                  <TableCell align="right">{(row.cash_expenses + row.account_expenses).toFixed(2)}</TableCell>
                  <TableCell align="right">{row.closing_total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {!summary?.rows?.length && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No summary data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Entry Date
        </Typography>
        <TextField
          label="Business Date"
          type="date"
          size="small"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        {selectedSummaryDay && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">Sales: {selectedSummaryDay.sales_quantity.toFixed(2)} L | ₹{selectedSummaryDay.sales_amount.toFixed(2)}</Typography>
            <Typography variant="body2">Cash Sales: ₹{selectedSummaryDay.sales_cash.toFixed(2)} | Online Sales: ₹{selectedSummaryDay.sales_online.toFixed(2)}</Typography>
            <Typography variant="body2">Online Unallocated: ₹{selectedSummaryDay.online_unallocated.toFixed(2)}</Typography>
          </Box>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', mb: 3 }}>
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Cash Adjustments</Typography>
            <IconButton size="small" onClick={() => setCashAdjDialog(true)}>
              <Add fontSize="small" />
            </IconButton>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Amount</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cashAdjustments.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{Number(row.amount).toFixed(2)}</TableCell>
                  <TableCell>{row.remarks || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => handleDelete('/financial/cash-adjustments', row.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!cashAdjustments.length && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    No adjustments.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Online Allocations</Typography>
            <IconButton size="small" onClick={() => setAllocationDialog(true)}>
              <Add fontSize="small" />
            </IconButton>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {onlineAllocations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{accounts.find((a) => a.id === row.account_id)?.account_name || '-'}</TableCell>
                  <TableCell>{Number(row.amount).toFixed(2)}</TableCell>
                  <TableCell>{row.remarks || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => handleDelete('/financial/online-allocations', row.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!onlineAllocations.length && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No allocations.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Cash Deposits</Typography>
            <IconButton size="small" onClick={() => setDepositDialog(true)}>
              <Add fontSize="small" />
            </IconButton>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cashDeposits.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{accounts.find((a) => a.id === row.account_id)?.account_name || '-'}</TableCell>
                  <TableCell>{Number(row.amount).toFixed(2)}</TableCell>
                  <TableCell>{row.remarks || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => handleDelete('/financial/cash-deposits', row.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!cashDeposits.length && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No deposits.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Expenses</Typography>
            <IconButton size="small" onClick={() => setExpenseDialog(true)}>
              <Add fontSize="small" />
            </IconButton>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Paid From</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{categories.find((c) => c.id === row.category_id)?.category_name || '-'}</TableCell>
                  <TableCell>{row.paid_from}</TableCell>
                  <TableCell>{Number(row.amount).toFixed(2)}</TableCell>
                  <TableCell>{row.remarks || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => handleDelete('/financial/expenses', row.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!expenses.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No expenses.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">Expense Categories</Typography>
          <IconButton size="small" onClick={() => setCategoryDialog(true)}>
            <Add fontSize="small" />
          </IconButton>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>{cat.category_name}</TableCell>
                <TableCell>{cat.is_active ? 'Yes' : 'No'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => handleDelete('/financial/expense-categories', cat.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!categories.length && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  No categories.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={cashAdjDialog} onClose={() => setCashAdjDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Cash Adjustment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Amount"
            type="number"
            value={cashAdjForm.amount}
            onChange={(e) => setCashAdjForm({ ...cashAdjForm, amount: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Remarks"
            value={cashAdjForm.remarks}
            onChange={(e) => setCashAdjForm({ ...cashAdjForm, remarks: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCashAdjDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCashAdjustment}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={allocationDialog} onClose={() => setAllocationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Online Allocation</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Account"
            select
            value={allocationForm.account_id}
            onChange={(e) => setAllocationForm({ ...allocationForm, account_id: e.target.value })}
          >
            {accounts.map((acct) => (
              <MenuItem key={acct.id} value={acct.id}>
                {acct.account_name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            label="Amount"
            type="number"
            value={allocationForm.amount}
            onChange={(e) => setAllocationForm({ ...allocationForm, amount: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Remarks"
            value={allocationForm.remarks}
            onChange={(e) => setAllocationForm({ ...allocationForm, remarks: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllocationDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddAllocation}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={depositDialog} onClose={() => setDepositDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Cash Deposit</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Account"
            select
            value={depositForm.account_id}
            onChange={(e) => setDepositForm({ ...depositForm, account_id: e.target.value })}
          >
            {accounts.map((acct) => (
              <MenuItem key={acct.id} value={acct.id}>
                {acct.account_name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            label="Amount"
            type="number"
            value={depositForm.amount}
            onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Remarks"
            value={depositForm.remarks}
            onChange={(e) => setDepositForm({ ...depositForm, remarks: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddDeposit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={expenseDialog} onClose={() => setExpenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Expense</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Category"
            select
            value={expenseForm.category_id}
            onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
          >
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.category_name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            label="Paid From"
            select
            value={expenseForm.paid_from}
            onChange={(e) => setExpenseForm({ ...expenseForm, paid_from: e.target.value })}
          >
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="account">Account</MenuItem>
          </TextField>
          {expenseForm.paid_from === 'account' && (
            <TextField
              fullWidth
              margin="normal"
              label="Account"
              select
              value={expenseForm.account_id}
              onChange={(e) => setExpenseForm({ ...expenseForm, account_id: e.target.value })}
            >
              {accounts.map((acct) => (
                <MenuItem key={acct.id} value={acct.id}>
                  {acct.account_name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Amount"
            type="number"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Remarks"
            value={expenseForm.remarks}
            onChange={(e) => setExpenseForm({ ...expenseForm, remarks: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpenseDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddExpense}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Expense Category</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Category Name"
            value={categoryForm.category_name}
            onChange={(e) => setCategoryForm({ category_name: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCategory}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default FinancialManagement
