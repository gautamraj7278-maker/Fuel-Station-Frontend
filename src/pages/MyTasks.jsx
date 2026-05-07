import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
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
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function formatAmount(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toFixed(2) : '0.00'
}

function MyTasks() {
  const { user } = useAuth()
  const toast = useToast()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const isAdmin = role === 'admin'

  const [tasks, setTasks] = useState([])
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [busyId, setBusyId] = useState(null)

  const fetchTasks = async () => {
    setError('')
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/tasks/deletion-requests', { params })
      setTasks(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load tasks')
    }
  }

  useEffect(() => {
    if (isAdmin) fetchTasks()
  }, [isAdmin, statusFilter])

  const approveTask = async (task) => {
    if (busyId) return
    if (!window.confirm(`Approve deletion for ${task.target_label || `#${task.target_id}`}?`)) return
    const comment = window.prompt('Optional: add approval note', '')
    setBusyId(task.id)
    setError('')
    try {
      await api.post(
        `/tasks/deletion-requests/${task.id}/approve`,
        { comment: comment === '' ? null : comment },
        { headers: { 'X-Suppress-Toast': '1' } }
      )
      toast.showSuccess('Deletion approved')
      fetchTasks()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to approve deletion')
    } finally {
      setBusyId(null)
    }
  }

  const rejectTask = async (task) => {
    if (busyId) return
    if (!window.confirm(`Reject deletion for ${task.target_label || `#${task.target_id}`}?`)) return
    const comment = window.prompt('Optional: add rejection note', '')
    setBusyId(task.id)
    setError('')
    try {
      await api.post(
        `/tasks/deletion-requests/${task.id}/reject`,
        { comment: comment === '' ? null : comment },
        { headers: { 'X-Suppress-Toast': '1' } }
      )
      toast.showInfo('Deletion request rejected')
      fetchTasks()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to reject deletion')
    } finally {
      setBusyId(null)
    }
  }

  const renderTarget = (task) => {
    const meta = task.target_meta || {}
    if (task.target_type === 'sale') {
      return (
        <Box>
          <Typography variant="subtitle2">{task.target_label || `Sale #${task.target_id}`}</Typography>
          <Typography variant="caption" color="text.secondary">
            {meta.business_date ? `Date ${meta.business_date}` : 'Date -'} | Qty {formatAmount(meta.quantity)} | Total INR {formatAmount(meta.total_amount)}
          </Typography>
        </Box>
      )
    }
    if (task.target_type === 'tanker_receipt') {
      return (
        <Box>
          <Typography variant="subtitle2">{task.target_label || `Receipt #${task.target_id}`}</Typography>
          <Typography variant="caption" color="text.secondary">
            {meta.receipt_date ? `Date ${meta.receipt_date}` : 'Date -'} | Tanker {meta.tanker_no || '-'} | Status {meta.status || '-'}
          </Typography>
        </Box>
      )
    }
    return <Typography variant="body2">{task.target_label || `#${task.target_id}`}</Typography>
  }

  if (!isAdmin) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          My Tasks
        </Typography>
        <Alert severity="info">Only Admin can review deletion approvals.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        My Tasks
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <Button variant="outlined" onClick={fetchTasks}>
            Refresh
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Requested At</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Requested By</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>{task.requested_at ? new Date(task.requested_at).toLocaleString() : '-'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={
                      task.target_type === 'tanker_receipt'
                        ? 'Tanker Receipt'
                        : task.target_type === 'sale'
                          ? 'Sale'
                          : String(task.target_type || 'Item')
                    }
                  />
                </TableCell>
                <TableCell>{renderTarget(task)}</TableCell>
                <TableCell>{task.requested_by_username || task.requested_by_user_id}</TableCell>
                <TableCell>{task.reason || '-'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={task.status}
                    color={task.status === 'approved' ? 'success' : task.status === 'rejected' ? 'error' : 'warning'}
                    variant={task.status === 'pending' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  {task.status === 'pending' ? (
                    <>
                      <Button size="small" variant="outlined" onClick={() => approveTask(task)} disabled={busyId === task.id}>
                        Approve
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => rejectTask(task)}
                        disabled={busyId === task.id}
                        sx={{ ml: 1 }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!tasks.length && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Alert severity="info">No deletion tasks found.</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  )
}

export default MyTasks
