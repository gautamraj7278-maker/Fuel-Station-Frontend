import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { Add, CheckCircle } from '@mui/icons-material'
import { useLocation } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { downloadApiFile } from '../utils/downloadApiFile'
import { exportRowsToCSV, exportRowsToPDF, exportRowsToXLSX, viewRowsAsPDF } from '../utils/exporting'

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function TankerReceipts() {
  const { user } = useAuth()
  const toast = useToast()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canOps = useMemo(() => ['admin', 'manager', 'operator'].includes(role), [role])
  const canDelete = useMemo(() => ['admin', 'manager'].includes(role), [role])
  const canViewDeleted = useMemo(() => role === 'admin', [role])
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const location = useLocation()

  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [tanks, setTanks] = useState([])
  const [receipts, setReceipts] = useState([])
  const [editingReceipt, setEditingReceipt] = useState(null)

  const [openDeletedDialog, setOpenDeletedDialog] = useState(false)
  const [deletedError, setDeletedError] = useState('')
  const [deletedReceipts, setDeletedReceipts] = useState([])

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkPreview, setBulkPreview] = useState(null)
  const [bulkConfirmStock, setBulkConfirmStock] = useState(false)

  const [filters, setFilters] = useState({ from_date: '', to_date: '', status: '' })

  const [openDialog, setOpenDialog] = useState(false)
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [form, setForm] = useState({
    receipt_date: todayISO(),
    tanker_no: '',
    transporter_name: '',
    driver_name: '',
    invoice_no: '',
    remarks: '',
  })
  const [compartments, setCompartments] = useState([
    {
      product_id: '',
      dips_invoice_mm: '',
      dips_site_mm: '',
      quantity_invoice_litres: '',
      density_invoice: '',
      density_site: '',
      temperature_c: '',
      remarks: '',
    },
  ])
  const [lines, setLines] = useState([{ tank_id: '', before_dips_mm: '', after_dips_mm: '', remarks: '' }])
  const [lineComputed, setLineComputed] = useState({})
  const computeTimersRef = useRef({})

  const productById = useMemo(() => {
    const map = new Map()
    for (const p of products) map.set(String(p.id), p)
    return map
  }, [products])

  const tankById = useMemo(() => {
    const map = new Map()
    for (const t of tanks) map.set(String(t.id), t)
    return map
  }, [tanks])

  const exportRows = useMemo(() => {
    if (!receipts.length) return []
    const rows = []
    for (const r of receipts) {
      const invoiceByProduct = new Map()
      for (const c of r.compartments || []) {
        const key = String(c.product_id)
        const prev = invoiceByProduct.get(key) || 0
        invoiceByProduct.set(key, prev + Number(c.quantity_invoice_litres || 0))
      }
      const receivedByProduct = new Map()
      for (const l of r.lines || []) {
        const key = String(l.product_id)
        const prev = receivedByProduct.get(key) || 0
        receivedByProduct.set(key, prev + Number(l.received_volume_litres || 0))
      }
      const productIds = Array.from(new Set([...invoiceByProduct.keys(), ...receivedByProduct.keys()]))
      if (!productIds.length) {
        rows.push({
          'Receipt ID': r.id,
          Date: r.receipt_date,
          'Tanker No': r.tanker_no,
          'Invoice No': r.invoice_no || '',
          Product: '',
          'Invoice Qty (L)': '',
          'Received Qty (L)': '',
          'Variance (L)': '',
        })
        continue
      }
      for (const pid of productIds) {
        const invoiceQty = invoiceByProduct.get(pid) || 0
        const receivedQty = receivedByProduct.get(pid) || 0
        rows.push({
          'Receipt ID': r.id,
          Date: r.receipt_date,
          'Tanker No': r.tanker_no,
          'Invoice No': r.invoice_no || '',
          Product: productById.get(pid)?.product_name || pid,
          'Invoice Qty (L)': invoiceQty.toFixed(2),
          'Received Qty (L)': receivedQty.toFixed(2),
          'Variance (L)': (receivedQty - invoiceQty).toFixed(2),
        })
      }
    }
    return rows
  }, [receipts, productById])

  const exportBase = useMemo(() => {
    const from = filters.from_date || 'from'
    const to = filters.to_date || from
    const suffix = from === to ? from : `${from}_to_${to}`
    return `tanker_receipts_${suffix}`
  }, [filters.from_date, filters.to_date])

  const fetchBase = async () => {
    setError('')
    try {
      const [pRes, tRes] = await Promise.all([
        api.get('/products/'),
        api.get('/tanks/', { params: { is_buffer: false } }),
      ])

      const allProducts = pRes.data || []
      const activeProducts = allProducts.filter((p) => p?.is_active !== false)
      setProducts(activeProducts)

      const allowedProductIds = new Set(activeProducts.map((p) => String(p.id)))
      const allTanks = tRes.data || []
      setTanks(allTanks.filter((t) => allowedProductIds.has(String(t.product_id))))
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load products/tanks')
    }
  }

  const fetchReceipts = async (activeFilters) => {
    setError('')
    try {
      const f = activeFilters || {}
      const params = {}
      if (f.from_date) params.receipt_date_from = f.from_date
      if (f.to_date) params.receipt_date_to = f.to_date
      if (f.status) params.status_filter = f.status
      const res = await api.get('/tanker-receipts/', { params })
      setReceipts(res.data || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load tanker receipts')
    }
  }

  useEffect(() => {
    fetchBase()
    fetchReceipts(filters)

    const params = new URLSearchParams(location.search || '')
    if (params.get('new') === '1' && canOps) {
      setAutoConfirm(params.get('auto_confirm') === '1')
      openCreate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditingReceipt(null)
    setAutoConfirm((new URLSearchParams(location.search || '')).get('auto_confirm') === '1')
    setForm({
      receipt_date: todayISO(),
      tanker_no: '',
      transporter_name: '',
      driver_name: '',
      invoice_no: '',
      remarks: '',
    })
    setCompartments([
      {
        product_id: '',
        dips_invoice_mm: '',
        dips_site_mm: '',
        quantity_invoice_litres: '',
        density_invoice: '',
        density_site: '',
        temperature_c: '',
        remarks: '',
      },
    ])
    setLines([{ tank_id: '', before_dips_mm: '', after_dips_mm: '', remarks: '' }])
    setLineComputed({})
    setOpenDialog(true)
  }

  const openEdit = (r) => {
    setEditingReceipt(r)
    setAutoConfirm(false)
    setForm({
      receipt_date: r.receipt_date || todayISO(),
      tanker_no: r.tanker_no || '',
      transporter_name: r.transporter_name || '',
      driver_name: r.driver_name || '',
      invoice_no: r.invoice_no || '',
      remarks: r.remarks || '',
    })

    const comps = (r.compartments || []).map((c) => ({
      product_id: c.product_id == null ? '' : String(c.product_id),
      dips_invoice_mm: c.dips_invoice_mm == null ? '' : String(c.dips_invoice_mm),
      dips_site_mm: c.dips_site_mm == null ? '' : String(c.dips_site_mm),
      quantity_invoice_litres: c.quantity_invoice_litres == null ? '' : String(c.quantity_invoice_litres),
      density_invoice: c.density_invoice == null ? '' : String(c.density_invoice),
      density_site: c.density_site == null ? '' : String(c.density_site),
      temperature_c: c.temperature_c == null ? '' : String(c.temperature_c),
      remarks: c.remarks || '',
    }))
    setCompartments(comps.length ? comps : [{ product_id: '', dips_invoice_mm: '', dips_site_mm: '', quantity_invoice_litres: '', density_invoice: '', density_site: '', temperature_c: '', remarks: '' }])

    const ls = (r.lines || []).map((l) => ({
      tank_id: l.tank_id == null ? '' : String(l.tank_id),
      before_dips_mm: l.before_dips_mm == null ? '' : String(l.before_dips_mm),
      after_dips_mm: l.after_dips_mm == null ? '' : String(l.after_dips_mm),
      remarks: l.remarks || '',
    }))
    setLines(ls.length ? ls : [{ tank_id: '', before_dips_mm: '', after_dips_mm: '', remarks: '' }])
    setLineComputed({})
    setOpenDialog(true)
  }

  const fetchDeletedReceipts = async () => {
    setDeletedError('')
    try {
      const res = await api.get('/tanker-receipts/deleted')
      setDeletedReceipts(res.data || [])
    } catch (e) {
      setDeletedError(e.response?.data?.detail || 'Failed to load deleted records')
    }
  }

  const openBulkUpload = () => {
    setBulkError('')
    setBulkPreview(null)
    setBulkFile(null)
    setBulkConfirmStock(false)
    setBulkOpen(true)
  }

  const downloadBulkTemplate = async () => {
    setBulkError('')
    try {
      await downloadApiFile('/bulk/tanker-receipts/template', { defaultFilename: 'tanker_receipts_bulk_template.xlsx' })
    } catch (e) {
      const detail = e.response?.data?.detail
      setBulkError(typeof detail === 'string' ? detail : 'Failed to download template')
    }
  }

  const previewBulkUpload = async () => {
    if (!bulkFile) {
      setBulkError('Please choose an XLSX file')
      return
    }
    setBulkBusy(true)
    setBulkError('')
    try {
      const form = new FormData()
      form.append('file', bulkFile)
      const res = await api.post('/bulk/tanker-receipts/preview', form, { headers: { 'X-Suppress-Toast': '1' } })
      setBulkPreview(res.data)
    } catch (e) {
      const detail = e.response?.data?.detail
      setBulkError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to preview upload')
    } finally {
      setBulkBusy(false)
    }
  }

  const commitBulkUpload = async () => {
    if (!bulkPreview?.receipts?.length) {
      setBulkError('No valid receipts to upload. Fix errors and preview again.')
      return
    }
    if (!window.confirm('Upload these receipts to the database now?')) return
    setBulkBusy(true)
    setBulkError('')
    try {
      const res = await api.post(
        `/bulk/tanker-receipts/commit${bulkConfirmStock ? '?confirm=true' : ''}`,
        { receipts: bulkPreview.receipts },
        { headers: { 'X-Suppress-Toast': '1' } }
      )
      toast.showSuccess(`Bulk upload done: ${res.data?.inserted || 0} inserted, ${res.data?.updated || 0} updated.`)
      setBulkOpen(false)
      setBulkPreview(null)
      setBulkFile(null)
      await fetchReceipts(filters)
    } catch (e) {
      const detail = e.response?.data?.detail
      setBulkError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to commit upload')
    } finally {
      setBulkBusy(false)
    }
  }

  const purgeDeletedReceipt = async (row) => {
    setDeletedError('')
    if (!window.confirm(`Permanently wipe deleted receipt #${row.id}? This cannot be undone.`)) return
    try {
      await api.delete(`/tanker-receipts/deleted/${row.id}`)
      toast.showSuccess('Deleted tanker receipt wiped')
      fetchDeletedReceipts()
    } catch (e) {
      setDeletedError(e.response?.data?.detail || 'Failed to purge deleted record')
    }
  }

  const addLine = () => setLines((prev) => [...prev, { tank_id: '', before_dips_mm: '', after_dips_mm: '', remarks: '' }])
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx))

  const computeLineVolumes = async (idx) => {
    const l = lines[idx]
    const tankId = parseInt(l?.tank_id)
    if (!tankId || Number.isNaN(tankId)) return
    if (l.before_dips_mm === '' || l.after_dips_mm === '') return

    const beforeMm = parseFloat(l.before_dips_mm)
    const afterMm = parseFloat(l.after_dips_mm)
    if (Number.isNaN(beforeMm) || Number.isNaN(afterMm)) return

    setLineComputed((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] || {}), loading: true, error: '' },
    }))

    try {
      const [beforeRes, afterRes] = await Promise.all([
        api.get(`/tanks/${tankId}/compute-volume`, { params: { dips_mm: beforeMm } }),
        api.get(`/tanks/${tankId}/compute-volume`, { params: { dips_mm: afterMm } }),
      ])

      const beforeVol = Number(beforeRes.data?.volume_litres || 0)
      const afterVol = Number(afterRes.data?.volume_litres || 0)
      const receivedVol = afterVol - beforeVol

      setLineComputed((prev) => ({
        ...prev,
        [idx]: { loading: false, error: '', beforeVol, afterVol, receivedVol },
      }))
    } catch (e) {
      setLineComputed((prev) => ({
        ...prev,
        [idx]: { ...(prev[idx] || {}), loading: false, error: e.response?.data?.detail || 'Failed to compute volumes' },
      }))
    }
  }

  const scheduleComputeLineVolumes = (idx) => {
    const timers = computeTimersRef.current
    if (timers[idx]) {
      clearTimeout(timers[idx])
    }
    timers[idx] = setTimeout(() => {
      computeLineVolumes(idx)
    }, 450)
  }

  useEffect(() => {
    // Debounced live computation while typing (per line)
    for (let idx = 0; idx < lines.length; idx += 1) {
      const l = lines[idx]
      if (!l) continue
      if (!l.tank_id) continue
      if (l.before_dips_mm === '' || l.after_dips_mm === '') continue
      scheduleComputeLineVolumes(idx)
    }

    return () => {
      const timers = computeTimersRef.current
      Object.keys(timers).forEach((k) => {
        clearTimeout(timers[k])
        delete timers[k]
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines])

  const addCompartment = () =>
    setCompartments((prev) => [
      ...prev,
      { product_id: '', dips_invoice_mm: '', dips_site_mm: '', quantity_invoice_litres: '', density_invoice: '', density_site: '', temperature_c: '', remarks: '' },
    ])
  const removeCompartment = (idx) => setCompartments((prev) => prev.filter((_, i) => i !== idx))

  const saveReceipt = async () => {
    setError('')
    try {
      const payload = {
        receipt_date: form.receipt_date,
        tanker_no: form.tanker_no,
        transporter_name: form.transporter_name || null,
        driver_name: form.driver_name || null,
        invoice_no: form.invoice_no || null,
        remarks: form.remarks || null,
        compartments: compartments
          .filter((c) => c.product_id !== '')
          .map((c) => ({
            product_id: parseInt(c.product_id),
            dips_invoice_mm: c.dips_invoice_mm === '' ? null : parseFloat(c.dips_invoice_mm),
            dips_site_mm: c.dips_site_mm === '' ? null : parseFloat(c.dips_site_mm),
            quantity_invoice_litres: c.quantity_invoice_litres === '' ? null : parseFloat(c.quantity_invoice_litres),
            density_invoice: c.density_invoice === '' ? null : parseFloat(c.density_invoice),
            density_site: c.density_site === '' ? null : parseFloat(c.density_site),
            temperature_c: c.temperature_c === '' ? null : parseFloat(c.temperature_c),
            remarks: c.remarks || null,
          })),
        lines: lines.map((l) => ({
          tank_id: parseInt(l.tank_id),
          before_dips_mm: parseFloat(l.before_dips_mm),
          after_dips_mm: parseFloat(l.after_dips_mm),
          remarks: l.remarks || null,
        })),
      }

      const isEdit = !!editingReceipt?.id
      const res = isEdit
        ? await api.put(`/tanker-receipts/${editingReceipt.id}`, payload, { headers: { 'X-Suppress-Toast': '1' } })
        : await api.post('/tanker-receipts/', payload, { headers: { 'X-Suppress-Toast': '1' } })

      toast.showSuccess(isEdit ? 'Tanker receipt updated' : 'Tanker receipt saved')

      const saved = res?.data
      const shouldConfirm =
        !!saved?.id &&
        String(saved.status || '').toLowerCase() === 'draft' &&
        (autoConfirm || window.confirm('Confirm this tanker receipt now? (This will update tank stock and inventory)'))
      if (shouldConfirm) {
        await api.post(`/tanker-receipts/${saved.id}/confirm`, null, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Tanker receipt confirmed. Stock updated.')
      } else if (!isEdit) {
        toast.showInfo('Receipt saved as Draft. Confirm it later to update stock.')
      }

      setOpenDialog(false)
      setEditingReceipt(null)
      await fetchReceipts(filters)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save tanker receipt')
    }
  }

  const confirmReceipt = async (r) => {
    if (!window.confirm(`Confirm tanker receipt #${r.id}? This will restock tank volumes.`)) return
    setError('')
    try {
      await api.post(`/tanker-receipts/${r.id}/confirm`, null, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess('Tanker receipt confirmed. Stock updated.')
      await fetchReceipts(filters)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to confirm receipt')
    }
  }

  const deleteReceipt = async (r) => {
    const promptLabel = isManager
      ? `Request deletion for tanker receipt #${r.id}?\n\nOptional reason:`
      : `Delete tanker receipt #${r.id}?\n\nOptional reason:`
    const reason = window.prompt(promptLabel, '')
    if (reason === null) return
    setError('')
    try {
      const res = await api.delete(`/tanker-receipts/${r.id}`, { params: { reason }, headers: { 'X-Suppress-Toast': '1' } })
      if (res?.data?.status === 'pending') {
        toast.showInfo('Deletion request sent to admin for approval.')
      } else {
        toast.showSuccess('Tanker receipt deleted')
      }
      await fetchReceipts(filters)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete receipt')
    }
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Tanker Receipts
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          New Receipt
        </Button>
        {isAdmin && (
          <Button variant="outlined" onClick={openBulkUpload}>
            Bulk Upload
          </Button>
        )}
        <Button
          variant="outlined"
          onClick={() => exportRowsToCSV(exportRows, { filename: `${exportBase}.csv` })}
          disabled={!exportRows.length}
        >
          Export CSV
        </Button>
        <Button
          variant="outlined"
          onClick={() => exportRowsToXLSX(exportRows, { filename: `${exportBase}.xlsx`, sheetName: 'Tanker Receipts' })}
          disabled={!exportRows.length}
        >
          Export XLSX
        </Button>
        <Button
          variant="outlined"
          onClick={() => exportRowsToPDF(exportRows, { filename: `${exportBase}.pdf`, title: 'Tanker Receipts' })}
          disabled={!exportRows.length}
        >
          Export PDF
        </Button>
        <Button
          variant="outlined"
          onClick={() => viewRowsAsPDF(exportRows, { title: 'Tanker Receipts' })}
          disabled={!exportRows.length}
        >
          View PDF
        </Button>
        {canViewDeleted && (
          <Button
            variant="outlined"
            onClick={() => {
              setOpenDeletedDialog(true)
              fetchDeletedReceipts()
            }}
          >
            Deleted Records
          </Button>
        )}
        <TextField
          size="small"
          type="date"
          label="From"
          value={filters.from_date}
          onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label="To"
          value={filters.to_date}
          onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          select
          label="Status"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="confirmed">Confirmed</MenuItem>
          <MenuItem value="cancelled">Cancelled</MenuItem>
        </TextField>
        <Button variant="outlined" onClick={() => fetchReceipts(filters)}>
          Apply
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {String(error)}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Tanker No</TableCell>
              <TableCell>Invoice No</TableCell>
              <TableCell>Product</TableCell>
              <TableCell align="right">Invoice Qty (L)</TableCell>
              <TableCell align="right">Received Qty (L)</TableCell>
              <TableCell align="right">Diff (Received − Invoice)</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {receipts.map((r) => {
              const invoiceByProduct = new Map()
              for (const c of r.compartments || []) {
                const key = String(c.product_id)
                const prev = invoiceByProduct.get(key) || 0
                invoiceByProduct.set(key, prev + Number(c.quantity_invoice_litres || 0))
              }
              const receivedByProduct = new Map()
              for (const l of r.lines || []) {
                const key = String(l.product_id)
                const prev = receivedByProduct.get(key) || 0
                receivedByProduct.set(key, prev + Number(l.received_volume_litres || 0))
              }
              const productIds = Array.from(new Set([...invoiceByProduct.keys(), ...receivedByProduct.keys()]))
              productIds.sort((a, b) => {
                const pa = productById.get(a)?.product_name || a
                const pb = productById.get(b)?.product_name || b
                return String(pa).localeCompare(String(pb))
              })
              return (

                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.receipt_date}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.tanker_no}</TableCell>
                  <TableCell>{r.invoice_no || '-'}</TableCell>
                  <TableCell>
                    {productIds.length
                      ? productIds.map((pid) => (
                          <Typography key={pid} variant="body2">
                            {productById.get(pid)?.product_name || pid}
                          </Typography>
                        ))
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    {productIds.length
                      ? productIds.map((pid) => (
                          <Typography key={pid} variant="body2">
                            {(invoiceByProduct.get(pid) || 0).toFixed(2)}
                          </Typography>
                        ))
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    {productIds.length
                      ? productIds.map((pid) => (
                          <Typography key={pid} variant="body2">
                            {(receivedByProduct.get(pid) || 0).toFixed(2)}
                          </Typography>
                        ))
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    {productIds.length
                      ? productIds.map((pid) => {
                          const diff = (receivedByProduct.get(pid) || 0) - (invoiceByProduct.get(pid) || 0)
                          const diffColor = diff < 0 ? 'error.main' : diff > 0 ? 'success.main' : 'text.primary'
                          return (
                            <Typography key={pid} variant="body2" sx={{ color: diffColor, fontWeight: 700 }}>
                              {diff.toFixed(2)}
                            </Typography>
                          )
                        })
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    {r.status === 'draft' && (
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button size="small" startIcon={<CheckCircle />} variant="contained" onClick={() => confirmReceipt(r)}>
                          Confirm
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => openEdit(r)}>
                          Edit
                        </Button>
                        {canDelete && (
                          <Button size="small" color="error" variant="outlined" onClick={() => deleteReceipt(r)}>
                            {isManager ? 'Request Delete' : 'Delete'}
                          </Button>
                        )}
                      </Box>
                    )}
                    {r.status !== 'draft' && (
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {isAdmin && (
                          <Button size="small" variant="outlined" onClick={() => openEdit(r)}>
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="small" color="error" variant="outlined" onClick={() => deleteReceipt(r)}>
                            {isManager ? 'Request Delete' : 'Delete'}
                          </Button>
                        )}
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDeletedDialog} onClose={() => setOpenDeletedDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Deleted Tanker Receipts</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Deleted tanker receipts are moved here first. Use “Wipe” to permanently remove a deleted record.
          </Alert>
          {deletedError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deletedError}
            </Alert>
          )}

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Deleted At</TableCell>
                  <TableCell>Receipt #</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Tanker No</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deletedReceipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.deleted_at ? new Date(r.deleted_at).toLocaleString() : '—'}</TableCell>
                    <TableCell>{r.original_receipt_id || '—'}</TableCell>
                    <TableCell>{r.receipt_date}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{r.tanker_no}</TableCell>
                    <TableCell>{r.delete_reason || '—'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => purgeDeletedReceipt(r)}>
                        Wipe
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!deletedReceipts.length && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Alert severity="info">No deleted records.</Alert>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeletedDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => (bulkBusy ? null : setBulkOpen(false))} maxWidth="lg" fullWidth>
        <DialogTitle>Tanker Receipts Bulk Upload</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upload an XLSX with two sheets: “Receipts” and “Lines”. You can download the template below.
          </Alert>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Button variant="outlined" onClick={downloadBulkTemplate} disabled={bulkBusy}>
              Download XLSX Template
            </Button>

            <Button component="label" variant="contained" disabled={bulkBusy}>
              Choose File
              <input
                type="file"
                hidden
                accept=".xlsx"
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

            <TextField
              select
              size="small"
              label="Confirm Stock"
              value={bulkConfirmStock ? 'yes' : 'no'}
              onChange={(e) => setBulkConfirmStock(e.target.value === 'yes')}
              sx={{ minWidth: 160 }}
              helperText="Yes will update tank & inventory"
              disabled={bulkBusy}
            >
              <MenuItem value="no">No (Draft only)</MenuItem>
              <MenuItem value="yes">Yes (Confirm receipts)</MenuItem>
            </TextField>

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
                Receipts: {bulkPreview.valid_receipts || 0} valid / {bulkPreview.total_receipts || 0} total. Lines: {bulkPreview.total_lines || 0}.
              </Alert>

              {!!bulkPreview.errors?.length && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Errors (first 20)</Typography>
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
                        {bulkPreview.errors.slice(0, 20).map((er, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{er.sheet}</TableCell>
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
                Preview (showing first {Math.min(20, bulkPreview.receipts?.length || 0)} of {bulkPreview.receipts?.length || 0} receipts)
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Receipt Key</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Tanker No</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell align="right">Lines</TableCell>
                      <TableCell align="right">Total Received (L)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(bulkPreview.receipts || []).slice(0, 20).map((r, idx) => {
                      const total = (r.lines || []).reduce((sum, l) => sum + Number(l.received_volume_litres || 0), 0)
                      return (
                        <TableRow key={idx}>
                          <TableCell>{r.receipt_key}</TableCell>
                          <TableCell>{r.receipt_date}</TableCell>
                          <TableCell>{r.tanker_no}</TableCell>
                          <TableCell>{r.invoice_no || '—'}</TableCell>
                          <TableCell align="right">{(r.lines || []).length}</TableCell>
                          <TableCell align="right">{total.toFixed(2)}</TableCell>
                        </TableRow>
                      )
                    })}
                    {!bulkPreview.receipts?.length && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Alert severity="info">No valid receipts to preview.</Alert>
                        </TableCell>
                      </TableRow>
                    )}
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
          <Button variant="contained" onClick={commitBulkUpload} disabled={bulkBusy || !bulkPreview?.receipts?.length || (bulkPreview?.errors?.length || 0) > 0}>
            {bulkBusy ? 'Uploading…' : 'Confirm Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        fullWidth
        maxWidth="xl"
        PaperProps={{
          sx: {
            width: '96vw',
            height: '92vh',
            maxWidth: '96vw',
          },
        }}
      >
        <DialogTitle>{editingReceipt ? `Edit Tanker Receipt #${editingReceipt.id}` : 'New Tanker Receipt'}</DialogTitle>
        <DialogContent dividers sx={{ overflow: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, mt: 1 }}>
            <TextField
              type="date"
              label="Date"
              value={form.receipt_date}
              onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField label="Tanker No" value={form.tanker_no} onChange={(e) => setForm({ ...form, tanker_no: e.target.value })} />
            <TextField label="Transporter Name" value={form.transporter_name} onChange={(e) => setForm({ ...form, transporter_name: e.target.value })} />
            <TextField label="Driver Name" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
            <TextField label="Invoice No" value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} />
          </Box>
          <TextField
            fullWidth
            margin="normal"
            label="Remarks"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          />

          <Typography variant="h6" sx={{ mt: 2 }}>
            Tanker Compartments (product-wise)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Invoice Dips (mm)</TableCell>
                  <TableCell align="right">Site Dips (mm)</TableCell>
                  <TableCell align="right">Invoice Qty (L)</TableCell>
                  <TableCell align="right">Density (Inv)</TableCell>
                  <TableCell align="right">Density (Site)</TableCell>
                  <TableCell align="right">Temp (°C)</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {compartments.map((c, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ minWidth: 220 }}>
                      <TextField
                        fullWidth
                        size="small"
                        select
                        value={c.product_id}
                        onChange={(e) => setCompartments((prev) => prev.map((x, i) => (i === idx ? { ...x, product_id: e.target.value } : x)))}
                      >
                        <MenuItem value="">Select product</MenuItem>
                        {products.map((p) => (
                          <MenuItem key={p.id} value={String(p.id)}>
                            {p.product_name} ({p.fuel_type})
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={c.dips_invoice_mm} onChange={(e) => setCompartments((prev) => prev.map((x, i) => (i === idx ? { ...x, dips_invoice_mm: e.target.value } : x)))} /></TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={c.dips_site_mm} onChange={(e) => setCompartments((prev) => prev.map((x, i) => (i === idx ? { ...x, dips_site_mm: e.target.value } : x)))} /></TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={c.quantity_invoice_litres} onChange={(e) => setCompartments((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity_invoice_litres: e.target.value } : x)))} /></TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={c.density_invoice} onChange={(e) => setCompartments((prev) => prev.map((x, i) => (i === idx ? { ...x, density_invoice: e.target.value } : x)))} /></TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={c.density_site} onChange={(e) => setCompartments((prev) => prev.map((x, i) => (i === idx ? { ...x, density_site: e.target.value } : x)))} /></TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={c.temperature_c} onChange={(e) => setCompartments((prev) => prev.map((x, i) => (i === idx ? { ...x, temperature_c: e.target.value } : x)))} /></TableCell>
                    <TableCell><TextField fullWidth size="small" value={c.remarks} onChange={(e) => setCompartments((prev) => prev.map((x, i) => (i === idx ? { ...x, remarks: e.target.value } : x)))} /></TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => removeCompartment(idx)} disabled={compartments.length <= 1}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Button variant="outlined" onClick={addCompartment}>Add Compartment</Button>
            <Typography variant="body2" color="text.secondary">Add compartments per product (same product allowed).</Typography>
          </Box>

          <Typography variant="h6" sx={{ mt: 2 }}>
            Tank Receipt Lines (before/after dips)
          </Typography>

          <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tank</TableCell>
                  <TableCell align="right">Before Dip (mm)</TableCell>
                  <TableCell align="right">After Dip (mm)</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((l, idx) => (
                  <React.Fragment key={idx}>
                    <TableRow>
                      <TableCell sx={{ minWidth: 260 }}>
                        <TextField
                          fullWidth
                          size="small"
                          select
                          value={l.tank_id}
                          onChange={(e) => {
                            const value = e.target.value
                            setLineComputed((prev) => ({ ...prev, [idx]: undefined }))
                            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, tank_id: value } : x)))
                          }}
                        >
                          <MenuItem value="">Select tank</MenuItem>
                          {tanks.map((t) => {
                            const p = productById.get(String(t.product_id))
                            const label = `${t.tank_name} — ${p?.product_name || 'Unknown product'}`
                            return (
                              <MenuItem key={t.id} value={String(t.id)}>
                                {label}
                              </MenuItem>
                            )
                          })}
                        </TextField>
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={l.before_dips_mm}
                          onChange={(e) => {
                            const value = e.target.value
                            setLineComputed((prev) => ({ ...prev, [idx]: undefined }))
                            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, before_dips_mm: value } : x)))
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={l.after_dips_mm}
                          onChange={(e) => {
                            const value = e.target.value
                            setLineComputed((prev) => ({ ...prev, [idx]: undefined }))
                            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, after_dips_mm: value } : x)))
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          value={l.remarks}
                          onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, remarks: e.target.value } : x)))}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button size="small" variant="outlined" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                            Remove
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 0.75 }}>
                        {lineComputed[idx]?.error ? (
                          <Typography variant="caption" color="error">
                            {String(lineComputed[idx].error)}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Computed Volumes (L):
                            {' '}
                            Before {lineComputed[idx]?.beforeVol == null ? '—' : Number(lineComputed[idx].beforeVol).toFixed(2)}
                            {' | '}
                            After {lineComputed[idx]?.afterVol == null ? '—' : Number(lineComputed[idx].afterVol).toFixed(2)}
                            {' | '}
                            Received {lineComputed[idx]?.receivedVol == null ? '—' : Number(lineComputed[idx].receivedVol).toFixed(2)}
                            {lineComputed[idx]?.loading ? ' (computing...)' : ''}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Button variant="outlined" onClick={addLine}>
              Add Line
            </Button>
            <Typography variant="body2" color="text.secondary">
              Volumes are computed using tank calibration (dip interpolation).
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <FormControlLabel
            control={<Switch checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} />}
            label="Auto confirm on save"
          />
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveReceipt}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default TankerReceipts
