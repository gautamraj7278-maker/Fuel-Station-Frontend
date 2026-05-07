import React, { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import { Add, Delete, ExpandMore } from '@mui/icons-material'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function Dispensers() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])

  const [dispensers, setDispensers] = useState([])
  const [nozzles, setNozzles] = useState([])
  const [meters, setMeters] = useState([])
  const [products, setProducts] = useState([])
  const [tanks, setTanks] = useState([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [editingDispenser, setEditingDispenser] = useState(null)
  const [editingNozzle, setEditingNozzle] = useState(null)
  const [editingMeter, setEditingMeter] = useState(null)

  const [dispenserDialogOpen, setDispenserDialogOpen] = useState(false)
  const [nozzleDialogOpen, setNozzleDialogOpen] = useState(false)
  const [meterDialogOpen, setMeterDialogOpen] = useState(false)

  const [newDispenser, setNewDispenser] = useState({ dispenser_number: '', is_active: true })
  const [newNozzle, setNewNozzle] = useState({
    dispenser_id: '',
    nozzle_number: '',
    product_id: '',
    tank_id: '',
    is_active: true,
  })
  const [newMeter, setNewMeter] = useState({ nozzle_id: '', meter_name: '', max_value: '', last_reading: 0, is_active: true })

  const fetchAll = async () => {
    setError('')
    setInfo('')
    try {
      const dRes = await api.get('/dispensers/')
      const dispenserList = Array.isArray(dRes.data) ? dRes.data : []
      setDispensers(dispenserList)

      if (dispenserList.length === 0) {
        setNozzles([])
        setMeters([])
        setInfo('No dispensers added yet. Click “Add Dispenser” to get started.')

        const [prodRes, tankRes] = await Promise.allSettled([
          api.get('/products/'),
          api.get('/tanks/'),
        ])
        setProducts(prodRes.status === 'fulfilled' ? prodRes.value.data : [])
        setTanks(tankRes.status === 'fulfilled' ? tankRes.value.data : [])
        return
      }

      const [nRes, mRes, prodRes, tankRes] = await Promise.allSettled([
        api.get('/nozzles/'),
        api.get('/meters/'),
        api.get('/products/'),
        api.get('/tanks/'),
      ])
      setNozzles(nRes.status === 'fulfilled' ? nRes.value.data : [])
      setMeters(mRes.status === 'fulfilled' ? mRes.value.data : [])
      setProducts(prodRes.status === 'fulfilled' ? prodRes.value.data : [])
      setTanks(tankRes.status === 'fulfilled' ? tankRes.value.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load dispensers/nozzles/meters')
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const productById = useMemo(() => {
    const map = new Map()
    for (const p of products) map.set(p.id, p)
    return map
  }, [products])

  const tankById = useMemo(() => {
    const map = new Map()
    for (const t of tanks) map.set(t.id, t)
    return map
  }, [tanks])

  const nozzlesByDispenser = useMemo(() => {
    const map = new Map()
    for (const n of nozzles) {
      const list = map.get(n.dispenser_id) || []
      list.push(n)
      map.set(n.dispenser_id, list)
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => String(a.nozzle_number).localeCompare(String(b.nozzle_number)))
      map.set(k, list)
    }
    return map
  }, [nozzles])

  const metersByNozzle = useMemo(() => {
    const map = new Map()
    for (const m of meters) {
      const list = map.get(m.nozzle_id) || []
      list.push(m)
      map.set(m.nozzle_id, list)
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => String(a.meter_name).localeCompare(String(b.meter_name)))
      map.set(k, list)
    }
    return map
  }, [meters])

  const openCreateDispenser = () => {
    setEditingDispenser(null)
    setNewDispenser({ dispenser_number: '', is_active: true })
    setDispenserDialogOpen(true)
  }

  const openEditDispenser = (d) => {
    setEditingDispenser(d)
    setNewDispenser({
      dispenser_number: d.dispenser_number || '',
      is_active: !!d.is_active,
    })
    setDispenserDialogOpen(true)
  }

  const handleSaveDispenser = async () => {
    setError('')
    try {
      if (editingDispenser) {
        await api.put(`/dispensers/${editingDispenser.id}`, {
          dispenser_number: newDispenser.dispenser_number,
          is_active: !!newDispenser.is_active,
        })
      } else {
        await api.post('/dispensers/', newDispenser)
      }

      setDispenserDialogOpen(false)
      setEditingDispenser(null)
      setNewDispenser({ dispenser_number: '', is_active: true })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save dispenser')
    }
  }

  const handleToggleDispenser = async (d) => {
    setError('')
    try {
      await api.put(`/dispensers/${d.id}`, { is_active: !d.is_active })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update dispenser')
    }
  }

  const handleDeleteDispenser = async (d) => {
    setError('')
    if (!window.confirm(`Delete dispenser "${d.dispenser_number}"?`)) return
    try {
      await api.delete(`/dispensers/${d.id}`)
      fetchAll()
    } catch (e) {
      const detail = e.response?.data?.detail
      if (e.response?.status === 400 && typeof detail === 'string' && detail.toLowerCase().includes('deactivate')) {
        const ok = window.confirm(`${detail}\n\nDo you want to deactivate this dispenser instead?`)
        if (ok) {
          try {
            await api.put(`/dispensers/${d.id}`, { is_active: false })
            fetchAll()
            return
          } catch (e2) {
            setError(e2.response?.data?.detail || 'Failed to deactivate dispenser')
            return
          }
        }
      }
      setError(detail || 'Failed to delete dispenser')
    }
  }

  const openCreateNozzle = () => {
    setEditingNozzle(null)
    setNewNozzle({
      dispenser_id: '',
      nozzle_number: '',
      product_id: '',
      tank_id: '',
      is_active: true,
    })
    setNozzleDialogOpen(true)
  }

  const openEditNozzle = (n) => {
    setEditingNozzle(n)
    setNewNozzle({
      dispenser_id: String(n.dispenser_id ?? ''),
      nozzle_number: n.nozzle_number || '',
      product_id: String(n.product_id ?? ''),
      tank_id: String(n.tank_id ?? ''),
      is_active: !!n.is_active,
    })
    setNozzleDialogOpen(true)
  }

  const handleSaveNozzle = async () => {
    setError('')
    try {
      if (editingNozzle) {
        await api.put(`/nozzles/${editingNozzle.id}`, {
          nozzle_number: newNozzle.nozzle_number,
          product_id: newNozzle.product_id === '' ? null : parseInt(newNozzle.product_id),
          tank_id: newNozzle.tank_id === '' ? null : parseInt(newNozzle.tank_id),
          is_active: !!newNozzle.is_active,
        })
      } else {
        await api.post('/nozzles/', {
          dispenser_id: parseInt(newNozzle.dispenser_id),
          nozzle_number: newNozzle.nozzle_number,
          product_id: parseInt(newNozzle.product_id),
          tank_id: parseInt(newNozzle.tank_id),
          is_active: !!newNozzle.is_active,
        })
      }
      setNozzleDialogOpen(false)
      setNewNozzle({ dispenser_id: '', nozzle_number: '', product_id: '', tank_id: '', is_active: true })
      setEditingNozzle(null)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save nozzle')
    }
  }

  const openCreateMeter = () => {
    setEditingMeter(null)
    setNewMeter({ nozzle_id: '', meter_name: '', max_value: '', last_reading: 0, is_active: true })
    setMeterDialogOpen(true)
  }

  const openEditMeter = (m) => {
    setEditingMeter(m)
    setNewMeter({
      nozzle_id: String(m.nozzle_id ?? ''),
      meter_name: m.meter_name || '',
      max_value: m.max_value ?? '',
      last_reading: m.last_reading ?? 0,
      is_active: !!m.is_active,
    })
    setMeterDialogOpen(true)
  }

  const handleToggleNozzle = async (n) => {
    setError('')
    try {
      await api.put(`/nozzles/${n.id}`, { is_active: !n.is_active })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update nozzle')
    }
  }

  const handleDeleteNozzle = async (n) => {
    setError('')
    if (!window.confirm(`Delete nozzle "${n.nozzle_number}"?`)) return
    try {
      await api.delete(`/nozzles/${n.id}`)
      fetchAll()
    } catch (e) {
      const detail = e.response?.data?.detail
      if (e.response?.status === 400 && typeof detail === 'string' && detail.toLowerCase().includes('deactivate')) {
        const ok = window.confirm(`${detail}\n\nDo you want to deactivate this nozzle instead?`)
        if (ok) {
          try {
            await api.put(`/nozzles/${n.id}`, { is_active: false })
            fetchAll()
            return
          } catch (e2) {
            setError(e2.response?.data?.detail || 'Failed to deactivate nozzle')
            return
          }
        }
      }
      setError(detail || 'Failed to delete nozzle')
    }
  }

  const handleSaveMeter = async () => {
    setError('')
    try {
      if (editingMeter) {
        await api.put(`/meters/${editingMeter.id}`, {
          meter_name: newMeter.meter_name,
          max_value: newMeter.max_value === '' ? null : parseFloat(newMeter.max_value),
          last_reading: parseFloat(newMeter.last_reading || 0),
          is_active: !!newMeter.is_active,
        })
      } else {
        await api.post('/meters/', {
          nozzle_id: parseInt(newMeter.nozzle_id),
          meter_name: newMeter.meter_name,
          max_value: newMeter.max_value === '' ? null : parseFloat(newMeter.max_value),
          last_reading: parseFloat(newMeter.last_reading || 0),
          is_active: !!newMeter.is_active,
        })
      }
      setMeterDialogOpen(false)
      setNewMeter({ nozzle_id: '', meter_name: '', max_value: '', last_reading: 0, is_active: true })
      setEditingMeter(null)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save meter')
    }
  }

  const handleToggleMeter = async (m) => {
    setError('')
    try {
      await api.put(`/meters/${m.id}`, { is_active: !m.is_active })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update meter')
    }
  }

  const handleDeleteMeter = async (m) => {
    setError('')
    if (!window.confirm(`Delete meter "${m.meter_name}"?`)) return
    try {
      await api.delete(`/meters/${m.id}`)
      fetchAll()
    } catch (e) {
      const detail = e.response?.data?.detail
      if (e.response?.status === 400 && typeof detail === 'string' && detail.toLowerCase().includes('deactivate')) {
        const ok = window.confirm(`${detail}\n\nDo you want to deactivate this meter instead?`)
        if (ok) {
          try {
            await api.put(`/meters/${m.id}`, { is_active: false })
            fetchAll()
            return
          } catch (e2) {
            setError(e2.response?.data?.detail || 'Failed to deactivate meter')
            return
          }
        }
      }
      setError(detail || 'Failed to delete meter')
    }
  }

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Dispensers
        </Typography>
        <Alert severity="info">Only Admin can manage dispensers.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Dispenser & Nozzle Configuration
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={fetchAll}>
          Refresh
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={openCreateDispenser}>
          Add Dispenser
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={openCreateNozzle}>
          Add Nozzle
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={openCreateMeter}>
          Add Meter
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {info && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {info}
        </Alert>
      )}

      {dispensers.map((d) => {
        const dNozzles = nozzlesByDispenser.get(d.id) || []
        return (
          <Accordion key={d.id} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Typography sx={{ fontWeight: 600 }}>{d.dispenser_number}</Typography>
                <Chip label={d.is_active ? 'Active' : 'Inactive'} size="small" color={d.is_active ? 'success' : 'default'} />
                <Box sx={{ flexGrow: 1 }} />
                <FormControlLabel
                  label="Active"
                  control={<Switch checked={d.is_active} onChange={() => handleToggleDispenser(d)} />}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                />
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    openEditDispenser(d)
                  }}
                >
                  Edit
                </Button>
                <Button
                  color="error"
                  startIcon={<Delete />}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteDispenser(d)
                  }}
                >
                  Delete
                </Button>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Nozzles
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {dNozzles.length === 0 ? (
                <Alert severity="info">Nozzles not configured for this dispenser.</Alert>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nozzle #</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Tank</TableCell>
                      <TableCell>Meters</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dNozzles.map((n) => {
                      const p = n.product_id ? productById.get(n.product_id) : null
                      const t = n.tank_id ? tankById.get(n.tank_id) : null
                      const mList = metersByNozzle.get(n.id) || []
                      return (
                        <TableRow key={n.id}>
                          <TableCell>{n.nozzle_number}</TableCell>
                          <TableCell>{p ? `${p.product_name} (${p.fuel_type})` : '-'}</TableCell>
                          <TableCell>{t ? `${t.tank_name}` : '-'}</TableCell>
                          <TableCell>
                            {mList.length === 0
                              ? '—'
                              : mList.map((m) => (
                                  <Chip
                                    key={m.id}
                                    size="small"
                                    sx={{ mr: 1, mb: 0.5 }}
                                    label={`${m.meter_name} (last ${Number(m.last_reading).toFixed(2)}${m.max_value ? ` / ${Number(m.max_value).toFixed(2)}` : ''})`}
                                    color={m.is_active ? 'success' : 'default'}
                                    variant={m.is_active ? 'filled' : 'outlined'}
                                  />
                                ))}
                          </TableCell>
                          <TableCell>
                            <Chip label={n.is_active ? 'Active' : 'Inactive'} size="small" color={n.is_active ? 'success' : 'default'} />
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => openEditNozzle(n)}>
                              Edit
                            </Button>
                            <Button size="small" onClick={() => handleToggleNozzle(n)}>
                              Toggle
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDeleteNozzle(n)}>
                              Delete
                            </Button>
                            {mList.map((m) => (
                              <React.Fragment key={`meter-actions-${m.id}`}>
                                <Button size="small" onClick={() => openEditMeter(m)}>
                                  Meter Edit
                                </Button>
                                <Button size="small" onClick={() => handleToggleMeter(m)}>
                                  Meter Toggle
                                </Button>
                                <Button size="small" color="error" onClick={() => handleDeleteMeter(m)}>
                                  Meter Delete
                                </Button>
                              </React.Fragment>
                            ))}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </AccordionDetails>
          </Accordion>
        )
      })}

      <Dialog open={dispenserDialogOpen} onClose={() => setDispenserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingDispenser ? 'Edit Dispenser' : 'Add Dispenser'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Dispenser Number"
            value={newDispenser.dispenser_number}
            onChange={(e) => setNewDispenser({ ...newDispenser, dispenser_number: e.target.value })}
          />
          <FormControlLabel
            control={<Switch checked={newDispenser.is_active} onChange={(e) => setNewDispenser({ ...newDispenser, is_active: e.target.checked })} />}
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDispenserDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveDispenser}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={nozzleDialogOpen} onClose={() => setNozzleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingNozzle ? 'Edit Nozzle' : 'Add Nozzle'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            select
            fullWidth
            margin="normal"
            label="Dispenser"
            value={newNozzle.dispenser_id}
            onChange={(e) => setNewNozzle({ ...newNozzle, dispenser_id: e.target.value })}
            disabled={!!editingNozzle}
          >
            {dispensers.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.dispenser_number}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            label="Nozzle Number"
            value={newNozzle.nozzle_number}
            onChange={(e) => setNewNozzle({ ...newNozzle, nozzle_number: e.target.value })}
          />
          <TextField
            select
            fullWidth
            margin="normal"
            label="Product"
            value={newNozzle.product_id}
            onChange={(e) => setNewNozzle({ ...newNozzle, product_id: e.target.value, tank_id: '' })}
          >
            {products.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.product_name} ({p.fuel_type})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Tank"
            value={newNozzle.tank_id}
            onChange={(e) => setNewNozzle({ ...newNozzle, tank_id: e.target.value })}
            disabled={!newNozzle.product_id}
          >
            {tanks
              .filter((t) => String(t.product_id) === String(newNozzle.product_id))
              .map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.tank_name} ({t.is_buffer ? 'Buffer' : 'Main'})
                </MenuItem>
              ))}
          </TextField>
          <FormControlLabel
            control={<Switch checked={newNozzle.is_active} onChange={(e) => setNewNozzle({ ...newNozzle, is_active: e.target.checked })} />}
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNozzleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveNozzle}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={meterDialogOpen} onClose={() => setMeterDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMeter ? 'Edit Meter' : 'Add Meter'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            select
            fullWidth
            margin="normal"
            label="Nozzle"
            value={newMeter.nozzle_id}
            onChange={(e) => setNewMeter({ ...newMeter, nozzle_id: e.target.value })}
            disabled={!!editingMeter}
          >
            {nozzles.map((n) => (
              <MenuItem key={n.id} value={n.id}>
                Dispenser {n.dispenser_id} / Nozzle {n.nozzle_number}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            label="Meter Name / Serial"
            value={newMeter.meter_name}
            onChange={(e) => setNewMeter({ ...newMeter, meter_name: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            type="number"
            label="Max Value (optional, for reset)"
            value={newMeter.max_value}
            onChange={(e) => setNewMeter({ ...newMeter, max_value: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            type="number"
            label="Initial / Last Reading"
            value={newMeter.last_reading}
            onChange={(e) => setNewMeter({ ...newMeter, last_reading: e.target.value })}
          />
          <FormControlLabel
            control={<Switch checked={newMeter.is_active} onChange={(e) => setNewMeter({ ...newMeter, is_active: e.target.checked })} />}
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMeterDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveMeter}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Dispensers
