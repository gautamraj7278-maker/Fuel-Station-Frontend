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
  Divider,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import * as XLSX from 'xlsx'
import { Add, UploadFile, SwapHoriz } from '@mui/icons-material'
import { useToast } from '../context/ToastContext'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function Tanks() {
  const toast = useToast()
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])

  const [products, setProducts] = useState([])
  const [tanks, setTanks] = useState([])
  const [allTanks, setAllTanks] = useState([])
  const [error, setError] = useState('')

  const [calPreviewOpen, setCalPreviewOpen] = useState(false)
  const [calPreviewTankId, setCalPreviewTankId] = useState(null)
  const [calPreviewTankName, setCalPreviewTankName] = useState('')
  const [calPreviewFile, setCalPreviewFile] = useState(null)
  const [calPreviewHeaders, setCalPreviewHeaders] = useState([])
  const [calPreviewRows, setCalPreviewRows] = useState([])
  const [calPreviewError, setCalPreviewError] = useState('')
  const [calUploading, setCalUploading] = useState(false)

  const [editingTank, setEditingTank] = useState(null)

  const [tankDialogOpen, setTankDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)

  const [dipDate, setDipDate] = useState(todayISO())
  const [dailyDips, setDailyDips] = useState([])
  const [dipDialogOpen, setDipDialogOpen] = useState(false)
  const [dipDialogTank, setDipDialogTank] = useState(null)
  const [dipDialogType, setDipDialogType] = useState('opening')
  const [dipForm, setDipForm] = useState({ dips_mm: '', manual_volume_litres: '' })

  const [tankForm, setTankForm] = useState({
    tank_name: '',
    product_id: '',
    capacity: '',
    current_volume: '',
    is_buffer: false,
    calibration_date: '',
    calibration_due_date: '',
    remarks: '',
  })

  const [transferForm, setTransferForm] = useState({
    from_tank_id: '',
    to_tank_id: '',
    product_id: '',
    volume: '',
    transfer_type: 'manual',
  })

  const fetchAll = async () => {
    setError('')
    try {
      const [pRes, mainTanksRes, allTanksRes] = await Promise.all([
        api.get('/products/'),
        api.get('/tanks/', { params: { is_buffer: false } }),
        api.get('/tanks/'),
      ])
      setProducts(pRes.data)
      setTanks(mainTanksRes.data)
      setAllTanks(allTanksRes.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load products/tanks')
    }
  }

  const fetchDailyDips = async (businessDate) => {
    setError('')
    try {
      const res = await api.get('/tanks/dips/daily', { params: { business_date: businessDate } })
      setDailyDips(res.data || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load daily dips')
    }
  }

  useEffect(() => {
    fetchAll()
    fetchDailyDips(dipDate)
  }, [])

  useEffect(() => {
    fetchDailyDips(dipDate)
  }, [dipDate])

  const productNameById = useMemo(() => {
    const map = new Map()
    for (const p of products) map.set(p.id, p.product_name)
    return map
  }, [products])

  const openCreateTank = () => {
    setEditingTank(null)
    setTankForm({
      tank_name: '',
      product_id: '',
      capacity: '',
      current_volume: '',
      is_buffer: false,
      calibration_date: '',
      calibration_due_date: '',
      remarks: '',
    })
    setTankDialogOpen(true)
  }

  const openEditTank = (t) => {
    setEditingTank(t)
    setTankForm({
      tank_name: t.tank_name || '',
      product_id: String(t.product_id ?? ''),
      capacity: t.capacity ?? '',
      current_volume: t.current_volume ?? '',
      is_buffer: !!t.is_buffer,
      calibration_date: t.calibration_date || '',
      calibration_due_date: t.calibration_due_date || '',
      remarks: t.remarks || '',
    })
    setTankDialogOpen(true)
  }

  const handleSaveTank = async () => {
    setError('')
    try {
      const payload = {
        tank_name: tankForm.tank_name,
        product_id: parseInt(tankForm.product_id),
        capacity: parseFloat(tankForm.capacity),
        current_volume: tankForm.current_volume === '' ? 0 : parseFloat(tankForm.current_volume),
        is_buffer: false,
        calibration_date: tankForm.calibration_date || null,
        calibration_due_date: tankForm.calibration_due_date || null,
        remarks: tankForm.remarks || null,
      }

      if (editingTank) {
        await api.put(`/tanks/${editingTank.id}`, payload, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Tank updated successfully')
      } else {
        await api.post('/tanks/', payload, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Tank created successfully')
      }
      setTankDialogOpen(false)
      setEditingTank(null)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save tank')
    }
  }

  const handleDeleteTank = async (t) => {
    if (!window.confirm(`Delete tank "${t.tank_name}"?`)) return
    setError('')
    try {
      await api.delete(`/tanks/${t.id}`, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess('Tank deleted successfully')
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete tank')
    }
  }

  const parseCalibrationFile = async (file) => {
    const filename = (file?.name || '').toLowerCase()
    setCalPreviewError('')
    setCalPreviewHeaders([])
    setCalPreviewRows([])

    const required = ['dips_mm', 'volume_in_litres']

    if (filename.endsWith('.csv')) {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
      if (!lines.length) throw new Error('CSV is empty')

      const headers = lines[0]
        .split(',')
        .map((h) => String(h).trim().toLowerCase())

      for (const r of required) {
        if (!headers.includes(r)) throw new Error(`Missing required column: ${r}`)
      }

      const idxDip = headers.indexOf('dips_mm')
      const idxVol = headers.indexOf('volume_in_litres')

      const rows = []
      for (const line of lines.slice(1, 31)) {
        const cols = line.split(',')
        rows.push({ dips_mm: cols[idxDip], volume_in_litres: cols[idxVol] })
      }

      setCalPreviewHeaders(['dips_mm', 'volume_in_litres'])
      setCalPreviewRows(rows)
      return
    }

    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames?.[0]
      if (!sheetName) throw new Error('No sheets found in workbook')
      const ws = wb.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!json.length) throw new Error('XLSX sheet has no data')

      const normalizedKeys = Object.keys(json[0]).map((k) => String(k).trim().toLowerCase())
      for (const r of required) {
        if (!normalizedKeys.includes(r)) throw new Error(`Missing required column: ${r}`)
      }

      // Normalize each row to required keys (case-insensitive)
      const rows = json.slice(0, 30).map((row) => {
        const map = new Map(Object.entries(row).map(([k, v]) => [String(k).trim().toLowerCase(), v]))
        return {
          dips_mm: map.get('dips_mm'),
          volume_in_litres: map.get('volume_in_litres'),
        }
      })

      setCalPreviewHeaders(['dips_mm', 'volume_in_litres'])
      setCalPreviewRows(rows)
      return
    }

    throw new Error('Unsupported file type. Upload .csv or .xlsx')
  }

  const handleUploadCalibration = async (tankId, file) => {
    if (!file) return
    setError('')
    setCalPreviewTankId(tankId)
    const tank = tanks.find((x) => String(x.id) === String(tankId))
    setCalPreviewTankName(tank?.tank_name || '')
    setCalPreviewFile(file)
    setCalPreviewOpen(true)
    try {
      await parseCalibrationFile(file)
    } catch (e) {
      setCalPreviewError(String(e?.message || e))
    }
  }

  const confirmUploadCalibration = async () => {
    if (!calPreviewFile || !calPreviewTankId) return
    setCalUploading(true)
    setCalPreviewError('')
    try {
      const formData = new FormData()
      formData.append('file', calPreviewFile)
      await api.post(`/tanks/${calPreviewTankId}/calibration/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Suppress-Toast': '1' },
      })

      setCalPreviewOpen(false)
      setCalPreviewFile(null)
      setCalPreviewTankId(null)
      setCalPreviewRows([])
      setCalPreviewHeaders([])
      toast.showSuccess('Calibration table uploaded successfully')
      fetchAll()
    } catch (e) {
      setCalPreviewError(e.response?.data?.detail || 'Failed to upload calibration')
    } finally {
      setCalUploading(false)
    }
  }

  const openTransfer = () => {
    setTransferForm({ from_tank_id: '', to_tank_id: '', product_id: '', volume: '', transfer_type: 'manual' })
    setTransferDialogOpen(true)
  }

  const handleTransfer = async () => {
    setError('')
    try {
      await api.post('/tanks/transfer', {
        ...transferForm,
        from_tank_id: parseInt(transferForm.from_tank_id),
        to_tank_id: parseInt(transferForm.to_tank_id),
        product_id: parseInt(transferForm.product_id),
        volume: parseFloat(transferForm.volume),
      }, { headers: { 'X-Suppress-Toast': '1' } })
      setTransferDialogOpen(false)
      toast.showSuccess('Transfer saved successfully')
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Transfer failed')
    }
  }

  const openDipDialog = (tank, dipType) => {
    setDipDialogTank(tank)
    setDipDialogType(dipType)
    const existing = dailyDips.find((x) => String(x.tank_id) === String(tank.id))
    const record = dipType === 'opening' ? existing?.opening : existing?.closing
    setDipForm({
      dips_mm: record?.dips_mm == null ? '' : String(record.dips_mm),
      manual_volume_litres: record?.manual_volume_litres == null ? '' : String(record.manual_volume_litres),
    })
    setDipDialogOpen(true)
  }

  const saveDipReading = async () => {
    if (!dipDialogTank) return
    setError('')
    try {
      await api.post('/tanks/dips', {
        tank_id: dipDialogTank.id,
        business_date: dipDate,
        dip_type: dipDialogType,
        dips_mm: dipForm.dips_mm === '' ? 0 : parseFloat(dipForm.dips_mm),
        manual_volume_litres: dipForm.manual_volume_litres === '' ? null : parseFloat(dipForm.manual_volume_litres),
      }, { headers: { 'X-Suppress-Toast': '1' } })
      setDipDialogOpen(false)
      setDipDialogTank(null)
      toast.showSuccess('Dip saved successfully')
      fetchDailyDips(dipDate)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save dip reading')
    }
  }

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Tanks
        </Typography>
        <Alert severity="info">Only Admin can manage tanks.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Tanks & Calibration
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Daily Dips (Opening / Closing)
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <TextField
            type="date"
            label="Business Date"
            value={dipDate}
            onChange={(e) => setDipDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <Button variant="outlined" onClick={() => fetchDailyDips(dipDate)}>
            Refresh Dips
          </Button>
          <Typography variant="body2" color="text.secondary">
            Volumes are interpolated from the uploaded calibration chart. Manual override is optional.
          </Typography>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tank</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="right">Opening Dip (mm)</TableCell>
                <TableCell align="right">Opening Vol (L)</TableCell>
                <TableCell align="right">Closing Dip (mm)</TableCell>
                <TableCell align="right">Closing Vol (L)</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tanks.map((t) => {
                const item = dailyDips.find((x) => String(x.tank_id) === String(t.id))
                const opening = item?.opening
                const closing = item?.closing
                const openingVol = opening?.manual_volume_litres ?? opening?.computed_volume_litres
                const closingVol = closing?.manual_volume_litres ?? closing?.computed_volume_litres
                return (
                  <TableRow key={t.id}>
                    <TableCell>{t.tank_name}</TableCell>
                    <TableCell>{productNameById.get(t.product_id) || t.product_id}</TableCell>
                    <TableCell align="right">{opening?.dips_mm == null ? '—' : Number(opening.dips_mm).toFixed(2)}</TableCell>
                    <TableCell align="right">{openingVol == null ? '—' : Number(openingVol).toFixed(2)}</TableCell>
                    <TableCell align="right">{closing?.dips_mm == null ? '—' : Number(closing.dips_mm).toFixed(2)}</TableCell>
                    <TableCell align="right">{closingVol == null ? '—' : Number(closingVol).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button size="small" variant="outlined" onClick={() => openDipDialog(t, 'opening')}>Opening</Button>
                        <Button size="small" variant="contained" onClick={() => openDipDialog(t, 'closing')}>Closing</Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<Add />} onClick={openCreateTank}>
          Add Tank
        </Button>
        <Button variant="contained" startIcon={<SwapHoriz />} onClick={openTransfer}>
          Transfer (Buffer → Main)
        </Button>
        <Button variant="outlined" onClick={fetchAll}>
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
              <TableCell>Name</TableCell>
              <TableCell>Product</TableCell>
              <TableCell align="right">Capacity</TableCell>
              <TableCell align="right">Current</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Calibration</TableCell>
              <TableCell align="right">Upload</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tanks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.tank_name}</TableCell>
                <TableCell>{productNameById.get(t.product_id) || t.product_id}</TableCell>
                <TableCell align="right">{Number(t.capacity).toFixed(2)}</TableCell>
                <TableCell align="right">{Number(t.current_volume).toFixed(2)}</TableCell>
                <TableCell>{t.is_buffer ? 'Buffer' : 'Main'}</TableCell>
                <TableCell>
                  {t.calibration_date || '-'} / due {t.calibration_due_date || '-'}
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
                    <Button component="label" size="small" startIcon={<UploadFile />} variant="outlined">
                      Upload
                      <input
                        type="file"
                        hidden
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => handleUploadCalibration(t.id, e.target.files?.[0])}
                      />
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', maxWidth: 260 }}>
                      Required columns (header row): <b>dips_mm</b>, <b>volume_in_litres</b>
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openEditTank(t)}>
                    Edit
                  </Button>
                  <Button size="small" color="error" onClick={() => handleDeleteTank(t)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={calPreviewOpen} onClose={() => (calUploading ? null : setCalPreviewOpen(false))} maxWidth="md" fullWidth>
        <DialogTitle>Preview Calibration Upload</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            Tank: {calPreviewTankName || calPreviewTankId || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            File: {calPreviewFile?.name || '—'}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Required columns (header row): <b>dips_mm</b>, <b>volume_in_litres</b>
          </Typography>

          {calPreviewError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {calPreviewError}
            </Alert>
          ) : (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2 }}>
                Preview (first {calPreviewRows.length} row{calPreviewRows.length === 1 ? '' : 's'})
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {calPreviewHeaders.map((h) => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {calPreviewRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{String(r.dips_mm ?? '')}</TableCell>
                        <TableCell>{String(r.volume_in_litres ?? '')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="warning" sx={{ mt: 2 }}>
                Confirm to upload and replace the existing calibration table for this tank.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalPreviewOpen(false)} disabled={calUploading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirmUploadCalibration} disabled={calUploading || !!calPreviewError || !calPreviewRows.length}>
            {calUploading ? 'Uploading…' : 'Confirm Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tankDialogOpen} onClose={() => setTankDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTank ? 'Edit Tank' : 'Add Tank'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Tank Name"
            value={tankForm.tank_name}
            onChange={(e) => setTankForm({ ...tankForm, tank_name: e.target.value })}
          />
          <TextField
            select
            fullWidth
            margin="normal"
            label="Product"
            value={tankForm.product_id}
            onChange={(e) => setTankForm({ ...tankForm, product_id: e.target.value })}
          >
            {products.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.product_name} ({p.fuel_type})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            type="number"
            label="Capacity (L)"
            value={tankForm.capacity}
            onChange={(e) => setTankForm({ ...tankForm, capacity: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            type="number"
            label="Current Volume (L)"
            value={tankForm.current_volume}
            onChange={(e) => setTankForm({ ...tankForm, current_volume: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Tank Type"
            value={'Main Tank'}
            disabled
            helperText="Buffer is virtual and auto-managed during testing"
          />

          <Divider sx={{ my: 2 }} />

          <TextField
            fullWidth
            type="date"
            margin="normal"
            label="Calibration Date"
            value={tankForm.calibration_date}
            onChange={(e) => setTankForm({ ...tankForm, calibration_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            type="date"
            margin="normal"
            label="Calibration Due Date"
            value={tankForm.calibration_due_date}
            onChange={(e) => setTankForm({ ...tankForm, calibration_due_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Remarks"
            value={tankForm.remarks}
            onChange={(e) => setTankForm({ ...tankForm, remarks: e.target.value })}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTankDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveTank}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transfer Product</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Use this to move product from buffer tank back to a main tank.
          </Alert>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Product"
            value={transferForm.product_id}
            onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}
          >
            {products.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.product_name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            margin="normal"
            label="From Tank"
            value={transferForm.from_tank_id}
            onChange={(e) => setTransferForm({ ...transferForm, from_tank_id: e.target.value })}
          >
            {allTanks
              .filter((t) => String(t.product_id) === String(transferForm.product_id))
              .map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.tank_name} (vol {Number(t.current_volume).toFixed(2)})
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            fullWidth
            margin="normal"
            label="To Tank"
            value={transferForm.to_tank_id}
            onChange={(e) => setTransferForm({ ...transferForm, to_tank_id: e.target.value })}
          >
            {allTanks
              .filter((t) => String(t.product_id) === String(transferForm.product_id))
              .map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.tank_name} (vol {Number(t.current_volume).toFixed(2)})
                </MenuItem>
              ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            type="number"
            label="Volume (L)"
            value={transferForm.volume}
            onChange={(e) => setTransferForm({ ...transferForm, volume: e.target.value })}
          />
          <TextField
            select
            fullWidth
            margin="normal"
            label="Transfer Type"
            value={transferForm.transfer_type}
            onChange={(e) => setTransferForm({ ...transferForm, transfer_type: e.target.value })}
          >
            <MenuItem value="buffer_to_main">Buffer → Main</MenuItem>
            <MenuItem value="manual">Manual</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTransfer}>
            Transfer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dipDialogOpen} onClose={() => setDipDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Update {dipDialogType === 'opening' ? 'Opening' : 'Closing'} Dip — {dipDialogTank?.tank_name}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Dip (mm)"
            type="number"
            value={dipForm.dips_mm}
            onChange={(e) => setDipForm({ ...dipForm, dips_mm: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Manual Volume Override (L) (optional)"
            type="number"
            value={dipForm.manual_volume_litres}
            onChange={(e) => setDipForm({ ...dipForm, manual_volume_litres: e.target.value })}
          />
          <Typography variant="body2" color="text.secondary">
            If the dip is outside the calibration range, provide a manual volume to save.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDipDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveDipReading}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Tanks
