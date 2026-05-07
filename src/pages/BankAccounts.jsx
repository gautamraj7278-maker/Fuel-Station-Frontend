import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
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
import { Add, Delete, Edit } from '@mui/icons-material'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function BankAccounts() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    account_name: '',
    bank_name: '',
    account_number: '',
    starting_balance: '',
    is_active: true,
  })

  const fetchAccounts = async () => {
    setError('')
    try {
      const res = await api.get('/financial/bank-accounts')
      setAccounts(res.data || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch bank accounts')
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    fetchAccounts()
  }, [isAdmin])

  const openDialog = (account) => {
    if (account) {
      setEditing(account)
      setForm({
        account_name: account.account_name || '',
        bank_name: account.bank_name || '',
        account_number: account.account_number || '',
        starting_balance: String(account.starting_balance ?? ''),
        is_active: account.is_active !== false,
      })
    } else {
      setEditing(null)
      setForm({
        account_name: '',
        bank_name: '',
        account_number: '',
        starting_balance: '',
        is_active: true,
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setError('')
    try {
      const payload = {
        account_name: form.account_name.trim(),
        bank_name: form.bank_name.trim() || null,
        account_number: form.account_number.trim() || null,
        starting_balance: parseFloat(form.starting_balance || 0),
        is_active: !!form.is_active,
      }
      if (editing) {
        await api.put(`/financial/bank-accounts/${editing.id}`, payload)
      } else {
        await api.post('/financial/bank-accounts', payload)
      }
      setDialogOpen(false)
      await fetchAccounts()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save bank account')
    }
  }

  const handleDelete = async (account) => {
    if (!window.confirm(`Delete account "${account.account_name}"?`)) return
    setError('')
    try {
      await api.delete(`/financial/bank-accounts/${account.id}`)
      await fetchAccounts()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete bank account')
    }
  }

  if (!isAdmin) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Bank Accounts
        </Typography>
        <Alert severity="info">Only Admin can manage bank accounts.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Bank Accounts</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => openDialog(null)}>
          Add Account
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Account Name</TableCell>
              <TableCell>Bank</TableCell>
              <TableCell>Account Number</TableCell>
              <TableCell align="right">Starting Balance</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>{account.account_name}</TableCell>
                <TableCell>{account.bank_name || '-'}</TableCell>
                <TableCell>{account.account_number || '-'}</TableCell>
                <TableCell align="right">{Number(account.starting_balance || 0).toFixed(2)}</TableCell>
                <TableCell>{account.is_active ? 'Yes' : 'No'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openDialog(account)}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(account)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!accounts.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No bank accounts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Account Name"
            value={form.account_name}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Bank Name"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Account Number"
            value={form.account_number}
            onChange={(e) => setForm({ ...form, account_number: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Starting Balance"
            type="number"
            value={form.starting_balance}
            onChange={(e) => setForm({ ...form, starting_balance: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Active"
            select
            value={form.is_active ? 'yes' : 'no'}
            onChange={(e) => setForm({ ...form, is_active: e.target.value === 'yes' })}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default BankAccounts
