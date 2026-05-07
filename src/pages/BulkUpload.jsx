import React, { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material'
import { UploadFile } from '@mui/icons-material'
import api from '../services/api'
import { downloadApiFile } from '../utils/downloadApiFile'
import { useToast } from '../context/ToastContext'

const MODULES = [
  {
    key: 'products',
    label: 'Products',
    template: '/bulk/products/template',
    preview: '/bulk/products/preview',
    commit: '/bulk/products/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'product-prices',
    label: 'Product Prices',
    template: '/bulk/product-prices/template',
    preview: '/bulk/product-prices/preview',
    commit: '/bulk/product-prices/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'dispensers',
    label: 'Dispensers',
    template: '/bulk/dispensers/template',
    preview: '/bulk/dispensers/preview',
    commit: '/bulk/dispensers/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'tanks',
    label: 'Tanks',
    template: '/bulk/tanks/template',
    preview: '/bulk/tanks/preview',
    commit: '/bulk/tanks/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'nozzles',
    label: 'Nozzles',
    template: '/bulk/nozzles/template',
    preview: '/bulk/nozzles/preview',
    commit: '/bulk/nozzles/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'meters',
    label: 'Meters',
    template: '/bulk/meters/template',
    preview: '/bulk/meters/preview',
    commit: '/bulk/meters/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'employees',
    label: 'Employees',
    template: '/bulk/employees/template',
    preview: '/bulk/employees/preview',
    commit: '/bulk/employees/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'designations',
    label: 'Designations',
    template: '/bulk/designations/template',
    preview: '/bulk/designations/preview',
    commit: '/bulk/designations/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'shifts',
    label: 'Shifts',
    template: '/bulk/shifts/template',
    preview: '/bulk/shifts/preview',
    commit: '/bulk/shifts/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'customers',
    label: 'Customers',
    template: '/bulk/customers/template',
    preview: '/bulk/customers/preview',
    commit: '/bulk/customers/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'sales',
    label: 'Sales & Testing',
    template: '/bulk/sales/template',
    preview: '/bulk/sales/preview',
    commit: '/bulk/sales/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'tanker-receipts',
    label: 'Tanker Receipts',
    template: '/bulk/tanker-receipts/template',
    preview: '/bulk/tanker-receipts/preview',
    commit: '/bulk/tanker-receipts/commit',
    formats: ['xlsx'],
    customPreview: true,
  },
  {
    key: 'tank-dips',
    label: 'Tank Dips',
    template: '/bulk/tank-dips/template',
    preview: '/bulk/tank-dips/preview',
    commit: '/bulk/tank-dips/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'tank-calibration-points',
    label: 'Tank Calibration Points',
    template: '/bulk/tank-calibration-points/template',
    preview: '/bulk/tank-calibration-points/preview',
    commit: '/bulk/tank-calibration-points/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'fuel-inventory',
    label: 'Fuel Inventory',
    template: '/bulk/fuel-inventory/template',
    preview: '/bulk/fuel-inventory/preview',
    commit: '/bulk/fuel-inventory/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'tank-transfers',
    label: 'Tank Transfers',
    template: '/bulk/tank-transfers/template',
    preview: '/bulk/tank-transfers/preview',
    commit: '/bulk/tank-transfers/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'dispenser-shift-assignments',
    label: 'Dispenser Shift Assignments',
    template: '/bulk/dispenser-shift-assignments/template',
    preview: '/bulk/dispenser-shift-assignments/preview',
    commit: '/bulk/dispenser-shift-assignments/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'daily-closes',
    label: 'Daily Closes',
    template: '/bulk/daily-closes/template',
    preview: '/bulk/daily-closes/preview',
    commit: '/bulk/daily-closes/commit',
    formats: ['xlsx', 'csv'],
  },
  {
    key: 'users',
    label: 'Users',
    template: '/bulk/users/template',
    preview: '/bulk/users/preview',
    commit: '/bulk/users/commit',
    formats: ['xlsx', 'csv'],
  },
]

const DELETED_MODULES = [
  { key: 'products', label: 'Products', path: '/products' },
  { key: 'dispensers', label: 'Dispensers', path: '/dispensers' },
  { key: 'nozzles', label: 'Nozzles', path: '/nozzles' },
  { key: 'meters', label: 'Meters', path: '/meters' },
  { key: 'tanks', label: 'Tanks', path: '/tanks' },
  { key: 'employees', label: 'Employees', path: '/employees' },
  { key: 'designations', label: 'Designations', path: '/designations' },
  { key: 'customers', label: 'Customers', path: '/customers' },
  { key: 'sales', label: 'Sales', path: '/sales' },
  { key: 'tanker-receipts', label: 'Tanker Receipts', path: '/tanker-receipts' },
]

const steps = ['Download Template', 'Upload File', 'Preview', 'Commit']

function BulkUpload() {
  const toast = useToast()
  const [tab, setTab] = useState(0)
  const [moduleKey, setModuleKey] = useState(MODULES[0].key)
  const [deletedKey, setDeletedKey] = useState(DELETED_MODULES[0].key)

  const [activeStep, setActiveStep] = useState(0)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('upsert')
  const [allowPartial, setAllowPartial] = useState(false)
  const [confirmReceipts, setConfirmReceipts] = useState(false)
  const [commitOpen, setCommitOpen] = useState(false)

  const [deletedRows, setDeletedRows] = useState([])
  const [deletedBusy, setDeletedBusy] = useState(false)
  const [deletedError, setDeletedError] = useState('')

  const module = useMemo(() => MODULES.find((m) => m.key === moduleKey), [moduleKey])
  const deletedModule = useMemo(() => DELETED_MODULES.find((m) => m.key === deletedKey), [deletedKey])

  const resetWizard = () => {
    setActiveStep(0)
    setFile(null)
    setPreview(null)
    setError('')
    setMode('upsert')
    setAllowPartial(false)
    setConfirmReceipts(false)
    setCommitOpen(false)
  }

  const downloadTemplate = async (format) => {
    setError('')
    try {
      await downloadApiFile(module.template, {
        params: format ? { format } : undefined,
        defaultFilename: `${module.key.replace('/', '_')}_bulk_template.${format || 'xlsx'}`,
      })
    } catch (e) {
      const detail = e.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to download template')
    }
  }

  const previewUpload = async () => {
    if (!file) {
      setError('Please choose a CSV or XLSX file')
      return
    }
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post(module.preview, form, { headers: { 'X-Suppress-Toast': '1' } })
      setPreview(res.data)
      setActiveStep(2)
    } catch (e) {
      const detail = e.response?.data?.detail
      setError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to preview upload')
    } finally {
      setBusy(false)
    }
  }

  const commitUpload = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      if (module.customPreview) {
        const res = await api.post(module.commit, { receipts: preview.receipts || [] }, { params: { confirm: confirmReceipts } })
        toast.showSuccess(`Bulk upload done: ${res.data?.inserted || 0} inserted, ${res.data?.updated || 0} updated.`)
      } else {
        const res = await api.post(
          module.commit,
          { rows: preview.rows || [], mode, allow_partial: allowPartial },
          { headers: { 'X-Suppress-Toast': '1' } }
        )
        toast.showSuccess(`Bulk upload done: ${res.data?.inserted || 0} inserted, ${res.data?.updated || 0} updated.`)
      }
      resetWizard()
      setCommitOpen(false)
    } catch (e) {
      const detail = e.response?.data?.detail
      setError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to commit upload')
    } finally {
      setBusy(false)
    }
  }

  const loadDeleted = async () => {
    if (!deletedModule) return
    setDeletedBusy(true)
    setDeletedError('')
    try {
      const res = await api.get(`${deletedModule.path}/deleted`)
      setDeletedRows(res.data || [])
    } catch (e) {
      setDeletedError(e.response?.data?.detail || 'Failed to load deleted records')
    } finally {
      setDeletedBusy(false)
    }
  }

  const restoreDeleted = async (row) => {
    if (!deletedModule) return
    setDeletedBusy(true)
    setDeletedError('')
    try {
      await api.post(`${deletedModule.path}/deleted/${row.id}/restore`)
      toast.showSuccess('Record restored.')
      await loadDeleted()
    } catch (e) {
      setDeletedError(e.response?.data?.detail || 'Failed to restore record')
    } finally {
      setDeletedBusy(false)
    }
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Bulk Upload Center
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Tabs value={tab} onChange={(e, next) => setTab(next)}>
          <Tab label="Bulk Upload Wizard" />
          <Tab label="Restore Deleted Records" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <TextField
              select
              label="Module"
              value={moduleKey}
              onChange={(e) => {
                setModuleKey(e.target.value)
                resetWizard()
              }}
              sx={{ minWidth: 260 }}
            >
              {MODULES.map((m) => (
                <MenuItem key={m.key} value={m.key}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>

            {!module?.customPreview && (
              <TextField select label="Mode" value={mode} onChange={(e) => setMode(e.target.value)} sx={{ minWidth: 200 }}>
                <MenuItem value="upsert">Upsert</MenuItem>
                <MenuItem value="insert_only">Insert only</MenuItem>
                <MenuItem value="update_only">Update only</MenuItem>
              </TextField>
            )}

            {!module?.customPreview && (
              <FormControlLabel
                control={<Switch checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />}
                label="Allow partial commit"
              />
            )}

            {module?.customPreview && (
              <FormControlLabel
                control={<Switch checked={confirmReceipts} onChange={(e) => setConfirmReceipts(e.target.checked)} />}
                label="Confirm receipts (apply stock updates)"
              />
            )}
          </Box>

          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            {(module?.formats || []).map((fmt) => (
              <Button key={fmt} variant="outlined" onClick={() => downloadTemplate(fmt)}>
                Download {fmt.toUpperCase()} Template
              </Button>
            ))}

            <Button component="label" variant="contained" startIcon={<UploadFile />} disabled={busy}>
              Choose File
              <input
                type="file"
                hidden
                accept=".csv,.xlsx"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null)
                  setPreview(null)
                  setActiveStep(1)
                }}
              />
            </Button>
            <Typography variant="body2" color="text.secondary">
              {file ? file.name : 'No file selected'}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" onClick={previewUpload} disabled={busy || !file}>
              Preview
            </Button>
          </Box>

          {preview && module?.customPreview && (
            <Box sx={{ mb: 2 }}>
              <Alert severity={preview.errors?.length ? 'warning' : 'success'} sx={{ mb: 2 }}>
                Receipts: {preview.valid_receipts || 0} valid / {preview.total_receipts || 0} total. Lines: {preview.total_lines || 0}.
              </Alert>
              {!!preview.errors?.length && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Sheet</TableCell>
                        <TableCell>Row</TableCell>
                        <TableCell>Message</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(preview.errors || []).slice(0, 20).map((er, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{er.sheet}</TableCell>
                          <TableCell>{er.row}</TableCell>
                          <TableCell>{er.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {preview && !module?.customPreview && (
            <Box sx={{ mb: 2 }}>
              <Alert severity={preview.errors?.length ? 'warning' : 'success'} sx={{ mb: 2 }}>
                Rows: {preview.valid_rows || 0} valid / {preview.total_rows || 0} total.
              </Alert>
              {!!preview.errors?.length && (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Row</TableCell>
                        <TableCell>Message</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(preview.errors || []).slice(0, 20).map((er, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{er.row}</TableCell>
                          <TableCell>{er.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Preview (first 30 rows)
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {(preview.columns || []).map((c) => (
                        <TableCell key={c}>{c}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(preview.rows || []).slice(0, 30).map((r, idx) => (
                      <TableRow key={idx}>
                        {(preview.columns || []).map((c) => (
                          <TableCell key={c}>{String(r[c] ?? '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          <Dialog open={commitOpen} onClose={() => setCommitOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>Commit Bulk Upload</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary">
                Please confirm to commit the previewed rows into the database.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCommitOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={commitUpload} disabled={busy}>
                Commit
              </Button>
            </DialogActions>
          </Dialog>
          {preview && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={() => setCommitOpen(true)} disabled={busy}>
                Commit Upload
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <TextField select label="Module" value={deletedKey} onChange={(e) => setDeletedKey(e.target.value)} sx={{ minWidth: 260 }}>
              {DELETED_MODULES.map((m) => (
                <MenuItem key={m.key} value={m.key}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={loadDeleted} disabled={deletedBusy}>
              Load Deleted
            </Button>
          </Box>

          {deletedError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deletedError}
            </Alert>
          )}

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell>Deleted At</TableCell>
                  <TableCell>Deleted By</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(deletedRows || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{row.label || row.transaction_id || row.tanker_no || 'Record'}</TableCell>
                    <TableCell>{row.deleted_at ? new Date(row.deleted_at).toLocaleString() : ''}</TableCell>
                    <TableCell>{row.deleted_by_username || row.deleted_by_user_id || ''}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => restoreDeleted(row)} disabled={deletedBusy}>
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!deletedRows?.length && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Alert severity="info">No deleted records found.</Alert>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Container>
  )
}

export default BulkUpload
