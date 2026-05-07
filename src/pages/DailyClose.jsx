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
import { Add } from '@mui/icons-material'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { exportRowsToCSV, exportRowsToPDF, exportRowsToXLSX } from '../utils/exporting'

function DailyClose() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => ['admin', 'manager', 'operator'].includes(role), [role])

  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState({
    business_date_from: '',
    business_date_to: '',
  })
  const [form, setForm] = useState({
    business_date: new Date().toISOString().slice(0, 10),
    opening_cash: '',
    closing_cash: '',
    notes: '',
  })

  const fetchRows = async (activeFilters) => {
    try {
      const f = activeFilters || {}
      const params = {}
      if (f.business_date_from) params.business_date_from = f.business_date_from
      if (f.business_date_to) params.business_date_to = f.business_date_to

      const res = await api.get('/daily-close/', { params })
      setRows(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load daily close records')
    }
  }

  useEffect(() => {
    if (canManage) fetchRows()
  }, [canManage])

  const exportRows = useMemo(() => {
    return rows.map((r) => ({
      Date: r.business_date,
      'Opening Cash': Number(r.opening_cash).toFixed(2),
      'Closing Cash': Number(r.closing_cash).toFixed(2),
      Notes: r.notes || '-',
      Created: r.created_at ? new Date(r.created_at).toLocaleString() : '',
    }))
  }, [rows])

  const handleCreate = async () => {
    setError('')
    try {
      await api.post('/daily-close/', {
        business_date: form.business_date,
        opening_cash: parseFloat(form.opening_cash || 0),
        closing_cash: parseFloat(form.closing_cash || 0),
        notes: form.notes || null,
      })
      setOpen(false)
      setForm({
        business_date: new Date().toISOString().slice(0, 10),
        opening_cash: '',
        closing_cash: '',
        notes: '',
      })
      fetchRows()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create daily close')
    }
  }

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Daily Close
        </Typography>
        <Alert severity="info">Only authorized users can access Daily Close.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Daily Close
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

          <Button variant="contained" onClick={() => fetchRows(filters)}>
            Apply
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              const cleared = { business_date_from: '', business_date_to: '' }
              setFilters(cleared)
              fetchRows(cleared)
            }}
          >
            Clear
          </Button>
          <Button
            variant="text"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10)
              const next = { ...filters, business_date_from: today, business_date_to: today }
              setFilters(next)
              fetchRows(next)
            }}
          >
            Today
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="outlined"
            onClick={() => exportRowsToCSV(exportRows, { filename: `daily_close.csv` })}
            disabled={!exportRows.length}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            onClick={() => exportRowsToXLSX(exportRows, { filename: `daily_close.xlsx`, sheetName: 'DailyClose' })}
            disabled={!exportRows.length}
          >
            Export XLSX
          </Button>
          <Button
            variant="outlined"
            onClick={() => exportRowsToPDF(exportRows, { filename: `daily_close.pdf`, title: 'Daily Close' })}
            disabled={!exportRows.length}
          >
            Export PDF
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
          New Daily Close
        </Button>
        <Button variant="outlined" onClick={() => fetchRows(filters)}>
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Opening Cash</TableCell>
              <TableCell align="right">Closing Cash</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.business_date}</TableCell>
                <TableCell align="right">{Number(r.opening_cash).toFixed(2)}</TableCell>
                <TableCell align="right">{Number(r.closing_cash).toFixed(2)}</TableCell>
                <TableCell>{r.notes || '-'}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Daily Close</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            type="date"
            label="Business Date"
            value={form.business_date}
            onChange={(e) => setForm({ ...form, business_date: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            type="number"
            label="Opening Cash"
            value={form.opening_cash}
            onChange={(e) => setForm({ ...form, opening_cash: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            type="number"
            label="Closing Cash"
            value={form.closing_cash}
            onChange={(e) => setForm({ ...form, closing_cash: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            margin="normal"
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default DailyClose
