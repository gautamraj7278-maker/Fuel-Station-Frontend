import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
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
  InputAdornment,
} from '@mui/material'
import { Save } from '@mui/icons-material'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function ProductPrices() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])
  const [searchParams] = useSearchParams()

  const [products, setProducts] = useState([])
  const [latestRows, setLatestRows] = useState([])
  const [historyRows, setHistoryRows] = useState([])

  const [selectedProductId, setSelectedProductId] = useState('')
  const [pricePerLiter, setPricePerLiter] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(todayISO())
  const [remarks, setRemarks] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const productById = useMemo(() => {
    const map = new Map()
    products.forEach((p) => map.set(p.id, p))
    return map
  }, [products])

  const latestByProductId = useMemo(() => {
    const map = new Map()
    latestRows.forEach((r) => map.set(r.product_id, r))
    return map
  }, [latestRows])

  const fetchBase = async () => {
    setError('')
    try {
      const [pRes, lRes] = await Promise.all([api.get('/products/'), api.get('/product-prices/latest')])
      setProducts(pRes.data)
      setLatestRows(lRes.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load products/prices')
    }
  }

  const fetchHistory = async (pid) => {
    if (!pid) {
      setHistoryRows([])
      return
    }
    setError('')
    try {
      const res = await api.get('/product-prices/', { params: { product_id: pid, limit: 200 } })
      setHistoryRows(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load price history')
    }
  }

  useEffect(() => {
    fetchBase()
  }, [])

  // If navigated from Products page, preselect via ?product_id=
  useEffect(() => {
    const pid = searchParams.get('product_id')
    if (pid) setSelectedProductId(String(pid))
  }, [searchParams])

  useEffect(() => {
    fetchHistory(selectedProductId ? Number(selectedProductId) : null)
  }, [selectedProductId])

  const handleSave = async () => {
    setError('')
    setSuccess('')

    const pid = Number(selectedProductId)
    if (!pid) {
      setError('Please select a product')
      return
    }

    const price = Number(pricePerLiter)
    if (!Number.isFinite(price) || price <= 0) {
      setError('Please enter a valid price per liter')
      return
    }

    try {
      await api.post('/product-prices/', {
        product_id: pid,
        price_per_liter: price,
        effective_date: effectiveDate || null,
        remarks: remarks || null,
      })
      setSuccess('Price updated successfully')
      setPricePerLiter('')
      setRemarks('')

      await fetchBase()
      await fetchHistory(pid)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save product price')
    }
  }

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Product Prices
        </Typography>
        <Alert severity="info">Only Admin can manage product prices.</Alert>
      </Container>
    )
  }

  const currentTableRows = products
    .slice()
    .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)))
    .map((p) => {
      const latest = latestByProductId.get(p.id)
      return { product: p, latest }
    })

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Product Prices
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={fetchBase}>
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Update Daily Price
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            label="Product"
            value={selectedProductId}
            onChange={(e) => {
              const next = e.target.value
              setSelectedProductId(next)
              const pid = Number(next)
              const latest = latestByProductId.get(pid)
              if (latest?.price_per_liter != null) {
                setPricePerLiter(String(latest.price_per_liter))
              } else {
                setPricePerLiter('')
              }
            }}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="" disabled>
              Select product...
            </MenuItem>
            {products
              .slice()
              .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)))
              .map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.product_name} ({p.fuel_type})
                </MenuItem>
              ))}
          </TextField>

          <TextField
            label="Price per liter"
            value={pricePerLiter}
            onChange={(e) => setPricePerLiter(e.target.value)}
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            sx={{ width: 220 }}
          />

          <TextField
            label="Effective date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 200 }}
          />

          <TextField
            label="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            sx={{ minWidth: 280, flex: 1 }}
          />

          <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
            Save
          </Button>
        </Box>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Current Prices
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Current Price (₹/L)</TableCell>
              <TableCell>Effective Date</TableCell>
              <TableCell>Remarks</TableCell>
              <TableCell>Updated At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentTableRows.map(({ product, latest }) => (
              <TableRow
                key={product.id}
                hover
                onClick={() => setSelectedProductId(String(product.id))}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>{product.product_name}</TableCell>
                <TableCell>{product.fuel_type}</TableCell>
                <TableCell>{latest ? `₹${Number(latest.price_per_liter).toFixed(2)}` : '-'}</TableCell>
                <TableCell>{latest?.effective_date || '-'}</TableCell>
                <TableCell>{latest?.remarks || '-'}</TableCell>
                <TableCell>{latest?.created_at ? new Date(latest.created_at).toLocaleString() : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" gutterBottom>
        Price History
      </Typography>
      <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
        Select a product above (or click a row in Current Prices) to view history.
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Effective Date</TableCell>
              <TableCell>Price (₹/L)</TableCell>
              <TableCell>Remarks</TableCell>
              <TableCell>Created By (User ID)</TableCell>
              <TableCell>Created At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {historyRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  {selectedProductId
                    ? 'No price history found for this product.'
                    : 'No product selected.'}
                </TableCell>
              </TableRow>
            ) : (
              historyRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.effective_date}</TableCell>
                  <TableCell>₹{Number(r.price_per_liter).toFixed(2)}</TableCell>
                  <TableCell>{r.remarks || '-'}</TableCell>
                  <TableCell>{r.created_by_user_id ?? '-'}</TableCell>
                  <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedProductId && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Showing history for: {productById.get(Number(selectedProductId))?.product_name || `Product #${selectedProductId}`}
          </Typography>
        </Box>
      )}
    </Container>
  )
}

export default ProductPrices
