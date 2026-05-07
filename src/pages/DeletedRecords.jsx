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
import { useToast } from '../context/ToastContext'

const sources = [
  {
    key: 'sales',
    label: 'Sales',
    listPath: '/sales/deleted',
    listParams: { limit: 500 },
    deletePath: (id) => `/sales/deleted/${id}`,
    mapRow: (row) => ({
      label: row.transaction_id ? `Sale ${row.transaction_id}` : `Sale ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'tanker_receipts',
    label: 'Tanker Receipts',
    listPath: '/tanker-receipts/deleted',
    deletePath: (id) => `/tanker-receipts/deleted/${id}`,
    mapRow: (row) => ({
      label: row.invoice_no
        ? `Receipt ${row.tanker_no || row.id} (${row.invoice_no})`
        : `Receipt ${row.tanker_no || row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'products',
    label: 'Products',
    listPath: '/products/deleted',
    deletePath: (id) => `/products/deleted/${id}`,
    mapRow: (row) => ({
      label: row.label || `Product ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'customers',
    label: 'Customers',
    listPath: '/customers/deleted',
    deletePath: (id) => `/customers/deleted/${id}`,
    mapRow: (row) => ({
      label: row.label || `Customer ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'employees',
    label: 'Employees',
    listPath: '/employees/deleted',
    deletePath: (id) => `/employees/deleted/${id}`,
    mapRow: (row) => ({
      label: row.label || `Employee ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'designations',
    label: 'Designations',
    listPath: '/designations/deleted',
    deletePath: (id) => `/designations/deleted/${id}`,
    mapRow: (row) => ({
      label: row.label || `Designation ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'dispensers',
    label: 'Dispensers',
    listPath: '/dispensers/deleted',
    deletePath: (id) => `/dispensers/deleted/${id}`,
    mapRow: (row) => ({
      label: row.label || `Dispenser ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'nozzles',
    label: 'Nozzles',
    listPath: '/nozzles/deleted',
    deletePath: (id) => `/nozzles/deleted/${id}`,
    mapRow: (row) => ({
      label: row.label || `Nozzle ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'meters',
    label: 'Meters',
    listPath: '/meters/deleted',
    deletePath: (id) => `/meters/deleted/${id}`,
    mapRow: (row) => ({
      label: row.label || `Meter ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
  {
    key: 'tanks',
    label: 'Tanks',
    listPath: '/tanks/deleted',
    deletePath: (id) => `/tanks/deleted/${id}`,
    mapRow: (row) => ({
      label: row.label || `Tank ${row.id}`,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by_username || row.deleted_by_user_id || '-',
    }),
  },
]

function toDisplayDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

function DeletedRecords() {
  const toast = useToast()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [deletingKey, setDeletingKey] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    setError('')

    const results = await Promise.allSettled(
      sources.map((source) => api.get(source.listPath, { params: source.listParams || {} }))
    )

    const items = []
    const failures = []

    results.forEach((result, index) => {
      const source = sources[index]
      if (result.status === 'fulfilled') {
        const rows = Array.isArray(result.value.data) ? result.value.data : []
        rows.forEach((row) => {
          const mapped = source.mapRow(row)
          items.push({
            key: `${source.key}-${row.id}`,
            id: row.id,
            type: source.label,
            label: mapped.label,
            deleted_at: mapped.deleted_at,
            deleted_by: mapped.deleted_by,
            deletePath: source.deletePath(row.id),
          })
        })
      } else {
        failures.push(source.label)
      }
    })

    items.sort((a, b) => {
      const aTime = a.deleted_at ? new Date(a.deleted_at).getTime() : 0
      const bTime = b.deleted_at ? new Date(b.deleted_at).getTime() : 0
      return bTime - aTime
    })

    setRecords(items)
    if (failures.length) {
      setError(`Failed to load: ${failures.join(', ')}`)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase()
    return records.filter((record) => {
      if (filterType !== 'all' && record.type !== filterType) return false
      if (!searchLower) return true
      return (
        String(record.label || '').toLowerCase().includes(searchLower)
        || String(record.id || '').includes(searchLower)
      )
    })
  }, [records, filterType, search])

  const handleDelete = async (record) => {
    if (!record) return
    if (!window.confirm(`Permanently delete ${record.type} "${record.label}"? This cannot be undone.`)) return

    setDeletingKey(record.key)
    setError('')
    try {
      await api.delete(record.deletePath)
      setRecords((prev) => prev.filter((item) => item.key !== record.key))
      toast.showSuccess('Deleted permanently')
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete record')
    } finally {
      setDeletingKey('')
    }
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Deleted Records
      </Typography>

      <Alert severity="warning" sx={{ mb: 2 }}>
        Permanently deleting a record removes it from the database and cannot be undone.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            label="Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All</MenuItem>
            {sources.map((source) => (
              <MenuItem key={source.key} value={source.label}>
                {source.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 240 }}
          />
          <Button variant="contained" onClick={fetchAll} disabled={loading}>
            Refresh
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Total: {filtered.length} record(s)
          </Typography>
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
              <TableCell>Type</TableCell>
              <TableCell>Label</TableCell>
              <TableCell>Deleted At</TableCell>
              <TableCell>Deleted By</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((record) => (
              <TableRow key={record.key}>
                <TableCell>{record.type}</TableCell>
                <TableCell>{record.label}</TableCell>
                <TableCell>{toDisplayDate(record.deleted_at)}</TableCell>
                <TableCell>{record.deleted_by || '-'}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(record)}
                    disabled={deletingKey === record.key}
                  >
                    {deletingKey === record.key ? 'Deleting...' : 'Delete Permanently'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && !loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Alert severity="info">No deleted records found.</Alert>
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Alert severity="info">Loading...</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  )
}

export default DeletedRecords
