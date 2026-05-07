import React, { useMemo, useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Box,
  InputAdornment,
  Tooltip,
} from '@mui/material'
import { Add, WarningAmber } from '@mui/icons-material'
import api from '../services/api'
import { exportRowsToCSV, exportRowsToPDF, exportRowsToXLSX, viewRowsAsPDF } from '../utils/exporting'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { downloadApiFile } from '../utils/downloadApiFile'

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatSignedINR(amount) {
  const value = Number(amount || 0)
  if (value < 0) return `-₹${Math.abs(value).toFixed(2)}`
  return `₹${value.toFixed(2)}`
}

function toNumber(value) {
  if (value === '' || value == null) return 0
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function computeDispensedVolume({ opening, closing, maxValue }) {
  if (!Number.isFinite(closing)) return { liters: null, wrap: false }
  if (maxValue != null) {
    const max = Number(maxValue)
    if (closing < opening) return { liters: (max - opening) + closing, wrap: true }
    return { liters: closing - opening, wrap: false }
  }
  if (closing < opening) return { liters: null, wrap: false }
  return { liters: closing - opening, wrap: false }
}

const pageShellSx = {
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -160,
    right: -120,
    width: 420,
    height: 420,
    background: 'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.22), rgba(59, 130, 246, 0))',
    zIndex: 0,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -200,
    left: -160,
    width: 520,
    height: 520,
    background: 'radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0))',
    zIndex: 0,
  },
}

const glassPanelSx = {
  background: 'rgba(255, 255, 255, 0.78)',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.12)',
  backdropFilter: 'blur(10px)',
}

const glassTableSx = {
  ...glassPanelSx,
  borderRadius: 2,
  overflow: 'hidden',
}

const glassDialogPaperSx = {
  ...glassPanelSx,
  borderRadius: 3,
}

