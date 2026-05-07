import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
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
import { useAuth } from '../context/AuthContext'

const shiftCodes = ['A', 'B', 'C']

function Shifts() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])

  const [rows, setRows] = useState([])
  const [current, setCurrent] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setError('')
    try {
      const [listRes, curRes] = await Promise.all([api.get('/shifts/'), api.get('/shifts/current')])
      setRows(listRes.data)
      setCurrent(curRes.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load shifts')
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const rowByShift = useMemo(() => {
    const map = new Map()
    for (const r of rows) map.set(r.shift, r)
    return map
  }, [rows])

  const [form, setForm] = useState({
    A: { start_time: '06:00:00', end_time: '14:00:00' },
    B: { start_time: '14:00:00', end_time: '22:00:00' },
    C: { start_time: '22:00:00', end_time: '06:00:00' },
  })

  useEffect(() => {
    // hydrate from API
    if (!rows.length) return
    const next = { ...form }
    for (const c of shiftCodes) {
      const r = rowByShift.get(c)
      if (r) next[c] = { start_time: r.start_time, end_time: r.end_time }
    }
    setForm(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length])

  const saveShift = async (shift) => {
    setSaving(true)
    setError('')
    try {
      await api.post('/shifts/', {
        shift,
        start_time: form[shift].start_time,
        end_time: form[shift].end_time,
        is_active: true,
        remarks: null,
      })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || `Failed to save shift ${shift}`)
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Shift Timings
        </Typography>
        <Alert severity="info">Only Admin can configure shifts.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Shift Timings
      </Typography>

      {current && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Current shift: {current.shift} | Business date: {current.business_date}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Shift</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shiftCodes.map((s) => (
              <TableRow key={s}>
                <TableCell>{s}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={form[s].start_time}
                    onChange={(e) => setForm({ ...form, [s]: { ...form[s], start_time: e.target.value } })}
                    helperText="HH:MM:SS"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={form[s].end_time}
                    onChange={(e) => setForm({ ...form, [s]: { ...form[s], end_time: e.target.value } })}
                    helperText="HH:MM:SS"
                  />
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button size="small" variant="contained" disabled={saving} onClick={() => saveShift(s)}>
                      Save
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  )
}

export default Shifts
