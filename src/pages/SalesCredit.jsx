import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useToast } from '../context/ToastContext'

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function SalesCredit() {
  const toast = useToast()
  const [credits, setCredits] = useState([])
  const [dispensers, setDispensers] = useState([])
  const [employees, setEmployees] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [filters, setFilters] = useState({
    business_date_from: todayISO(),
    business_date_to: todayISO(),
    status: 'pending',
    dispenser_id: '',
    operator_employee_id: '',
  })

  const [settleDialogOpen, setSettleDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [settleDate, setSettleDate] = useState(todayISO())
  const [settleNotes, setSettleNotes] = useState('')
  const [settleBusy, setSettleBusy] = useState(false)

  const operatorName = (employeeId) => {
    const e = employees.find((x) => String(x.id) === String(employeeId))
    return e?.employee_name || (employeeId ?? '-')
  }

  const dispenserName = (dispenserId) => {
    const d = dispensers.find((x) => String(x.id) === String(dispenserId))
    return d?.dispenser_number || dispenserId || '-'
  }

  const fetchCredits = async (activeFilters) => {
    setError('')
    setLoading(true)
    try {
      const f = activeFilters || filters
      const params = {}
      if (f.business_date_from) params.business_date_from = f.business_date_from
      if (f.business_date_to) params.business_date_to = f.business_date_to
      if (f.dispenser_id) params.dispenser_id = Number(f.dispenser_id)
      if (f.operator_employee_id) params.operator_employee_id = Number(f.operator_employee_id)
      if (f.status && f.status !== 'all') params.status = f.status

      const res = await api.get('/sales/credits', { params })
      setCredits(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load credit entries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [dispRes, empRes] = await Promise.all([
          api.get('/dispensers/'),
          api.get('/employees/'),
        ])
        setDispensers((dispRes.data || []).filter((d) => d.is_active))
        setEmployees((empRes.data || []).filter((e) => e.is_active))
      } catch {
        setDispensers([])
        setEmployees([])
      }
    }
    loadLookups()
    fetchCredits(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = useMemo(() => {
    const pending = credits.filter((c) => String(c.credit_status || 'pending') === 'pending')
    const settled = credits.filter((c) => String(c.credit_status || 'pending') === 'settled')

    const totalCredit = credits.reduce((sum, c) => sum + Number(c.deposit_credit || 0), 0)
    const pendingCredit = pending.reduce((sum, c) => sum + Number(c.deposit_credit || 0), 0)
    const settledCredit = settled.reduce((sum, c) => sum + Number(c.deposit_credit || 0), 0)

    return { totalCredit, pendingCredit, settledCredit }
  }, [credits])

  const openSettleDialog = (entry) => {
    setSelectedEntry(entry)
    setSettleDate(todayISO())
    setSettleNotes(entry?.credit_notes || '')
    setSettleDialogOpen(true)
  }

  const submitSettle = async () => {
    if (!selectedEntry) return
    setSettleBusy(true)
    setError('')
    try {
      const settledAt = settleDate ? new Date(`${settleDate}T00:00:00`).toISOString() : null
      await api.put(`/sales/credits/${selectedEntry.id}`, {
        credit_status: 'settled',
        credit_settled_at: settledAt,
        credit_notes: settleNotes || null,
      })
      toast.showSuccess('Credit marked as settled')
      setSettleDialogOpen(false)
      setSelectedEntry(null)
      fetchCredits(filters)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update credit status')
    } finally {
      setSettleBusy(false)
    }
  }

  const reopenCredit = async (entry) => {
    if (!entry) return
    if (!window.confirm(`Reopen credit entry "${entry.batch_code}"?`)) return
    setError('')
    try {
      await api.put(`/sales/credits/${entry.id}`, {
        credit_status: 'pending',
      })
      toast.showSuccess('Credit entry reopened')
      fetchCredits(filters)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to reopen credit entry')
    }
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Sales on Credit
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="From"
            type="date"
            value={filters.business_date_from}
            onChange={(e) => setFilters({ ...filters, business_date_from: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="To"
            type="date"
            value={filters.business_date_to}
            onChange={(e) => setFilters({ ...filters, business_date_to: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="settled">Settled</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </TextField>
          <TextField
            select
            label="Dispenser"
            value={filters.dispenser_id}
            onChange={(e) => setFilters({ ...filters, dispenser_id: e.target.value })}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All</MenuItem>
            {dispensers
              .slice()
              .sort((a, b) => String(a.dispenser_number).localeCompare(String(b.dispenser_number)))
              .map((d) => (
                <MenuItem key={d.id} value={String(d.id)}>
                  {d.dispenser_number}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            label="Operator"
            value={filters.operator_employee_id}
            onChange={(e) => setFilters({ ...filters, operator_employee_id: e.target.value })}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">All</MenuItem>
            {employees
              .slice()
              .sort((a, b) => String(a.employee_name).localeCompare(String(b.employee_name)))
              .map((emp) => (
                <MenuItem key={emp.id} value={String(emp.id)}>
                  {emp.employee_name}
                </MenuItem>
              ))}
          </TextField>
          <Button variant="contained" onClick={() => fetchCredits(filters)} disabled={loading}>
            Apply
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              const next = {
                business_date_from: todayISO(),
                business_date_to: todayISO(),
                status: 'pending',
                dispenser_id: '',
                operator_employee_id: '',
              }
              setFilters(next)
              fetchCredits(next)
            }}
            disabled={loading}
          >
            Today
          </Button>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Credit Summary
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Typography>Total Credit: Rs {totals.totalCredit.toFixed(2)}</Typography>
          <Typography>Pending Credit: Rs {totals.pendingCredit.toFixed(2)}</Typography>
          <Typography>Settled Credit: Rs {totals.settledCredit.toFixed(2)}</Typography>
          <Typography>Entries: {credits.length}</Typography>
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
              <TableCell>Date</TableCell>
              <TableCell>Shift</TableCell>
              <TableCell>Dispenser</TableCell>
              <TableCell>Operator</TableCell>
              <TableCell align="right">Credit Amount (Rs)</TableCell>
              <TableCell align="right">Deposit Cash (Rs)</TableCell>
              <TableCell align="right">Deposit Online (Rs)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Settled At</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {credits.map((entry) => {
              const status = String(entry.credit_status || 'pending')
              return (
                <TableRow key={entry.id}>
                  <TableCell>{entry.business_date}</TableCell>
                  <TableCell>{entry.shift}</TableCell>
                  <TableCell>{dispenserName(entry.dispenser_id)}</TableCell>
                  <TableCell>{operatorName(entry.operator_employee_id)}</TableCell>
                  <TableCell align="right">Rs {Number(entry.deposit_credit || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">Rs {Number(entry.deposit_cash || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">Rs {Number(entry.deposit_online || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={status === 'settled' ? 'Settled' : 'Pending'}
                      color={status === 'settled' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell>
                    {entry.credit_settled_at ? new Date(entry.credit_settled_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>{entry.credit_notes || entry.remarks || '-'}</TableCell>
                  <TableCell align="right">
                    {status === 'settled' ? (
                      <Button size="small" onClick={() => reopenCredit(entry)}>
                        Reopen
                      </Button>
                    ) : (
                      <Button size="small" variant="contained" onClick={() => openSettleDialog(entry)}>
                        Mark Settled
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {!credits.length && !loading && (
              <TableRow>
                <TableCell colSpan={11}>
                  <Alert severity="info">No credit entries found for the selected range.</Alert>
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={11}>
                  <Alert severity="info">Loading...</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={settleDialogOpen}
        onClose={() => {
          if (settleBusy) return
          setSettleDialogOpen(false)
          setSelectedEntry(null)
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Mark Credit as Settled</DialogTitle>
        <DialogContent>
          <TextField
            label="Settled Date"
            type="date"
            value={settleDate}
            onChange={(e) => setSettleDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Notes"
            value={settleNotes}
            onChange={(e) => setSettleNotes(e.target.value)}
            margin="normal"
            fullWidth
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettleDialogOpen(false)} disabled={settleBusy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitSettle} disabled={settleBusy || !selectedEntry}>
            {settleBusy ? 'Saving...' : 'Mark Settled'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default SalesCredit