function Sales() {
  const { user } = useAuth()
  const toast = useToast()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canDelete = useMemo(() => ['admin', 'manager'].includes(role), [role])
  const isManager = useMemo(() => role === 'manager', [role])
  const canPurgeDeleted = useMemo(() => role === 'admin', [role])
  const [batches, setBatches] = useState([])
  const [standaloneSales, setStandaloneSales] = useState([])
  const [dispensers, setDispensers] = useState([])
  const [nozzles, setNozzles] = useState([])
  const [meters, setMeters] = useState([])
  const [products, setProducts] = useState([])
  const [employees, setEmployees] = useState([])
  const [openDialog, setOpenDialog] = useState(false)
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const [openDeletedDialog, setOpenDeletedDialog] = useState(false)
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')
  const [editingSale, setEditingSale] = useState(null)
  const [editingSaleIsBatch, setEditingSaleIsBatch] = useState(false)
  const [deletedSales, setDeletedSales] = useState([])
  const [deletedError, setDeletedError] = useState('')
  const [expandedBatchId, setExpandedBatchId] = useState(null)
  const [openBatchEditDialog, setOpenBatchEditDialog] = useState(false)
  const [batchEditError, setBatchEditError] = useState('')
  const [editingBatch, setEditingBatch] = useState(null)
  const [batchEditForm, setBatchEditForm] = useState({
    operator_employee_id: '',
    deposit_cash: '',
    deposit_online: '',
    deposit_credit: '',
    remarks: '',
  })

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState('upsert')
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkPreview, setBulkPreview] = useState(null)

  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [returnSale, setReturnSale] = useState(null)
  const [returnVolume, setReturnVolume] = useState('')
  const [returnToTankId, setReturnToTankId] = useState('')
  const [returnTanks, setReturnTanks] = useState([])
  const [returnBufferTank, setReturnBufferTank] = useState(null)
  const [returnBusy, setReturnBusy] = useState(false)
  const [returnError, setReturnError] = useState('')

  const [editForm, setEditForm] = useState({
    business_date: '',
    shift: 'A',
    operator_employee_id: '',
    deposit_cash: '',
    deposit_online: '',
    remarks: '',
    closing_meter_reading: '',
    quantity: '',
    testing_quantity: '',
  })

  const fetchDeletedSales = async () => {
    setDeletedError('')
    try {
      const res = await api.get('/sales/deleted')
      setDeletedSales(res.data || [])
    } catch (e) {
      setDeletedError(e.response?.data?.detail || 'Failed to load deleted records')
    }
  }

  const downloadSalesTemplate = async (format) => {
    setBulkError('')
    try {
      await downloadApiFile('/bulk/sales/template', {
        params: { format },
        defaultFilename: format === 'csv' ? 'sales_bulk_template.csv' : 'sales_bulk_template.xlsx',
      })
    } catch (e) {
      const detail = e.response?.data?.detail
      setBulkError(typeof detail === 'string' ? detail : 'Failed to download template')
    }
  }

  const openBulkUpload = () => {
    setBulkError('')
    setBulkPreview(null)
    setBulkFile(null)
    setBulkMode('upsert')
    setBulkOpen(true)
  }

  const previewBulkUpload = async () => {
    if (!bulkFile) {
      setBulkError('Please choose a CSV or XLSX file')
      return
    }
    setBulkBusy(true)
    setBulkError('')
    try {
      const form = new FormData()
      form.append('file', bulkFile)
      const res = await api.post('/bulk/sales/preview', form, { headers: { 'X-Suppress-Toast': '1' } })
      setBulkPreview(res.data)
    } catch (e) {
      const detail = e.response?.data?.detail
      setBulkError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to preview upload')
    } finally {
      setBulkBusy(false)
    }
  }

  const commitBulkUpload = async () => {
    if (!bulkPreview?.rows?.length) {
      setBulkError('No valid rows to upload. Fix errors and preview again.')
      return
    }
    if (!window.confirm('Upload these rows to the database now?')) return

    setBulkBusy(true)
    setBulkError('')
    try {
      const res = await api.post(
        '/bulk/sales/commit',
        { rows: bulkPreview.rows, mode: bulkMode, allow_partial: false },
        { headers: { 'X-Suppress-Toast': '1' } }
      )
      toast.showSuccess(`Bulk upload done: ${res.data?.inserted || 0} inserted, ${res.data?.updated || 0} updated.`)
      setBulkOpen(false)
      setBulkPreview(null)
      setBulkFile(null)
      await refreshSales(filters)
    } catch (e) {
      const detail = e.response?.data?.detail
      setBulkError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to commit upload')
    } finally {
      setBulkBusy(false)
    }
  }

  const [filters, setFilters] = useState({
    business_date_from: '',
    business_date_to: '',
    shift: '',
    testing_filter: '',
    operator_employee_id: '',
    dispenser_id: '',
    nozzle_id: '',
    meter_id: '',
    product_id: '',
  })

  const [batchForm, setBatchForm] = useState({
    business_date: todayISO(),
    shift: 'A',
    operator_employee_id: '',
    dispenser_id: '',
    deposit_cash: '',
    deposit_online: '',
    deposit_credit: '',
    remarks: '',
  })
  const [batchLines, setBatchLines] = useState([])

  useEffect(() => {
    refreshSales(filters)
    fetchDispensers()
    fetchNozzles()
    fetchMeters()
    fetchProducts()
    fetchEmployees()
  }, [])

  const fetchBatches = async (activeFilters) => {
    try {
      const params = {}
      const f = activeFilters || {}

      // Dates are YYYY-MM-DD
      if (f.business_date_from) params.business_date_from = f.business_date_from
      if (f.business_date_to) params.business_date_to = f.business_date_to
      if (f.shift) params.shift = f.shift
      if (f.operator_employee_id) params.operator_employee_id = Number(f.operator_employee_id)
      if (f.dispenser_id) params.dispenser_id = Number(f.dispenser_id)
      if (f.nozzle_id) params.nozzle_id = Number(f.nozzle_id)
      if (f.meter_id) params.meter_id = Number(f.meter_id)
      if (f.product_id) params.product_id = Number(f.product_id)

      const response = await api.get('/sales/batches', { params })
      const rows = Array.isArray(response.data) ? response.data : []
      let filtered = rows
      if (f.testing_filter === 'with') {
        filtered = rows.filter((batch) => (batch.lines || []).some((line) => getTestingQty(line) > 0))
      } else if (f.testing_filter === 'without') {
        filtered = rows.filter((batch) => (batch.lines || []).every((line) => getTestingQty(line) <= 0))
      }
      setBatches(filtered)
    } catch (error) {
      console.error('Failed to fetch sales batches:', error)
    }
  }

  const fetchStandaloneSales = async (activeFilters) => {
    try {
      const params = { limit: 5000 }
      const f = activeFilters || {}

      if (f.business_date_from) params.business_date_from = f.business_date_from
      if (f.business_date_to) params.business_date_to = f.business_date_to
      if (f.shift) params.shift = f.shift
      if (f.testing_filter === 'with') params.has_testing = true
      if (f.testing_filter === 'without') params.has_testing = false
      if (f.operator_employee_id) params.operator_employee_id = Number(f.operator_employee_id)
      if (f.dispenser_id) params.dispenser_id = Number(f.dispenser_id)
      if (f.nozzle_id) params.nozzle_id = Number(f.nozzle_id)
      if (f.meter_id) params.meter_id = Number(f.meter_id)
      if (f.product_id) params.product_id = Number(f.product_id)

      const response = await api.get('/sales/', { params })
      const rows = Array.isArray(response.data) ? response.data : []
      setStandaloneSales(rows.filter((sale) => sale.sales_batch_id == null))
    } catch (error) {
      console.error('Failed to fetch standalone sales:', error)
    }
  }

  const refreshSales = async (activeFilters) => {
    await Promise.all([fetchBatches(activeFilters), fetchStandaloneSales(activeFilters)])
  }

  const fetchDispensers = async () => {
    try {
      const response = await api.get('/dispensers/')
      setDispensers(response.data.filter((d) => d.is_active))
    } catch (error) {
      console.error('Failed to fetch dispensers:', error)
    }
  }

  const fetchNozzles = async () => {
    try {
      const response = await api.get('/nozzles/')
      setNozzles(response.data.filter((n) => n.is_active))
    } catch (error) {
      console.error('Failed to fetch nozzles:', error)
    }
  }

  const fetchMeters = async () => {
    try {
      const response = await api.get('/meters/')
      setMeters(response.data.filter((m) => m.is_active))
    } catch (error) {
      console.error('Failed to fetch meters:', error)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees/')
      setEmployees(response.data.filter((e) => e.is_active))
    } catch (error) {
      console.error('Failed to fetch employees:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products/')
      setProducts(response.data)
    } catch (error) {
      console.error('Failed to fetch products:', error)
    }
  }

  const buildBatchLines = (dispenserId) => {
    if (!dispenserId) return []
    const lines = nozzles
      .filter((n) => String(n.dispenser_id) === String(dispenserId))
      .slice()
      .sort((a, b) => String(a.nozzle_number).localeCompare(String(b.nozzle_number)))
      .map((n) => {
        const nozzleMeters = metersByNozzle.get(String(n.id)) || []
        const defaultMeter = nozzleMeters.length === 1 ? nozzleMeters[0] : null
        const defaultMeterId = defaultMeter ? String(defaultMeter.id) : ''
        const defaultClosing = defaultMeter ? String(Number(defaultMeter.last_reading || 0)) : ''
        return {
          nozzle_id: String(n.id),
          meter_id: defaultMeterId,
          closing_meter_reading: defaultClosing,
          quantity: '',
          testing_quantity: '0',
        }
      })
    return lines
  }

  const updateBatchLine = (index, updates) => {
    setBatchLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, ...updates } : line))
    )
  }

  const handleCreateBatch = async () => {
    setError('')
    try {
      const dispenserId = batchForm.dispenser_id ? parseInt(batchForm.dispenser_id) : null
      const operatorId = batchForm.operator_employee_id ? parseInt(batchForm.operator_employee_id) : null
      const depositCash = toNumber(batchForm.deposit_cash)
      const depositOnline = toNumber(batchForm.deposit_online)
      const depositCredit = toNumber(batchForm.deposit_credit)

      if (!batchForm.business_date) {
        setError('Please select a date')
        return
      }
      if (!operatorId) {
        setError('Please select an operator')
        return
      }
      if (!dispenserId) {
        setError('Please select a dispenser')
        return
      }
      if (depositCash < 0 || depositOnline < 0 || depositCredit < 0) {
        setError('Deposit amounts must be 0 or greater.')
        return
      }

      const lines = []
      for (const line of batchLines) {
        if (!line.nozzle_id) continue

        const testingQty = toNumber(line.testing_quantity)
        if (testingQty < 0) {
          setError('Testing quantity must be 0 or greater.')
          return
        }

        if (line.meter_id) {
          const meter = meterById.get(String(line.meter_id))
          if (!meter) {
            setError('Please select a valid meter for each nozzle.')
            return
          }
          const opening = Number(meter.last_reading || 0)
          const closing = line.closing_meter_reading === '' ? opening : Number(line.closing_meter_reading)
          if (!Number.isFinite(closing)) {
            setError('Please enter closing meter readings for all meter lines.')
            return
          }
          const preview = computeDispensedVolume({ opening, closing, maxValue: meter.max_value })
          if (preview.liters == null || preview.liters < 0) {
            setError('Invalid meter readings. Please check opening/closing values.')
            return
          }
          if (testingQty > preview.liters + 1e-6) {
            setError('Testing quantity cannot exceed dispensed quantity.')
            return
          }
          lines.push({
            nozzle_id: parseInt(line.nozzle_id),
            meter_id: parseInt(line.meter_id),
            closing_meter_reading: closing,
            testing_quantity: testingQty,
          })
        } else {
          const salesQty = toNumber(line.quantity)
          if (salesQty < 0) {
            setError('Sales quantity must be 0 or greater.')
            return
          }
          lines.push({
            nozzle_id: parseInt(line.nozzle_id),
            quantity: salesQty,
            testing_quantity: testingQty,
          })
        }
      }

      // Lines must include all nozzles for the selected dispenser; backend validates this.

      const payload = {
        business_date: batchForm.business_date || null,
        shift: batchForm.shift || 'A',
        operator_employee_id: operatorId,
        dispenser_id: dispenserId,
        deposit_cash: depositCash,
        deposit_online: depositOnline,
        deposit_credit: depositCredit,
        remarks: batchForm.remarks || null,
        lines,
      }

      await api.post('/sales/batches', payload, { headers: { 'X-Suppress-Toast': '1' } })
      setOpenDialog(false)
      toast.showSuccess('Shift entry saved successfully')
      setBatchForm({
        business_date: todayISO(),
        shift: 'A',
        operator_employee_id: '',
        dispenser_id: '',
        deposit_cash: '',
        deposit_online: '',
        deposit_credit: '',
        remarks: '',
      })
      setBatchLines([])
      refreshSales(filters)
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to create shift entry')
    }
  }

  const openReturnTesting = async (sale) => {
    setReturnError('')
    setReturnSale(sale)
    const testingQty = getTestingQty(sale)
    setReturnVolume(String(Number(testingQty || 0).toFixed(2)))
    const defaultTankId = nozzleById.get(sale.nozzle_id)?.tank_id
    setReturnToTankId(defaultTankId ? String(defaultTankId) : '')
    setReturnTanks([])
    setReturnBufferTank(null)
    setReturnDialogOpen(true)

    if (!sale.product_id) {
      setReturnError('Testing quantity has no product configured.')
      return
    }

    try {
      const [mainRes, bufRes] = await Promise.all([
        api.get('/tanks/', { params: { product_id: sale.product_id, is_buffer: false } }),
        api.get('/tanks/', { params: { product_id: sale.product_id, is_buffer: true } }),
      ])
      setReturnTanks(mainRes.data || [])
      setReturnBufferTank((bufRes.data || [])[0] || null)
    } catch (e) {
      setReturnError(e.response?.data?.detail || 'Failed to load tanks for return')
    }
  }

  const submitReturnTesting = async () => {
    if (!returnSale) return
    setReturnError('')
    setReturnBusy(true)
    try {
      const payload = {
        volume: parseFloat(returnVolume),
        to_tank_id: returnToTankId ? parseInt(returnToTankId) : null,
      }
      await api.post(`/sales/${returnSale.id}/return-testing-to-main`, payload, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess('Testing returned to main tank successfully')
      setReturnDialogOpen(false)
      setReturnSale(null)
      refreshSales(filters)
    } catch (e) {
      setReturnError(e.response?.data?.detail || 'Failed to return testing to main')
    } finally {
      setReturnBusy(false)
    }
  }

  const selectedBatchDispenser = dispensers.find((d) => String(d.id) === String(batchForm.dispenser_id))
  const nozzlesForBatch = nozzles.filter((n) => String(n.dispenser_id) === String(batchForm.dispenser_id))
  const meterById = useMemo(() => {
    const map = new Map()
    for (const m of meters) map.set(String(m.id), m)
    return map
  }, [meters])
  const metersByNozzle = useMemo(() => {
    const map = new Map()
    for (const m of meters) {
      const key = String(m.nozzle_id)
      const list = map.get(key) || []
      list.push(m)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(a.meter_name).localeCompare(String(b.meter_name)))
    }
    return map
  }, [meters])

  const productById = useMemo(() => {
    const map = new Map()
    for (const p of products) map.set(p.id, p)
    return map
  }, [products])

  const dispenserById = useMemo(() => {
    const map = new Map()
    for (const d of dispensers) map.set(d.id, d)
    return map
  }, [dispensers])

  const nozzleById = useMemo(() => {
    const map = new Map()
    for (const n of nozzles) map.set(n.id, n)
    return map
  }, [nozzles])

  const editingMeter = useMemo(() => {
    if (!editingSale?.meter_id) return null
    return meters.find((m) => String(m.id) === String(editingSale.meter_id)) || null
  }, [editingSale, meters])

  const editTestingQty = toNumber(editForm.testing_quantity)
  const editSalesQty = toNumber(editForm.quantity)
  const editClosingValue =
    editForm.closing_meter_reading === '' ? editingSale?.closing_meter_reading : Number(editForm.closing_meter_reading)
  const editClosingNumber = editClosingValue == null ? NaN : Number(editClosingValue)
  const editOpeningValue = Number(editingSale?.opening_meter_reading || 0)
  const editDispensedPreview = editingSale?.meter_id
    ? computeDispensedVolume({
        opening: editOpeningValue,
        closing: editClosingNumber,
        maxValue: editingMeter?.max_value,
      }).liters
    : null
  const editSalesPreview = editingSale?.meter_id
    ? editDispensedPreview == null
      ? null
      : editDispensedPreview - editTestingQty
    : editSalesQty
  const editDispensedTotal = editingSale?.meter_id ? editDispensedPreview : editSalesQty + editTestingQty
  const editTestingOver = editDispensedPreview != null && editTestingQty > editDispensedPreview + 1e-6
  const isLegacyTesting =
    String(editingSale?.transaction_type || '').toLowerCase() === 'testing' && !editingSale?.meter_id

  const productName = (productId) => {
    const p = productId ? productById.get(productId) : null
    return p ? `${p.product_name} (${p.fuel_type})` : '—'
  }

  const operatorName = (employeeId) => {
    const e = employees.find((x) => String(x.id) === String(employeeId))
    return e?.employee_name || (employeeId ?? '—')
  }

  const getTestingQty = (sale) => {
    if (sale?.testing_quantity != null) return Number(sale.testing_quantity || 0)
    if (String(sale?.transaction_type || '').toLowerCase() === 'testing') return Number(sale?.quantity || 0)
    return 0
  }

  const getSalesQty = (sale) => {
    if (String(sale?.transaction_type || '').toLowerCase() === 'testing') return 0
    return Number(sale?.quantity || 0)
  }

  const getDispensedQty = (sale) => getSalesQty(sale) + getTestingQty(sale)

  const computeLinePreview = (line) => {
    const testingQty = toNumber(line.testing_quantity)
    if (line.meter_id) {
      const meter = meterById.get(String(line.meter_id))
      const opening = Number(meter?.last_reading || 0)
      const closing = line.closing_meter_reading === '' ? NaN : Number(line.closing_meter_reading)
      const { liters, wrap } = computeDispensedVolume({ opening, closing, maxValue: meter?.max_value })
      const salesQty = liters == null ? null : liters - testingQty
      return { opening, dispensed: liters, salesQty, wrap, testingQty }
    }
    const salesQty = toNumber(line.quantity)
    const dispensed = salesQty + testingQty
    return { opening: null, dispensed, salesQty, wrap: false, testingQty }
  }

  const getBatchTotals = (batch) => {
    const lines = batch?.lines || []
    const testing = lines.reduce((sum, line) => sum + getTestingQty(line), 0)
    const sales = lines.reduce((sum, line) => sum + getSalesQty(line), 0)
    const dispensed = testing + sales
    const amount = lines.reduce((sum, line) => sum + Number(line.total_amount || 0), 0)
    const depositCash = Number(batch?.deposit_cash || 0)
    const depositOnline = Number(batch?.deposit_online || 0)
    const depositTotal = Number(batch?.total_deposit || (depositCash + depositOnline))
    const depositCredit = Number(batch?.deposit_credit || 0)
    const accountedTotal = depositTotal + depositCredit
    const variance = accountedTotal - amount
    return { testing, sales, dispensed, amount, depositCash, depositOnline, depositCredit, depositTotal, accountedTotal, variance }
  }

  const toggleBatch = (batchId) => {
    setExpandedBatchId((prev) => (prev === batchId ? null : batchId))
  }

  const entryTotals = useMemo(() => {
    let totalSales = 0
    let totalTesting = 0
    let totalDispensed = 0

    for (const line of batchLines) {
      const preview = computeLinePreview(line)
      const testingQty = preview.testingQty || 0
      const salesQty = line.meter_id ? Math.max(0, preview.salesQty || 0) : toNumber(line.quantity)
      const dispensed = line.meter_id ? Number(preview.dispensed || 0) : salesQty + testingQty

      totalSales += salesQty
      totalTesting += testingQty
      totalDispensed += dispensed
    }

    return { totalSales, totalTesting, totalDispensed }
  }, [batchLines, meterById])

  const exportRows = useMemo(() => {
    return batches.map((batch) => {
      const businessDate = batch.business_date || new Date(batch.created_at).toISOString().slice(0, 10)
      const totals = getBatchTotals(batch)
      return {
        Date: businessDate,
        Shift: batch.shift,
        Operator: operatorName(batch.operator_employee_id),
        'Batch Code': batch.batch_code,
        Dispenser: dispenserById.get(batch.dispenser_id)?.dispenser_number || batch.dispenser_id,
        'Lines': (batch.lines || []).length,
        'Dispensed (L)': totals.dispensed.toFixed(2),
        'Testing (L)': totals.testing.toFixed(2),
        'Sales (L)': totals.sales.toFixed(2),
        'Total (₹)': totals.amount.toFixed(2),
        'Deposit Cash (₹)': totals.depositCash.toFixed(2),
        'Deposit Online (₹)': totals.depositOnline.toFixed(2),
        'Sales on Credit (₹)': totals.depositCredit.toFixed(2),
        'Total Deposit (₹)': totals.depositTotal.toFixed(2),
        'Total Accounted (₹)': totals.accountedTotal.toFixed(2),
        'Variance (₹)': totals.variance.toFixed(2),
        Remarks: batch.remarks || '',
        'Created At': batch.created_at ? new Date(batch.created_at).toLocaleString() : '',
      }
    })
  }, [batches, dispenserById, employees])

  const meterVarianceSummary = useMemo(() => {
    const lines = batches.flatMap((b) => b.lines || [])
    const salesTotal = lines.reduce((sum, line) => sum + Number(line.total_amount || 0), 0)
    const depositTotal = batches.reduce((sum, batch) => sum + getBatchTotals(batch).depositTotal, 0)
    const creditTotal = batches.reduce((sum, batch) => sum + getBatchTotals(batch).depositCredit, 0)
    const accountedTotal = depositTotal + creditTotal
    return {
      salesTotal,
      depositTotal,
      creditTotal,
      accountedTotal,
      variance: accountedTotal - salesTotal,
      count: batches.length,
    }
  }, [batches])

  const openEditSale = (sale) => {
    setEditError('')
    setEditingSale(sale)
    setEditingSaleIsBatch(!!sale?.sales_batch_id)
    setEditForm({
      business_date: sale.business_date || new Date(sale.created_at).toISOString().slice(0, 10),
      shift: sale.shift || 'A',
      operator_employee_id: sale.operator_employee_id ? String(sale.operator_employee_id) : '',
      deposit_cash: sale.deposit_cash == null ? '' : String(sale.deposit_cash),
      deposit_online: sale.deposit_online == null ? '' : String(sale.deposit_online),
      remarks: sale.remarks || '',
      closing_meter_reading: sale.closing_meter_reading == null ? '' : String(sale.closing_meter_reading),
      quantity: sale.quantity == null ? '' : String(sale.quantity),
      testing_quantity: String(getTestingQty(sale) || 0),
    })
    setOpenEditDialog(true)
  }

  const saveEditSale = async () => {
    setEditError('')
    if (!editingSale) return
    if (editTestingQty < 0) {
      setEditError('Testing quantity must be 0 or greater.')
      return
    }
    if (editingSale.meter_id && editTestingOver) {
      setEditError('Testing quantity cannot exceed dispensed quantity.')
      return
    }
    try {
      const payload = {
        closing_meter_reading: editForm.closing_meter_reading === '' ? null : parseFloat(editForm.closing_meter_reading),
        quantity: editForm.quantity === '' ? null : parseFloat(editForm.quantity),
      }
      if (!editingSaleIsBatch) {
        payload.business_date = editForm.business_date || null
        payload.shift = editForm.shift || null
        payload.operator_employee_id = editForm.operator_employee_id ? parseInt(editForm.operator_employee_id) : null
        payload.deposit_cash = editForm.deposit_cash === '' ? null : parseFloat(editForm.deposit_cash)
        payload.deposit_online = editForm.deposit_online === '' ? null : parseFloat(editForm.deposit_online)
        payload.remarks = editForm.remarks
      }
      if (!isLegacyTesting) {
        payload.testing_quantity = editForm.testing_quantity === '' ? 0 : parseFloat(editForm.testing_quantity)
      }
      await api.put(`/sales/${editingSale.id}`, payload)
      setOpenEditDialog(false)
      setEditingSale(null)
      setEditingSaleIsBatch(false)
      refreshSales(filters)
    } catch (e) {
      setEditError(e.response?.data?.detail || 'Failed to update sale')
    }
  }

  const openEditBatch = (batch) => {
    setBatchEditError('')
    setEditingBatch(batch)
    setBatchEditForm({
      operator_employee_id: batch?.operator_employee_id ? String(batch.operator_employee_id) : '',
      deposit_cash: batch?.deposit_cash == null ? '' : String(batch.deposit_cash),
      deposit_online: batch?.deposit_online == null ? '' : String(batch.deposit_online),
      deposit_credit: batch?.deposit_credit == null ? '' : String(batch.deposit_credit),
      remarks: batch?.remarks || '',
    })
    setOpenBatchEditDialog(true)
  }

  const saveBatchEdit = async () => {
    setBatchEditError('')
    if (!editingBatch) return
    try {
      const payload = {
        operator_employee_id: batchEditForm.operator_employee_id ? parseInt(batchEditForm.operator_employee_id) : null,
        deposit_cash: batchEditForm.deposit_cash === '' ? 0 : parseFloat(batchEditForm.deposit_cash),
        deposit_online: batchEditForm.deposit_online === '' ? 0 : parseFloat(batchEditForm.deposit_online),
        deposit_credit: batchEditForm.deposit_credit === '' ? 0 : parseFloat(batchEditForm.deposit_credit),
        remarks: batchEditForm.remarks,
      }
      await api.put(`/sales/batches/${editingBatch.id}`, payload)
      setOpenBatchEditDialog(false)
      setEditingBatch(null)
      refreshSales(filters)
    } catch (e) {
      setBatchEditError(e.response?.data?.detail || 'Failed to update shift entry')
    }
  }

  const deleteSale = async (sale) => {
    setError('')
    const confirmLabel = isManager
      ? `Request deletion for sale entry "${sale.transaction_id}"?`
      : `Delete sale entry "${sale.transaction_id}"?`
    if (!window.confirm(confirmLabel)) return
    try {
      const reason = window.prompt('Optional: enter delete reason (for audit trail):')
      const res = await api.delete(`/sales/${sale.id}`, {
        params: { reason: reason == null ? null : reason },
        headers: { 'X-Suppress-Toast': '1' },
      })
      if (res?.data?.status === 'pending') {
        toast.showInfo('Deletion request sent to admin for approval.')
      } else {
        toast.showSuccess('Sale deleted')
      }
      refreshSales(filters)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete sale')
    }
  }

  const purgeDeletedSale = async (row) => {
    setDeletedError('')
    if (!window.confirm(`Permanently wipe deleted record "${row.transaction_id}"? This cannot be undone.`)) return
    try {
      await api.delete(`/sales/deleted/${row.id}`)
      fetchDeletedSales()
    } catch (e) {
      setDeletedError(e.response?.data?.detail || 'Failed to purge deleted record')
    }
  }


  return (
    <Box sx={pageShellSx}>
      <Container maxWidth={false} sx={{ position: 'relative', zIndex: 1 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
          Sales
        </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, ...glassPanelSx }}>
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
            label="Shift"
            value={filters.shift}
            onChange={(e) => setFilters({ ...filters, shift: e.target.value })}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="A">A</MenuItem>
            <MenuItem value="B">B</MenuItem>
            <MenuItem value="C">C</MenuItem>
          </TextField>

          <TextField
            select
            label="Testing Qty"
            value={filters.testing_filter}
            onChange={(e) => setFilters({ ...filters, testing_filter: e.target.value })}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="with">With Testing</MenuItem>
            <MenuItem value="without">No Testing</MenuItem>
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

          <TextField
            select
            label="Dispenser"
            value={filters.dispenser_id}
            onChange={(e) => setFilters({ ...filters, dispenser_id: e.target.value, nozzle_id: '', meter_id: '' })}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">All</MenuItem>
            {dispensers.map((d) => (
              <MenuItem key={d.id} value={String(d.id)}>
                {d.dispenser_number}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Nozzle"
            value={filters.nozzle_id}
            onChange={(e) => setFilters({ ...filters, nozzle_id: e.target.value, meter_id: '' })}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {nozzles
              .filter((n) => (filters.dispenser_id ? String(n.dispenser_id) === String(filters.dispenser_id) : true))
              .map((n) => (
                <MenuItem key={n.id} value={String(n.id)}>
                  {n.nozzle_number}
                </MenuItem>
              ))}
          </TextField>

          <TextField
            select
            label="Meter"
            value={filters.meter_id}
            onChange={(e) => setFilters({ ...filters, meter_id: e.target.value })}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">All</MenuItem>
            {meters
              .filter((m) => (filters.nozzle_id ? String(m.nozzle_id) === String(filters.nozzle_id) : true))
              .map((m) => (
                <MenuItem key={m.id} value={String(m.id)}>
                  {m.meter_name}
                </MenuItem>
              ))}
          </TextField>

          <TextField
            select
            label="Product"
            value={filters.product_id}
            onChange={(e) => setFilters({ ...filters, product_id: e.target.value })}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">All</MenuItem>
            {products
              .slice()
              .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)))
              .map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.product_name} ({p.fuel_type})
                </MenuItem>
              ))}
          </TextField>

          <Button variant="contained" onClick={() => refreshSales(filters)}>
            Apply
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              const cleared = {
                business_date_from: '',
                business_date_to: '',
                shift: '',
                testing_filter: '',
                operator_employee_id: '',
                dispenser_id: '',
                nozzle_id: '',
                meter_id: '',
                product_id: '',
              }
              setFilters(cleared)
              refreshSales(cleared)
            }}
          >
            Clear
          </Button>

          <Button
            variant="text"
            onClick={() => {
              const today = todayISO()
              const next = { ...filters, business_date_from: today, business_date_to: today }
              setFilters(next)
              refreshSales(next)
            }}
          >
            Today
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setError('')
            setBatchForm({
              business_date: todayISO(),
              shift: 'A',
              operator_employee_id: '',
              dispenser_id: '',
              deposit_cash: '',
              deposit_online: '',
              deposit_credit: '',
              remarks: '',
            })
            setBatchLines([])
            setOpenDialog(true)
          }}
        >
          New Shift Entry
        </Button>
        <Button variant="outlined" onClick={() => refreshSales(filters)}>
          Refresh
        </Button>

        {canPurgeDeleted && (
          <Button variant="outlined" onClick={openBulkUpload}>
            Bulk Upload
          </Button>
        )}

        {(
          <Button
            variant="outlined"
            onClick={() => {
              setOpenDeletedDialog(true)
              fetchDeletedSales()
            }}
          >
            Deleted Records
          </Button>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Button
          variant="outlined"
          onClick={() => exportRowsToCSV(exportRows, { filename: `sales_${todayISO()}.csv` })}
          disabled={!exportRows.length}
        >
          Export CSV
        </Button>
        <Button
          variant="outlined"
          onClick={() => exportRowsToXLSX(exportRows, { filename: `sales_${todayISO()}.xlsx`, sheetName: 'Sales' })}
          disabled={!exportRows.length}
        >
          Export XLSX
        </Button>
        <Button
          variant="outlined"
          onClick={() => exportRowsToPDF(exportRows, { filename: `sales_${todayISO()}.pdf`, title: 'Sales Report' })}
          disabled={!exportRows.length}
        >
          Export PDF
        </Button>
        <Button variant="outlined" onClick={() => viewRowsAsPDF(exportRows, { title: 'Sales Report' })} disabled={!exportRows.length}>
          View PDF
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, ...glassPanelSx }}>
        <Typography variant="h6" gutterBottom>
          Shift Sales vs Accounted
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Typography>Entries: {meterVarianceSummary.count}</Typography>
          <Typography>Sales Total: ₹{meterVarianceSummary.salesTotal.toFixed(2)}</Typography>
          <Typography>Deposit Total: ₹{meterVarianceSummary.depositTotal.toFixed(2)}</Typography>
          <Typography>Sales on Credit: ₹{meterVarianceSummary.creditTotal.toFixed(2)}</Typography>
          <Typography>Accounted Total: ₹{meterVarianceSummary.accountedTotal.toFixed(2)}</Typography>
          <Typography
            sx={{
              color: meterVarianceSummary.variance < 0 ? 'error.main' : meterVarianceSummary.variance > 0 ? 'success.main' : 'text.primary',
              fontWeight: 600,
            }}
          >
            Variance (Accounted − Sales): {formatSignedINR(meterVarianceSummary.variance)}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Negative variance means accounted amount (cash + online + credit) is less than sales (loss). Positive means accounted exceeds sales (gain).
        </Typography>
      </Paper>

      <TableContainer component={Paper} sx={{ ...glassTableSx }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Shift</TableCell>
              <TableCell>Operator</TableCell>
              <TableCell>Batch Code</TableCell>
              <TableCell>Dispenser</TableCell>
              <TableCell>Lines</TableCell>
              <TableCell>Dispensed (L)</TableCell>
              <TableCell>Testing (L)</TableCell>
              <TableCell>Sales (L)</TableCell>
              <TableCell>Total (₹)</TableCell>
              <TableCell>Deposit Cash (₹)</TableCell>
              <TableCell>Deposit Online (₹)</TableCell>
              <TableCell>Sales on Credit (₹)</TableCell>
              <TableCell>Total Deposit (₹)</TableCell>
              <TableCell>Total Accounted (₹)</TableCell>
              <TableCell>Variance (₹)</TableCell>
              <TableCell>Remarks</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {batches.map((batch) => {
              const totals = getBatchTotals(batch)
              const varianceColor = totals.variance < 0 ? 'error.main' : totals.variance > 0 ? 'success.main' : 'text.primary'
              const isExpanded = expandedBatchId === batch.id
              return (
                <React.Fragment key={batch.id}>
                  <TableRow>
                    <TableCell>{batch.business_date || new Date(batch.created_at).toISOString().slice(0, 10)}</TableCell>
                    <TableCell>{batch.shift}</TableCell>
                    <TableCell>{operatorName(batch.operator_employee_id)}</TableCell>
                    <TableCell>{batch.batch_code}</TableCell>
                    <TableCell>{dispenserById.get(batch.dispenser_id)?.dispenser_number || batch.dispenser_id}</TableCell>
                    <TableCell>{(batch.lines || []).length}</TableCell>
                    <TableCell>{totals.dispensed.toFixed(2)}</TableCell>
                    <TableCell>{totals.testing.toFixed(2)}</TableCell>
                    <TableCell>{totals.sales.toFixed(2)}</TableCell>
                    <TableCell>₹{totals.amount.toFixed(2)}</TableCell>
                    <TableCell>₹{totals.depositCash.toFixed(2)}</TableCell>
                    <TableCell>₹{totals.depositOnline.toFixed(2)}</TableCell>
                    <TableCell>₹{totals.depositCredit.toFixed(2)}</TableCell>
                    <TableCell>₹{totals.depositTotal.toFixed(2)}</TableCell>
                    <TableCell>₹{totals.accountedTotal.toFixed(2)}</TableCell>
                    <TableCell sx={{ color: varianceColor, fontWeight: 600 }}>{formatSignedINR(totals.variance)}</TableCell>
                    <TableCell>{batch.remarks || '—'}</TableCell>
                    <TableCell>{batch.created_at ? new Date(batch.created_at).toLocaleString() : '—'}</TableCell>
                    <TableCell align="right">
                      {batch.edited_at && (
                        <Tooltip
                          title={`Edited by ${batch.edited_by_user_id || 'Unknown'} on ${new Date(
                            batch.edited_at
                          ).toLocaleString()}`}
                        >
                          <WarningAmber sx={{ mr: 1, verticalAlign: 'middle' }} color="warning" fontSize="small" />
                        </Tooltip>
                      )}
                      <Button size="small" onClick={() => toggleBatch(batch.id)}>
                        {isExpanded ? 'Hide Lines' : 'View Lines'}
                      </Button>
                      <Button size="small" onClick={() => openEditBatch(batch)}>
                        Edit Entry
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={19} sx={{ p: 0, backgroundColor: 'rgba(148, 163, 184, 0.08)' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Nozzle</TableCell>
                              <TableCell>Product</TableCell>
                              <TableCell>Meter</TableCell>
                              <TableCell>Opening</TableCell>
                              <TableCell>Closing</TableCell>
                              <TableCell>Dispensed (L)</TableCell>
                              <TableCell>Testing (L)</TableCell>
                              <TableCell>Sales (L)</TableCell>
                              <TableCell>Price (₹/L)</TableCell>
                              <TableCell>Total (₹)</TableCell>
                              <TableCell align="right">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(batch.lines || []).map((line) => {
                              const salesQty = getSalesQty(line)
                              const testingQty = getTestingQty(line)
                              const dispensedQty = salesQty + testingQty
                              return (
                                <TableRow key={line.id}>
                                  <TableCell>{nozzleById.get(line.nozzle_id)?.nozzle_number || (line.nozzle_id ?? '—')}</TableCell>
                                  <TableCell>
                                    {(() => {
                                      const p = line.product_id ? productById.get(line.product_id) : null
                                      if (p) return `${p.product_name} (${p.fuel_type})`
                                      return line.fuel_type ? String(line.fuel_type) : '—'
                                    })()}
                                  </TableCell>
                                  <TableCell>{line.meter_id ? meterById.get(String(line.meter_id))?.meter_name || line.meter_id : 'Manual'}</TableCell>
                                  <TableCell>{line.opening_meter_reading == null ? '—' : Number(line.opening_meter_reading).toFixed(2)}</TableCell>
                                  <TableCell>{line.closing_meter_reading == null ? '—' : Number(line.closing_meter_reading).toFixed(2)}</TableCell>
                                  <TableCell>{dispensedQty.toFixed(2)}</TableCell>
                                  <TableCell>{testingQty.toFixed(2)}</TableCell>
                                  <TableCell>{salesQty.toFixed(2)}</TableCell>
                                  <TableCell>₹{Number(line.price_per_liter || 0).toFixed(2)}</TableCell>
                                  <TableCell>₹{Number(line.total_amount || 0).toFixed(2)}</TableCell>
                                  <TableCell align="right">
                                    <Button size="small" onClick={() => openEditSale(line)}>
                                      Edit
                                    </Button>
                                    {canDelete && getTestingQty(line) > 0 && (
                                      <Button size="small" color="secondary" onClick={() => openReturnTesting(line)}>
                                        Return Testing → Main
                                      </Button>
                                    )}
                                    {canDelete && (
                                      <Button size="small" color="error" onClick={() => deleteSale(line)}>
                                        {isManager ? 'Request Delete' : 'Delete'}
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                            {!(batch.lines || []).length && (
                              <TableRow>
                                <TableCell colSpan={11}>
                                  <Alert severity="info">No line items.</Alert>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
            {!batches.length && (
              <TableRow>
                <TableCell colSpan={19}>
                  <Alert severity="info">No shift entries found.</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 3, mb: 1 }}>
        <Typography variant="h6" gutterBottom>
          Standalone Sales Entries
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sales saved outside shift entries appear here and are not included in shift totals.
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ ...glassTableSx, mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Shift</TableCell>
              <TableCell>Operator</TableCell>
              <TableCell>Transaction ID</TableCell>
              <TableCell>Dispenser</TableCell>
              <TableCell>Nozzle</TableCell>
              <TableCell>Meter</TableCell>
              <TableCell>Product</TableCell>
              <TableCell align="right">Dispensed (L)</TableCell>
              <TableCell align="right">Testing (L)</TableCell>
              <TableCell align="right">Sales (L)</TableCell>
              <TableCell align="right">Total (Rs)</TableCell>
              <TableCell align="right">Deposit Cash (Rs)</TableCell>
              <TableCell align="right">Deposit Online (Rs)</TableCell>
              <TableCell align="right">Total Deposit (Rs)</TableCell>
              <TableCell>Remarks</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {standaloneSales.map((sale) => {
              const salesQty = getSalesQty(sale)
              const testingQty = getTestingQty(sale)
              const dispensedQty = salesQty + testingQty
              const depositCash = Number(sale.deposit_cash || 0)
              const depositOnline = Number(sale.deposit_online || 0)
              const depositTotal = sale.total_deposit == null ? (depositCash + depositOnline) : Number(sale.total_deposit || 0)
              return (
                <TableRow key={sale.id}>
                  <TableCell>{sale.business_date || new Date(sale.created_at).toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{sale.shift || '-'}</TableCell>
                  <TableCell>{operatorName(sale.operator_employee_id)}</TableCell>
                  <TableCell>{sale.transaction_id || '-'}</TableCell>
                  <TableCell>{dispenserById.get(sale.dispenser_id)?.dispenser_number || (sale.dispenser_id ?? '-')}</TableCell>
                  <TableCell>{nozzleById.get(sale.nozzle_id)?.nozzle_number || (sale.nozzle_id ?? '-')}</TableCell>
                  <TableCell>{sale.meter_id ? meterById.get(String(sale.meter_id))?.meter_name || sale.meter_id : 'Manual'}</TableCell>
                  <TableCell>{productName(sale.product_id)}</TableCell>
                  <TableCell align="right">{dispensedQty.toFixed(2)}</TableCell>
                  <TableCell align="right">{testingQty.toFixed(2)}</TableCell>
                  <TableCell align="right">{salesQty.toFixed(2)}</TableCell>
                  <TableCell align="right">Rs {Number(sale.total_amount || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">Rs {depositCash.toFixed(2)}</TableCell>
                  <TableCell align="right">Rs {depositOnline.toFixed(2)}</TableCell>
                  <TableCell align="right">Rs {depositTotal.toFixed(2)}</TableCell>
                  <TableCell>{sale.remarks || '-'}</TableCell>
                  <TableCell>{sale.created_at ? new Date(sale.created_at).toLocaleString() : '-'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEditSale(sale)}>
                      Edit
                    </Button>
                    {canDelete && getTestingQty(sale) > 0 && (
                      <Button size="small" color="secondary" onClick={() => openReturnTesting(sale)}>
                        Return Testing to Main
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="small" color="error" onClick={() => deleteSale(sale)}>
                        {isManager ? 'Request Delete' : 'Delete'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {!standaloneSales.length && (
              <TableRow>
                <TableCell colSpan={18}>
                  <Alert severity="info">No standalone sales entries found.</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={openEditDialog}
        onClose={() => {
          setOpenEditDialog(false)
          setEditingSale(null)
          setEditingSaleIsBatch(false)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: glassDialogPaperSx }}
      >
        <DialogTitle>Edit Sale Entry</DialogTitle>
        <DialogContent>
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          )}
          <Alert severity="warning" sx={{ mb: 2 }}>
            {editingSaleIsBatch
              ? 'This line belongs to a shift entry. Edit deposits/remarks from the entry row.'
              : 'You can edit shift-closing fields, and also correct closing meter reading/testing quantity (meter entries) or sales/testing quantity (manual entries).'}
          </Alert>

          {editingSale?.meter_id ? (
            <>
              <TextField
                fullWidth
                label="Opening Reading"
                value={editingSale.opening_meter_reading == null ? '0.00' : Number(editingSale.opening_meter_reading).toFixed(2)}
                margin="normal"
                InputProps={{ readOnly: true }}
              />
              <TextField
                fullWidth
                label="Closing Reading"
                type="number"
                value={editForm.closing_meter_reading}
                onChange={(e) => setEditForm({ ...editForm, closing_meter_reading: e.target.value })}
                margin="normal"
                helperText="Only the latest entry for this meter can be edited. Quantity will be recalculated."
              />
              <TextField
                fullWidth
                label="Total Dispensed (L)"
                value={editDispensedTotal == null ? '0.00' : Number(editDispensedTotal || 0).toFixed(2)}
                margin="normal"
                InputProps={{ readOnly: true }}
              />
              <TextField
                fullWidth
                label="Testing Quantity (L)"
                type="number"
                value={editForm.testing_quantity}
                onChange={(e) => setEditForm({ ...editForm, testing_quantity: e.target.value })}
                margin="normal"
                inputProps={{ min: 0, step: '0.01' }}
                error={editTestingOver}
                helperText={
                  editTestingOver
                    ? 'Testing quantity cannot exceed dispensed quantity.'
                    : 'Testing volume is moved to the buffer tank.'
                }
              />
              <TextField
                fullWidth
                label="Sales Quantity (L)"
                value={
                  editSalesPreview == null ? '0.00' : Math.max(0, Number(editSalesPreview || 0)).toFixed(2)
                }
                margin="normal"
                InputProps={{ readOnly: true }}
              />
            </>
          ) : (
            <>
              <TextField
                fullWidth
                label={isLegacyTesting ? 'Quantity (L)' : 'Sales Quantity (L)'}
                type="number"
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                margin="normal"
                inputProps={{ min: 0, step: '0.01' }}
                helperText={
                  isLegacyTesting
                    ? 'Legacy testing entry: quantity represents testing volume.'
                    : 'Manual entries: sales quantity updates tank/inventory accordingly.'
                }
              />
              <TextField
                fullWidth
                label="Testing Quantity (L)"
                type="number"
                value={editForm.testing_quantity}
                onChange={(e) => setEditForm({ ...editForm, testing_quantity: e.target.value })}
                margin="normal"
                inputProps={{ min: 0, step: '0.01' }}
                helperText={
                  isLegacyTesting ? 'Legacy testing entries cannot update testing quantity.' : 'Testing volume is moved to the buffer tank.'
                }
                disabled={isLegacyTesting}
              />
              <TextField
                fullWidth
                label="Total Dispensed (L)"
                value={Number(editDispensedTotal || 0).toFixed(2)}
                margin="normal"
                InputProps={{ readOnly: true }}
              />
            </>
          )}

          {!editingSaleIsBatch && (
            <>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Date"
                  type="date"
                  value={editForm.business_date}
                  onChange={(e) => setEditForm({ ...editForm, business_date: e.target.value })}
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 200 }}
                />
                <TextField
                  select
                  label="Shift"
                  value={editForm.shift}
                  onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
                  margin="normal"
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="A">A</MenuItem>
                  <MenuItem value="B">B</MenuItem>
                  <MenuItem value="C">C</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Operator"
                  value={editForm.operator_employee_id}
                  onChange={(e) => setEditForm({ ...editForm, operator_employee_id: e.target.value })}
                  margin="normal"
                  sx={{ minWidth: 240, flex: 1 }}
                >
                  <MenuItem value="">—</MenuItem>
                  {employees
                    .slice()
                    .sort((a, b) => String(a.employee_name).localeCompare(String(b.employee_name)))
                    .map((emp) => (
                      <MenuItem key={emp.id} value={String(emp.id)}>
                        {emp.employee_name}
                      </MenuItem>
                    ))}
                </TextField>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Deposit Cash"
                  type="number"
                  value={editForm.deposit_cash}
                  onChange={(e) => setEditForm({ ...editForm, deposit_cash: e.target.value })}
                  margin="normal"
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  sx={{ minWidth: 240, flex: 1 }}
                />
                <TextField
                  label="Deposit Online"
                  type="number"
                  value={editForm.deposit_online}
                  onChange={(e) => setEditForm({ ...editForm, deposit_online: e.target.value })}
                  margin="normal"
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  sx={{ minWidth: 240, flex: 1 }}
                />
              </Box>

              <TextField
                fullWidth
                label="Remarks"
                value={editForm.remarks}
                onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                margin="normal"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenEditDialog(false)
              setEditingSale(null)
              setEditingSaleIsBatch(false)
            }}
          >
            Cancel
          </Button>
          <Button onClick={saveEditSale} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openBatchEditDialog}
        onClose={() => {
          setOpenBatchEditDialog(false)
          setEditingBatch(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: glassDialogPaperSx }}
      >
        <DialogTitle>Edit Shift Entry</DialogTitle>
        <DialogContent>
          {batchEditError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {batchEditError}
            </Alert>
          )}

          <TextField
            select
            fullWidth
            label="Operator"
            value={batchEditForm.operator_employee_id}
            onChange={(e) => setBatchEditForm({ ...batchEditForm, operator_employee_id: e.target.value })}
            margin="normal"
          >
            <MenuItem value="">—</MenuItem>
            {employees
              .slice()
              .sort((a, b) => String(a.employee_name).localeCompare(String(b.employee_name)))
              .map((emp) => (
                <MenuItem key={emp.id} value={String(emp.id)}>
                  {emp.employee_name}
                </MenuItem>
              ))}
          </TextField>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Deposit Cash"
              type="number"
              value={batchEditForm.deposit_cash}
              onChange={(e) => setBatchEditForm({ ...batchEditForm, deposit_cash: e.target.value })}
              margin="normal"
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ minWidth: 240, flex: 1 }}
            />
            <TextField
              label="Deposit Online"
              type="number"
              value={batchEditForm.deposit_online}
              onChange={(e) => setBatchEditForm({ ...batchEditForm, deposit_online: e.target.value })}
              margin="normal"
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ minWidth: 240, flex: 1 }}
            />
            <TextField
              label="Sales on Credit"
              type="number"
              value={batchEditForm.deposit_credit}
              onChange={(e) => setBatchEditForm({ ...batchEditForm, deposit_credit: e.target.value })}
              margin="normal"
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ minWidth: 200, flex: 1 }}
            />
            <TextField
              label="Total Deposit"
              value={(Number(batchEditForm.deposit_cash || 0) + Number(batchEditForm.deposit_online || 0)).toFixed(2)}
              margin="normal"
              InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ minWidth: 200 }}
            />
            <TextField
              label="Total Accounted"
              value={(Number(batchEditForm.deposit_cash || 0) + Number(batchEditForm.deposit_online || 0) + Number(batchEditForm.deposit_credit || 0)).toFixed(2)}
              margin="normal"
              InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ minWidth: 200 }}
            />
          </Box>

          <TextField
            fullWidth
            label="Remarks"
            value={batchEditForm.remarks}
            onChange={(e) => setBatchEditForm({ ...batchEditForm, remarks: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenBatchEditDialog(false)
              setEditingBatch(null)
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={saveBatchEdit}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={returnDialogOpen} onClose={() => (returnBusy ? null : setReturnDialogOpen(false))} maxWidth="sm" fullWidth PaperProps={{ sx: glassDialogPaperSx }}>
        <DialogTitle>Return Testing to Main</DialogTitle>
        <DialogContent>
          {returnError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {returnError}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            This moves fuel from the virtual buffer back into a main tank. It does not affect deliveries.
          </Alert>

          <Typography variant="body2" color="text.secondary">
            Product: {returnSale?.product_id ? productById.get(returnSale.product_id)?.product_name || returnSale.product_id : '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Buffer available (L): {returnBufferTank ? Number(returnBufferTank.current_volume || 0).toFixed(2) : '—'}
          </Typography>

          <TextField
            select
            fullWidth
            margin="normal"
            label="Destination Main Tank"
            value={returnToTankId}
            onChange={(e) => setReturnToTankId(e.target.value)}
          >
            {returnTanks.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.tank_name} (vol {Number(t.current_volume || 0).toFixed(2)})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            margin="normal"
            type="number"
            label="Return Volume (L)"
            value={returnVolume}
            onChange={(e) => setReturnVolume(e.target.value)}
            inputProps={{ min: 0, step: '0.01' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnDialogOpen(false)} disabled={returnBusy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitReturnTesting} disabled={returnBusy || !returnToTankId || !returnVolume}>
            {returnBusy ? 'Saving…' : 'Return to Main'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeletedDialog} onClose={() => setOpenDeletedDialog(false)} maxWidth="lg" fullWidth PaperProps={{ sx: glassDialogPaperSx }}>
        <DialogTitle>Deleted Sales Records</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Sales deletions are moved here first. Use “Wipe” to permanently remove a deleted record.
          </Alert>
          {deletedError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deletedError}
            </Alert>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ ...glassTableSx }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Deleted At</TableCell>
                  <TableCell>Transaction ID</TableCell>
                  <TableCell>Testing (L)</TableCell>
                  <TableCell>Sales (L)</TableCell>
                  <TableCell>Amount (₹)</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deletedSales.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.deleted_at ? new Date(r.deleted_at).toLocaleString() : '—'}</TableCell>
                    <TableCell>{r.transaction_id}</TableCell>
                    <TableCell>{getTestingQty(r).toFixed(2)}</TableCell>
                    <TableCell>{getSalesQty(r).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(r.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>{r.delete_reason || '—'}</TableCell>
                    <TableCell align="right">
                      {canPurgeDeleted ? (
                        <Button size="small" color="error" onClick={() => purgeDeletedSale(r)}>
                          Wipe
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!deletedSales.length && (
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

      <Dialog open={bulkOpen} onClose={() => (bulkBusy ? null : setBulkOpen(false))} maxWidth="lg" fullWidth PaperProps={{ sx: glassDialogPaperSx }}>
        <DialogTitle>Sales Bulk Upload (Backfill / Update)</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This bulk upload is for backfilling / correcting sales history. It only inserts/updates sales rows (no inventory/tank/meter recalculations).
          </Alert>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Button variant="outlined" onClick={() => downloadSalesTemplate('xlsx')} disabled={bulkBusy}>
              Download XLSX Template
            </Button>
            <Button variant="outlined" onClick={() => downloadSalesTemplate('csv')} disabled={bulkBusy}>
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
              <MenuItem value="upsert">Upsert (by transaction_id when present)</MenuItem>
              <MenuItem value="insert_only">Insert only</MenuItem>
              <MenuItem value="update_only">Update only (requires transaction_id)</MenuItem>
            </TextField>

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
                {bulkPreview.errors?.length ? ' Fix errors and re-upload.' : ' Ready to upload.'}
              </Alert>

              {!!bulkPreview.errors?.length && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Errors (first 20)</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ ...glassTableSx }}>
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
              <TableContainer component={Paper} variant="outlined" sx={{ ...glassTableSx }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Shift</TableCell>
                      <TableCell>Transaction ID</TableCell>
                      <TableCell>Dispenser</TableCell>
                      <TableCell>Nozzle</TableCell>
                      <TableCell>Meter</TableCell>
                      <TableCell>Fuel</TableCell>
                      <TableCell align="right">Dispensed</TableCell>
                      <TableCell align="right">Testing</TableCell>
                      <TableCell align="right">Sales</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Deposit</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(bulkPreview.rows || []).slice(0, 50).map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{r.business_date || '—'}</TableCell>
                        <TableCell>{r.shift || '—'}</TableCell>
                        <TableCell>{r.transaction_id || '—'}</TableCell>
                        <TableCell>{r.dispenser_id}</TableCell>
                        <TableCell>{r.nozzle_id || '—'}</TableCell>
                        <TableCell>{r.meter_id || '—'}</TableCell>
                        <TableCell>{r.fuel_type}</TableCell>
                        <TableCell align="right">{Number(r.dispensed_quantity || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">{Number(r.testing_quantity || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">{Number(r.quantity || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(r.price_per_liter || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(r.total_deposit || 0).toFixed(2)}</TableCell>
                        <TableCell>{r.remarks || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!bulkPreview.rows?.length && (
                      <TableRow>
                        <TableCell colSpan={12}>
                          <Alert severity="info">No valid rows to preview.</Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {(bulkPreview.rows || []).length > 50 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Showing first 50 rows here. All valid rows will be uploaded.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)} disabled={bulkBusy}>
            Close
          </Button>
          <Button variant="contained" onClick={commitBulkUpload} disabled={bulkBusy || !bulkPreview?.rows?.length || (bulkPreview?.errors?.length || 0) > 0}>
            {bulkBusy ? 'Uploading…' : 'Confirm Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth PaperProps={{ sx: glassDialogPaperSx }}>
        <DialogTitle>Shift Closing Entry (Dispenser-wise)</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Date"
              type="date"
              value={batchForm.business_date}
              onChange={(e) => setBatchForm({ ...batchForm, business_date: e.target.value })}
              margin="normal"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
              required
            />
            <TextField
              select
              label="Shift"
              value={batchForm.shift}
              onChange={(e) => setBatchForm({ ...batchForm, shift: e.target.value })}
              margin="normal"
              sx={{ minWidth: 120 }}
              required
            >
              <MenuItem value="A">A</MenuItem>
              <MenuItem value="B">B</MenuItem>
              <MenuItem value="C">C</MenuItem>
            </TextField>
            <TextField
              select
              label="Operator"
              value={batchForm.operator_employee_id}
              onChange={(e) => setBatchForm({ ...batchForm, operator_employee_id: e.target.value })}
              margin="normal"
              sx={{ minWidth: 260, flex: 1 }}
              required
            >
              {employees
                .slice()
                .sort((a, b) => String(a.employee_name).localeCompare(String(b.employee_name)))
                .map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.employee_name}
                  </MenuItem>
                ))}
            </TextField>
          </Box>

          <TextField
            select
            fullWidth
            label="Dispenser"
            value={batchForm.dispenser_id}
            onChange={(e) => {
              const dispenserId = e.target.value
              setBatchForm({ ...batchForm, dispenser_id: dispenserId })
              setBatchLines(buildBatchLines(dispenserId))
            }}
            margin="normal"
            required
          >
            {dispensers
              .slice()
              .sort((a, b) => String(a.dispenser_number).localeCompare(String(b.dispenser_number)))
              .map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.dispenser_number}
                </MenuItem>
              ))}
          </TextField>

          {!!batchForm.dispenser_id && (
            <>
              <Alert severity="info" sx={{ mt: 2, mb: 1 }}>
                Enter readings/quantities for all nozzles of this dispenser. Leave values as-is for unused nozzles (0 movement).
              </Alert>

              <TableContainer component={Paper} variant="outlined" sx={{ ...glassTableSx, mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nozzle</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Meter</TableCell>
                      <TableCell align="right">Closing</TableCell>
                      <TableCell align="right">Sales (L)</TableCell>
                      <TableCell align="right">Testing (L)</TableCell>
                      <TableCell align="right">Dispensed (L)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchLines.map((line, idx) => {
                      const nozzle = nozzleById.get(Number(line.nozzle_id))
                      const metersForNozzle = metersByNozzle.get(String(line.nozzle_id)) || []
                      const p = nozzle?.product_id ? productById.get(nozzle.product_id) : null
                      const preview = computeLinePreview(line)
                      const dispensed = line.meter_id ? (preview.dispensed == null ? 0 : Number(preview.dispensed)) : Number((toNumber(line.quantity) + toNumber(line.testing_quantity)) || 0)
                      const salesQty = line.meter_id ? Math.max(0, Number(preview.salesQty || 0)) : toNumber(line.quantity)
                      return (
                        <TableRow key={String(line.nozzle_id)}>
                          <TableCell>{nozzle ? `Nozzle ${nozzle.nozzle_number}` : line.nozzle_id}</TableCell>
                          <TableCell>{p ? `${p.product_name} (${p.fuel_type})` : '—'}</TableCell>
                          <TableCell>
                            <TextField
                              select
                              size="small"
                              value={line.meter_id}
                              onChange={(e) => {
                                const nextMeterId = e.target.value
                                const meter = nextMeterId ? meterById.get(String(nextMeterId)) : null
                                updateBatchLine(idx, {
                                  meter_id: nextMeterId,
                                  closing_meter_reading: meter ? String(Number(meter.last_reading || 0)) : '',
                                })
                              }}
                              sx={{ minWidth: 220 }}
                            >
                              <MenuItem value="">Manual (no meter)</MenuItem>
                              {metersForNozzle.map((m) => (
                                <MenuItem key={m.id} value={String(m.id)}>
                                  {m.meter_name} (last {Number(m.last_reading || 0).toFixed(2)}{m.max_value ? ` / ${Number(m.max_value).toFixed(2)}` : ''})
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              disabled={!line.meter_id}
                              value={line.closing_meter_reading}
                              onChange={(e) => updateBatchLine(idx, { closing_meter_reading: e.target.value })}
                              inputProps={{ step: '0.01' }}
                              sx={{ maxWidth: 140 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              disabled={!!line.meter_id}
                              value={line.quantity}
                              onChange={(e) => updateBatchLine(idx, { quantity: e.target.value })}
                              inputProps={{ min: 0, step: '0.01' }}
                              sx={{ maxWidth: 120 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={line.testing_quantity}
                              onChange={(e) => updateBatchLine(idx, { testing_quantity: e.target.value })}
                              inputProps={{ min: 0, step: '0.01' }}
                              sx={{ maxWidth: 120 }}
                            />
                          </TableCell>
                          <TableCell align="right">{Number(dispensed || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      )
                    })}
                    {!batchLines.length && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Alert severity="info">No nozzles found for this dispenser.</Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <TextField
                  label="Deposit (Cash)"
                  type="number"
                  value={batchForm.deposit_cash}
                  onChange={(e) => setBatchForm({ ...batchForm, deposit_cash: e.target.value })}
                  margin="normal"
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  sx={{ minWidth: 220, flex: 1 }}
                />
                <TextField
                  label="Deposit (Online)"
                  type="number"
                  value={batchForm.deposit_online}
                  onChange={(e) => setBatchForm({ ...batchForm, deposit_online: e.target.value })}
                  margin="normal"
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  sx={{ minWidth: 220, flex: 1 }}
                />
                <TextField
                  label="Sales on Credit"
                  type="number"
                  value={batchForm.deposit_credit}
                  onChange={(e) => setBatchForm({ ...batchForm, deposit_credit: e.target.value })}
                  margin="normal"
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  sx={{ minWidth: 220, flex: 1 }}
                />
                <TextField
                  label="Total Deposit"
                  value={(toNumber(batchForm.deposit_cash) + toNumber(batchForm.deposit_online)).toFixed(2)}
                  margin="normal"
                  InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  sx={{ minWidth: 220 }}
                />
                <TextField
                  label="Total Accounted"
                  value={(toNumber(batchForm.deposit_cash) + toNumber(batchForm.deposit_online) + toNumber(batchForm.deposit_credit)).toFixed(2)}
                  margin="normal"
                  InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  sx={{ minWidth: 220 }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Total Sales (L)"
                  value={entryTotals.totalSales.toFixed(2)}
                  margin="normal"
                  InputProps={{ readOnly: true }}
                  sx={{ minWidth: 220 }}
                />
                <TextField
                  label="Total Testing (L)"
                  value={entryTotals.totalTesting.toFixed(2)}
                  margin="normal"
                  InputProps={{ readOnly: true }}
                  sx={{ minWidth: 220 }}
                />
                <TextField
                  label="Total Dispensed (L)"
                  value={entryTotals.totalDispensed.toFixed(2)}
                  margin="normal"
                  InputProps={{ readOnly: true }}
                  sx={{ minWidth: 220 }}
                />
              </Box>

              <TextField
                fullWidth
                label="Remarks"
                value={batchForm.remarks}
                onChange={(e) => setBatchForm({ ...batchForm, remarks: e.target.value })}
                margin="normal"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateBatch} variant="contained" disabled={!batchForm.dispenser_id || !batchLines.length}>
            Save Shift Entry
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </Box>
  )
}
export default Sales
