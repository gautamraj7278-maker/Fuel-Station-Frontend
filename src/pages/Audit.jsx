import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  MenuItem,
  Paper,
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { exportRowsToCSV, exportRowsToPDF, exportRowsToXLSX } from '../utils/exporting'

function Audit() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])

  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [pathContains, setPathContains] = useState('')
  const [username, setUsername] = useState('')
  const [fromDt, setFromDt] = useState('')
  const [toDt, setToDt] = useState('')
  const [method, setMethod] = useState('')
  const [success, setSuccess] = useState('')
  const [statusMin, setStatusMin] = useState('')
  const [statusMax, setStatusMax] = useState('')
  const [limit, setLimit] = useState(200)

  const fetchLogs = async () => {
    setError('')
    try {
      const params = {
        limit: Number(limit) || 200,
        offset: 0,
      }
      if (pathContains.trim()) params.path_contains = pathContains.trim()
      if (username.trim()) params.username = username.trim()
      if (fromDt) params.from_dt = fromDt
      if (toDt) params.to_dt = toDt
      if (method) params.method = method
      if (success !== '') params.success = success === 'true'
      if (statusMin !== '') params.status_min = Number(statusMin)
      if (statusMax !== '') params.status_max = Number(statusMax)

      const res = await api.get('/audit/', { params })
      setRows(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load audit logs')
    }
  }

  useEffect(() => {
    if (canManage) fetchLogs()
  }, [canManage])

  const exportRows = useMemo(() => {
    return rows.map((r) => ({
      Time: r.created_at ? new Date(r.created_at).toLocaleString() : '',
      User: r.username || '-',
      Method: r.method,
      Path: r.path,
      Status: r.status_code,
      Result: r.success ? 'OK' : 'Error',
      'Error Detail': r.error_detail || '',
    }))
  }, [rows])

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Audit
        </Typography>
        <Alert severity="info">Only Admin can view audit logs.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Audit
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="From"
            type="datetime-local"
            value={fromDt}
            onChange={(e) => setFromDt(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="To"
            type="datetime-local"
            value={toDt}
            onChange={(e) => setToDt(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 220 }}
          />

          <TextField
            select
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="GET">GET</MenuItem>
            <MenuItem value="POST">POST</MenuItem>
            <MenuItem value="PUT">PUT</MenuItem>
            <MenuItem value="PATCH">PATCH</MenuItem>
            <MenuItem value="DELETE">DELETE</MenuItem>
          </TextField>

          <TextField
            select
            label="Result"
            value={success}
            onChange={(e) => setSuccess(e.target.value)}
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">OK</MenuItem>
            <MenuItem value="false">Error</MenuItem>
          </TextField>

          <TextField
            label="Status min"
            type="number"
            value={statusMin}
            onChange={(e) => setStatusMin(e.target.value)}
            size="small"
            sx={{ width: 120 }}
          />
          <TextField
            label="Status max"
            type="number"
            value={statusMax}
            onChange={(e) => setStatusMax(e.target.value)}
            size="small"
            sx={{ width: 120 }}
          />

          <TextField
            label="Limit"
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 200)}
            size="small"
            sx={{ width: 110 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Path contains"
            value={pathContains}
            onChange={(e) => setPathContains(e.target.value)}
            size="small"
          />
          <TextField
            label="Username contains"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            size="small"
          />
          <Button variant="contained" onClick={fetchLogs}>
            Apply
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setFromDt('')
              setToDt('')
              setMethod('')
              setSuccess('')
              setStatusMin('')
              setStatusMax('')
              setPathContains('')
              setUsername('')
              setLimit(200)
              setTimeout(fetchLogs, 0)
            }}
          >
            Clear
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="outlined"
            onClick={() => exportRowsToCSV(exportRows, { filename: 'audit.csv' })}
            disabled={!exportRows.length}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            onClick={() => exportRowsToXLSX(exportRows, { filename: 'audit.xlsx', sheetName: 'Audit' })}
            disabled={!exportRows.length}
          >
            Export XLSX
          </Button>
          <Button
            variant="outlined"
            onClick={() => exportRowsToPDF(exportRows, { filename: 'audit.pdf', title: 'Audit Logs' })}
            disabled={!exportRows.length}
          >
            Export PDF
          </Button>
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
              <TableCell>Time</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Path</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Error Detail</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.username || '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={r.method} />
                </TableCell>
                <TableCell sx={{ maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.path}
                </TableCell>
                <TableCell>{r.status_code}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={r.success ? 'OK' : 'Error'}
                    color={r.success ? 'success' : 'error'}
                    variant={r.success ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.error_detail || ''}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Alert severity="info">No audit logs found.</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Note: Audit captures all write actions (POST/PUT/PATCH/DELETE) and unexpected server errors.
        </Typography>
      </Box>
    </Container>
  )
}

export default Audit
