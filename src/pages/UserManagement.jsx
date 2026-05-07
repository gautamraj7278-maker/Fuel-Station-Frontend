import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Add, LockReset } from '@mui/icons-material'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const roleOptions = [
  { value: 'operator', label: 'Operator' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
]

const accessLabel = (role) => {
  const normalized = role === 'cashier' ? 'operator' : role
  if (normalized === 'admin') return 'Sales & Ops, Config, Finance'
  return 'Sales & Ops'
}

function UserManagement() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'operator',
    is_active: true,
    password: '',
  })

  const [resetOpen, setResetOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => Number(b.id) - Number(a.id))
  }, [rows])

  const fetchUsers = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.get('/users/')
      setRows(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({
      username: '',
      email: '',
      full_name: '',
      role: 'operator',
      is_active: true,
      password: '',
    })
    setOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      username: row.username || '',
      email: row.email || '',
      full_name: row.full_name || '',
      role: row.role === 'cashier' ? 'operator' : row.role || 'operator',
      is_active: !!row.is_active,
      password: '',
    })
    setOpen(true)
  }

  const handleSave = async () => {
    setError('')
    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      full_name: form.full_name.trim() || null,
      role: form.role,
      is_active: !!form.is_active,
    }
    if (!payload.username || !payload.email) {
      setError('Username and email are required')
      return
    }

    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, payload, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('User updated')
      } else {
        if (!form.password) {
          setError('Password is required for new users')
          return
        }
        await api.post(
          '/users/',
          { ...payload, password: form.password },
          { headers: { 'X-Suppress-Toast': '1' } }
        )
        toast.showSuccess('User created')
      }
      setOpen(false)
      setEditing(null)
      await fetchUsers()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save user')
    }
  }

  const toggleActive = async (row, nextActive) => {
    setError('')
    try {
      await api.put(`/users/${row.id}`, { is_active: nextActive }, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess(nextActive ? 'User activated' : 'User deactivated')
      await fetchUsers()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update user status')
    }
  }

  const deactivateUser = async (row) => {
    if (!window.confirm(`Deactivate user "${row.username}"?`)) return
    setError('')
    try {
      await api.delete(`/users/${row.id}`, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess('User deactivated')
      await fetchUsers()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to deactivate user')
    }
  }

  const openReset = (row) => {
    setResetTarget(row)
    setResetPassword('')
    setResetOpen(true)
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return
    if (!resetPassword) {
      setError('Password is required')
      return
    }
    setError('')
    try {
      await api.put(
        `/users/${resetTarget.id}/password`,
        { password: resetPassword },
        { headers: { 'X-Suppress-Toast': '1' } }
      )
      toast.showSuccess('Password reset')
      setResetOpen(false)
      setResetTarget(null)
      setResetPassword('')
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to reset password')
    }
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add User
        </Button>
        <Button variant="outlined" onClick={fetchUsers} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Full Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Access</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.username}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.full_name || '-'}</TableCell>
                <TableCell>{String(row.role || '').toUpperCase()}</TableCell>
                <TableCell>{accessLabel(row.role)}</TableCell>
                <TableCell>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={!!row.is_active}
                        onChange={(e) => toggleActive(row, e.target.checked)}
                      />
                    }
                    label={row.is_active ? 'Active' : 'Inactive'}
                  />
                </TableCell>
                <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                  <Button size="small" startIcon={<LockReset />} onClick={() => openReset(row)}>
                    Reset Password
                  </Button>
                  <Button size="small" color="error" onClick={() => deactivateUser(row)}>
                    Deactivate
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!sortedRows.length && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Alert severity="info">No users found.</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Full Name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <TextField
            select
            fullWidth
            margin="normal"
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roleOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={!!form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
            }
            label={form.is_active ? 'Active' : 'Inactive'}
          />
          {!editing && (
            <TextField
              fullWidth
              margin="normal"
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              helperText="6-72 characters. Avoid emojis/non-ASCII."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editing ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Reset password for {resetTarget?.username}
          </Typography>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            helperText="6-72 characters. Avoid emojis/non-ASCII."
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleResetPassword}>
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default UserManagement
