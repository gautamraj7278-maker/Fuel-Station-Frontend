import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import { Add, UploadFile } from '@mui/icons-material'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { downloadApiFile } from '../utils/downloadApiFile'

function Customers() {
  const { user } = useAuth()
  const toast = useToast()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])

  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', vehicle_number: '' })

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkMode, setBulkMode] = useState('upsert')
  const [bulkAllowPartial, setBulkAllowPartial] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkPreview, setBulkPreview] = useState(null)

  const fetchRows = async () => {
    setError('')
    try {
      const res = await api.get('/customers/')
      setRows(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load customers')
    }
  }

  useEffect(() => {
    fetchRows()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', phone: '', email: '', vehicle_number: '' })
    setOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      phone: row.phone || '',
      email: row.email || '',
      vehicle_number: row.vehicle_number || '',
    })
    setOpen(true)
  }

  const handleSave = async () => {
    setError('')
    try {
      const payload = {
        name: form.name?.trim(),
        phone: form.phone?.trim(),
        email: form.email?.trim() || null,
        vehicle_number: form.vehicle_number?.trim() || null,
      }

      if (!payload.name) {
        setError('Name is required')
        return
      }
      if (!payload.phone) {
        setError('Phone is required')
        return
      }

      if (editing) {
        await api.put(`/customers/${editing.id}`, payload, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Customer updated')
      } else {
        await api.post('/customers/', payload, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Customer created')
      }
      setOpen(false)
      setEditing(null)
      await fetchRows()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save customer')
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete customer "${row.name}"?`)) return
    setError('')
    try {
      await api.delete(`/customers/${row.id}`, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess('Customer deleted')
      await fetchRows()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete customer')
    }
  }

  const previewBulkUpload = async () => {
    if (!bulkFile) return
    setBulkBusy(true)
    setBulkError('')
    setBulkPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', bulkFile)
      const res = await api.post('/bulk/customers/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Suppress-Toast': '1' },
      })
      setBulkPreview(res.data)
    } catch (e) {
      const detail = e.response?.data?.detail
      setBulkError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to preview file'))
    } finally {
      setBulkBusy(false)
    }
  }

  const commitBulkUpload = async () => {
    if (!bulkPreview?.rows?.length) return
    if (!window.confirm('Commit this bulk upload to the database?')) return
    setBulkBusy(true)
    setBulkError('')
    try {
      const res = await api.post(
        '/bulk/customers/commit',
        { rows: bulkPreview.rows, mode: bulkMode, allow_partial: bulkAllowPartial },
        { headers: { 'X-Suppress-Toast': '1' } }
      )
      toast.showSuccess(`Bulk upload done: ${res.data?.inserted || 0} inserted, ${res.data?.updated || 0} updated.`)
      setBulkOpen(false)
      setBulkFile(null)
      setBulkPreview(null)
      await fetchRows()
    } catch (e) {
      const detail = e.response?.data?.detail
      if (typeof detail === 'string') {
        setBulkError(detail)
      } else {
        setBulkError(detail?.message || 'Failed to commit upload')
      }
    } finally {
      setBulkBusy(false)
    }
  }

  const downloadCustomersTemplate = async (format) => {
    setBulkError('')
    try {
      await downloadApiFile('/bulk/customers/template', {
        params: { format },
        defaultFilename: format === 'csv' ? 'customers_bulk_template.csv' : 'customers_bulk_template.xlsx',
      })
    } catch (e) {
      const detail = e.response?.data?.detail
      setBulkError(typeof detail === 'string' ? detail : 'Failed to download template')
    }
  }

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Customers
        </Typography>
        <Alert severity="info">Only Admin can manage customers.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Customers
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Customer
        </Button>
        <Button variant="outlined" startIcon={<UploadFile />} onClick={() => setBulkOpen(true)}>
          Bulk Upload
        </Button>
        <Button variant="outlined" onClick={fetchRows}>
          Refresh
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
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Vehicle No</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell>{r.email || ''}</TableCell>
                <TableCell>{r.vehicle_number || ''}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openEdit(r)}>
                    Edit
                  </Button>
                  <Button size="small" color="error" onClick={() => handleDelete(r)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Alert severity="info">No customers found.</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Email (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Vehicle Number (optional)"
            value={form.vehicle_number}
            onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => (bulkBusy ? null : setBulkOpen(false))} maxWidth="lg" fullWidth>
        <DialogTitle>Customers Bulk Upload (Single Sheet)</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upload a single-sheet CSV/XLSX. Upsert matches by customer_id when provided; otherwise by phone.
          </Alert>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Button variant="outlined" onClick={() => downloadCustomersTemplate('xlsx')} disabled={bulkBusy}>
              Download XLSX Template
            </Button>
            <Button variant="outlined" onClick={() => downloadCustomersTemplate('csv')} disabled={bulkBusy}>
              Download CSV Template
            </Button>

            <TextField
              select
              size="small"
              label="Mode"
              value={bulkMode}
              onChange={(e) => setBulkMode(e.target.value)}
              sx={{ minWidth: 180 }}
              disabled={bulkBusy}
            >
              <MenuItem value="upsert">Upsert (by customer_id, else phone)</MenuItem>
              <MenuItem value="insert_only">Insert only</MenuItem>
              <MenuItem value="update_only">Update only (requires customer_id or existing phone)</MenuItem>
            </TextField>

            <FormControlLabel
              control={<Checkbox checked={bulkAllowPartial} onChange={(e) => setBulkAllowPartial(e.target.checked)} />}
              label="Allow partial commit"
            />

            <Button component="label" variant="contained" disabled={bulkBusy}>
              Choose File
              <input
                type="file"
                hidden
                accept=".csv,.xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  setBulkFile(f)
                  setBulkPreview(null)
                  setBulkError('')
                }}
              />
            </Button>
            <Typography variant="body2" color="text.secondary">
              {bulkFile ? bulkFile.name : 'No file selected'}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" onClick={previewBulkUpload} disabled={bulkBusy || !bulkFile}>
              Preview
            </Button>
          </Box>

          {bulkError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {bulkError}
            </Alert>
          )}

          {bulkPreview && (
            <Box sx={{ mb: 2 }}>
              <Alert severity={bulkPreview.errors?.length ? 'warning' : 'success'} sx={{ mb: 2 }}>
                Rows: {bulkPreview.valid_rows || 0} valid / {bulkPreview.total_rows || 0} total.
                {bulkPreview.errors?.length ? ' Fix errors and re-upload (or allow partial).' : ' Ready to upload.'}
              </Alert>

              {!!bulkPreview.errors?.length && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Errors (first 20)</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Row</TableCell>
                          <TableCell>Message</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bulkPreview.errors.slice(0, 20).map((er, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{er.row}</TableCell>
                            <TableCell>{er.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Preview (showing first {Math.min(50, bulkPreview.rows?.length || 0)} of {bulkPreview.rows?.length || 0} valid rows)
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Vehicle No</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(bulkPreview.rows || []).slice(0, 50).map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{r.customer_id || ''}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.phone}</TableCell>
                        <TableCell>{r.email || ''}</TableCell>
                        <TableCell>{r.vehicle_number || ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)} disabled={bulkBusy}>
            Close
          </Button>
          <Button variant="contained" onClick={commitBulkUpload} disabled={bulkBusy || !bulkPreview?.rows?.length}>
            {bulkBusy ? 'Uploading…' : 'Commit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Customers
