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
} from '@mui/material'
import api from '../services/api'
import { exportRowsToCSV, exportRowsToPDF, exportRowsToXLSX, viewRowsAsPDF } from '../utils/exporting'

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

function numberSigned(value) {
  const n = Number(value || 0)
  if (n < 0) return `-${Math.abs(n).toFixed(2)}`
  return `${n.toFixed(2)}`
}

function Reports() {
  const today = todayISO()
  const [filters, setFilters] = useState({ from_date: today, to_date: today })
  const [dataset, setDataset] = useState('summary')
  const [productId, setProductId] = useState('')
  const [products, setProducts] = useState([])
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const fetchReport = async (activeFilters, activeDataset) => {
    setError('')
    try {
      const f = activeFilters || {}
      const params = {}
      if (f.from_date) params.from_date = f.from_date
      if (f.to_date) params.to_date = f.to_date

      const ds = activeDataset || dataset

      const selectedProductId = productId ? Number(productId) : null
      if ((ds === 'mass_balance' || ds === 'tanker_receipts') && selectedProductId) {
        params.product_id = selectedProductId
      }

      if (ds === 'tanker_receipts') {
        const res = await api.get('/reports/tanker-receipts-range', { params })
        setData(res.data)
        return
      }

      if (ds === 'mass_balance') {
        const res = await api.get('/reports/mass-balance-range', { params })
        setData(res.data)
        return
      }

      const res = await api.get('/reports/sales-range', { params })
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load reports')
    }
  }

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get('/products/')
        setProducts(res.data || [])
      } catch {
        setProducts([])
      }
    }
    loadProducts()
  }, [])

  useEffect(() => {
    fetchReport(filters, dataset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchReport(filters, dataset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset])

  useEffect(() => {
    if (dataset === 'mass_balance' || dataset === 'tanker_receipts') {
      fetchReport(filters, dataset)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const exportRows = useMemo(() => {
    if (!data) return []

    if (dataset === 'summary') {
      const totalAccounted = Number(data.total_accounted ?? (Number(data.total_deposit || 0) + Number(data.deposit_credit || 0)))
      const variance = totalAccounted - Number(data.total_revenue || 0)
      return [
        {
          From: data.from_date,
          To: data.to_date,
          Transactions: data.total_transactions,
          'Quantity (L)': Number(data.total_quantity || 0).toFixed(2),
          'Revenue (₹)': Number(data.total_revenue || 0).toFixed(2),
          'Deposit Cash (₹)': Number(data.deposit_cash || 0).toFixed(2),
          'Deposit Online (₹)': Number(data.deposit_online || 0).toFixed(2),
          'Sales on Credit (₹)': Number(data.deposit_credit || 0).toFixed(2),
          'Total Deposit (₹)': Number(data.total_deposit || 0).toFixed(2),
          'Total Accounted (₹)': Number(totalAccounted || 0).toFixed(2),
          'Variance (₹)': Number(variance || 0).toFixed(2),
        },
      ]
    }

    if (dataset === 'by_fuel') {
      return (data.by_fuel_type || []).map((r) => ({
        Category: r.fuel_type,
        'Quantity (L)': Number(r.quantity || 0).toFixed(2),
        'Revenue (₹)': Number(r.revenue || 0).toFixed(2),
        'Deposit (₹)': Number(r.deposit || 0).toFixed(2),
      }))
    }

    if (dataset === 'performance') {
      return (data.dispenser_performance || []).map((r) => ({
        Dispenser: r.dispenser_number,
        Nozzle: r.nozzle_number ?? '—',
        Product: r.product_name ? `${r.product_name} (${r.fuel_type})` : r.fuel_type || '—',
        Transactions: r.transactions,
        'Quantity (L)': Number(r.quantity || 0).toFixed(2),
        'Revenue (₹)': Number(r.revenue || 0).toFixed(2),
        'Deposit (₹)': Number(r.deposit || 0).toFixed(2),
      }))
    }

    if (dataset === 'tanker_receipts') {
      return (data.by_product || []).map((r) => ({
        Product: r.product_name || r.product_id,
        Category: r.fuel_type,
        'Invoice Qty (L)': Number(r.invoice_qty || 0).toFixed(2),
        'Received Qty (L)': Number(r.received_qty || 0).toFixed(2),
        'Difference (L)': Number(r.difference_qty || 0).toFixed(2),
      }))
    }

    if (dataset === 'mass_balance') {
      return (data.rows || []).map((r) => ({
        Date: r.date,
        Product: r.product_name || r.product_id,
        Category: r.fuel_type,
        'Main Opening (L)': Number(r.main_opening_stock || 0).toFixed(2),
        'Buffer Opening (L)': Number(r.buffer_opening_stock || 0).toFixed(2),
        'Receipt Main (L)': Number(r.receipt_main || 0).toFixed(2),
        'Receipt Buffer (L)': Number(r.receipt_buffer || 0).toFixed(2),
        'Receipt Total (L)': Number(r.receipt || 0).toFixed(2),
        'Sales (L)': Number((r.sales ?? r.deliveries) || 0).toFixed(2),
        'Testing (L)': Number(r.testings || 0).toFixed(2),
        'Buffer→Main (L)': Number(r.buffer_to_main || 0).toFixed(2),
        'Book Closing Stock (L)': Number(r.book_closing_stock || 0).toFixed(2),
        'Physical Closing Main (L)': Number(r.main_physical_closing_stock || 0).toFixed(2),
        'Physical Closing Buffer (L)': Number(r.buffer_physical_closing_stock || 0).toFixed(2),
        'Physical Closing Total (L)': Number(r.physical_closing_stock || 0).toFixed(2),
        'Variance (L)': Number(r.variance || 0).toFixed(2),
      }))
    }

    return []
  }, [data, dataset])

  const exportBase = useMemo(() => {
    const from = data?.from_date || filters.from_date || today
    const to = data?.to_date || filters.to_date || today
    const suffix = from === to ? from : `${from}_to_${to}`
    return `report_${dataset}_${suffix}`
  }, [data, filters.from_date, filters.to_date, dataset, today])

  const headerTitle = useMemo(() => {
    if (dataset === 'tanker_receipts') return 'Tanker Receipts (Product-wise)'
    if (dataset === 'mass_balance') return 'Tank Mass Balance (Product-wise)'
    if (dataset === 'performance') return 'Dispenser Performance'
    if (dataset === 'by_fuel') return 'By Category'
    return 'Summary'
  }, [dataset])

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Reports & Analytics
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="From"
            type="date"
            value={filters.from_date}
            onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="To"
            type="date"
            value={filters.to_date}
            onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
          <Button variant="contained" onClick={() => fetchReport(filters, dataset)}>
            Apply
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              const next = { from_date: today, to_date: today }
              setFilters(next)
              fetchReport(next, dataset)
            }}
          >
            Today
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <TextField
            select
            label="Dataset"
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            sx={{ minWidth: 260 }}
            size="small"
          >
            <MenuItem value="summary">Summary</MenuItem>
            <MenuItem value="by_fuel">By Category</MenuItem>
            <MenuItem value="performance">Dispenser Performance</MenuItem>
            <MenuItem value="tanker_receipts">Tanker Receipts (Product-wise)</MenuItem>
            <MenuItem value="mass_balance">Tank Mass Balance (Product-wise)</MenuItem>
          </TextField>

          {(dataset === 'mass_balance' || dataset === 'tanker_receipts') && (
            <TextField
              select
              label="Product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              sx={{ minWidth: 220 }}
              size="small"
            >
              <MenuItem value="">All Products</MenuItem>
              {products.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.product_name}
                </MenuItem>
              ))}
            </TextField>
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
            onClick={() => exportRowsToXLSX(exportRows, { filename: `${exportBase}.xlsx`, sheetName: 'Report' })}
            disabled={!exportRows.length}
          >
            Export XLSX
          </Button>
          <Button
            variant="outlined"
            onClick={() => exportRowsToPDF(exportRows, { filename: `${exportBase}.pdf`, title: headerTitle })}
            disabled={!exportRows.length}
          >
            Export PDF
          </Button>
          <Button
            variant="outlined"
            onClick={() => viewRowsAsPDF(exportRows, { title: headerTitle })}
            disabled={!exportRows.length}
          >
            View PDF
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {data && dataset === 'summary' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Summary ({data.from_date} → {data.to_date})
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {(() => {
              const totalAccounted = Number(
                data.total_accounted ?? (Number(data.total_deposit || 0) + Number(data.deposit_credit || 0))
              )
              const variance = totalAccounted - Number(data.total_revenue || 0)
              return (
                <>
                  <Typography>Transactions: {data.total_transactions}</Typography>
                  <Typography>Quantity: {Number(data.total_quantity || 0).toFixed(2)} L</Typography>
                  <Typography>Revenue: ₹{Number(data.total_revenue || 0).toFixed(2)}</Typography>
                  <Typography>Total Deposit: ₹{Number(data.total_deposit || 0).toFixed(2)}</Typography>
                  <Typography>Sales on Credit: ₹{Number(data.deposit_credit || 0).toFixed(2)}</Typography>
                  <Typography>Total Accounted: ₹{Number(totalAccounted || 0).toFixed(2)}</Typography>
                  <Typography
                    sx={{
                      color: variance < 0 ? 'error.main' : variance > 0 ? 'success.main' : 'text.primary',
                      fontWeight: 600,
                    }}
                  >
                    Variance (Accounted − Revenue): {formatSignedINR(variance)}
                  </Typography>
                  <Typography>Deposit Cash: ₹{Number(data.deposit_cash || 0).toFixed(2)}</Typography>
                  <Typography>Deposit Online: ₹{Number(data.deposit_online || 0).toFixed(2)}</Typography>
                </>
              )
            })()}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Note: Sales totals exclude testing quantity.
          </Typography>
        </Paper>
      )}

      {data && dataset === 'tanker_receipts' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Tanker Receipts (Product-wise) ({data.from_date} → {data.to_date})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Confirmed receipts totals per product (invoice vs tank-received).
          </Typography>
        </Paper>
      )}

      {data && dataset === 'mass_balance' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Tank Mass Balance (Product-wise) ({data.from_date} → {data.to_date})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Variance = Physical Closing − Book Closing. Book Closing = Opening + Receipt − Deliveries + Buffer.
          </Typography>
        </Paper>
      )}

      {data && dataset === 'by_fuel' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            By Category ({data.from_date} → {data.to_date})
          </Typography>
        </Paper>
      )}

      {data && dataset === 'performance' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Dispenser Performance ({data.from_date} → {data.to_date})
          </Typography>
        </Paper>
      )}

      {data && dataset === 'by_fuel' && (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell align="right">Quantity (L)</TableCell>
                <TableCell align="right">Revenue (₹)</TableCell>
                <TableCell align="right">Deposit (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.by_fuel_type || []).map((r) => (
                <TableRow key={String(r.fuel_type)}>
                  <TableCell>{r.fuel_type}</TableCell>
                  <TableCell align="right">{Number(r.quantity || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.revenue || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.deposit || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {!data.by_fuel_type?.length && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Alert severity="info">No records for selected range.</Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data && dataset === 'performance' && (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Dispenser</TableCell>
                <TableCell>Nozzle</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="right">Transactions</TableCell>
                <TableCell align="right">Quantity (L)</TableCell>
                <TableCell align="right">Revenue (₹)</TableCell>
                <TableCell align="right">Deposit (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.dispenser_performance || []).map((r, idx) => (
                <TableRow key={`${r.dispenser_number}-${r.nozzle_number}-${r.product_name}-${idx}`}>
                  <TableCell>{r.dispenser_number}</TableCell>
                  <TableCell>{r.nozzle_number ?? '—'}</TableCell>
                  <TableCell>{r.product_name ? `${r.product_name} (${r.fuel_type})` : r.fuel_type || '—'}</TableCell>
                  <TableCell align="right">{r.transactions}</TableCell>
                  <TableCell align="right">{Number(r.quantity || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.revenue || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.deposit || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {!data.dispenser_performance?.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Alert severity="info">No records for selected range.</Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data && dataset === 'tanker_receipts' && (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Invoice Qty (L)</TableCell>
                <TableCell align="right">Received Qty (L)</TableCell>
                <TableCell align="right">Difference (L)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.by_product || []).map((r, idx) => {
                const diff = Number(r.difference_qty || 0)
                return (
                  <TableRow key={idx}>
                    <TableCell>{r.product_name || r.product_id}</TableCell>
                    <TableCell>{r.fuel_type || '—'}</TableCell>
                    <TableCell align="right">{Number(r.invoice_qty || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.received_qty || 0).toFixed(2)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: diff < 0 ? 'error.main' : diff > 0 ? 'success.main' : 'text.primary',
                        fontWeight: 700,
                      }}
                    >
                      {numberSigned(diff)}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!data.by_product?.length && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Alert severity="info">No receipts for selected range.</Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data && dataset === 'mass_balance' && (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Main Opening</TableCell>
                <TableCell align="right">Buffer Opening</TableCell>
                <TableCell align="right">Receipt Main</TableCell>
                <TableCell align="right">Receipt Buffer</TableCell>
                <TableCell align="right">Receipt Total</TableCell>
                <TableCell align="right">Sales</TableCell>
                <TableCell align="right">Testing to Buffer</TableCell>
                <TableCell align="right">Buffer→Main</TableCell>
                <TableCell align="right">Book Closing</TableCell>
                <TableCell align="right">Physical Main</TableCell>
                <TableCell align="right">Physical Buffer</TableCell>
                <TableCell align="right">Physical Total</TableCell>
                <TableCell align="right">Variance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.rows || []).map((r, idx) => {
                const variance = Number(r.variance || 0)
                return (
                  <TableRow key={idx}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.product_name || r.product_id}</TableCell>
                    <TableCell>{r.fuel_type || '—'}</TableCell>
                    <TableCell align="right">{Number(r.main_opening_stock || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.buffer_opening_stock || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.receipt_main || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.receipt_buffer || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.receipt || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number((r.sales ?? r.deliveries) || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.testings || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.buffer_to_main || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.book_closing_stock || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.main_physical_closing_stock || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.buffer_physical_closing_stock || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(r.physical_closing_stock || 0).toFixed(2)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: variance < 0 ? 'error.main' : variance > 0 ? 'success.main' : 'text.primary',
                        fontWeight: 700,
                      }}
                    >
                      {numberSigned(variance)}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!data.rows?.length && (
                <TableRow>
                  <TableCell colSpan={16}>
                    <Alert severity="info">No mass balance rows for selected range.</Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!data && !error && (
        <Alert severity="info">Loading…</Alert>
      )}
    </Container>
  )
}
export default Reports
