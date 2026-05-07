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

function Pumps() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])

  const [pumps, setPumps] = useState([])
  const [nozzles, setNozzles] = useState([])
  const [meters, setMeters] = useState([])
  const [products, setProducts] = useState([])
  const [tanks, setTanks] = useState([])
  const [error, setError] = useState('')

  const [pumpDialogOpen, setPumpDialogOpen] = useState(false)
  const [nozzleDialogOpen, setNozzleDialogOpen] = useState(false)
  const [meterDialogOpen, setMeterDialogOpen] = useState(false)

  const [newPump, setNewPump] = useState({ pump_number: '', fuel_type: 'petrol', is_active: true })
  const [newNozzle, setNewNozzle] = useState({
    pump_id: '',
    nozzle_number: '',
    product_id: '',
    tank_id: '',
    is_active: true,
  })
  const [newMeter, setNewMeter] = useState({ nozzle_id: '', meter_name: '', max_value: '', last_reading: 0, is_active: true })

  const fetchAll = async () => {
    setError('')
    try {
      const [pRes, nRes, mRes, prodRes, tankRes] = await Promise.all([
        api.get('/dispensers/'),
        api.get('/nozzles/'),
        api.get('/meters/'),
        api.get('/products/'),
        api.get('/tanks/'),
      ])
      setPumps(pRes.data)
      setNozzles(nRes.data)
      setMeters(mRes.data)
      setProducts(prodRes.data)
      setTanks(tankRes.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load dispensers/nozzles')
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const nozzlesByPump = useMemo(() => {
    const map = new Map()
    for (const n of nozzles) {
      const list = map.get(n.pump_id) || []
      list.push(n)
      map.set(n.pump_id, list)
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

  const handleCreatePump = async () => {
    setError('')
    try {
      await api.post('/dispensers/', newPump)
      setPumpDialogOpen(false)
      setNewPump({ pump_number: '', fuel_type: 'petrol', is_active: true })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create pump')
    }
  }

  const handleTogglePump = async (p) => {
    setError('')
    try {
      await api.put(`/dispensers/${p.id}`, { is_active: !p.is_active })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update pump')
    }
  }

  const handleDeletePump = async (p) => {
    setError('')
    if (!window.confirm(`Delete dispenser "${p.pump_number || p.dispenser_number || p.id}"?`)) return
    try {
      await api.delete(`/dispensers/${p.id}`)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete pump')
    }
  }

  const handleCreateNozzle = async () => {
    setError('')
    try {
      await api.post('/nozzles/', {
        pump_id: parseInt(newNozzle.pump_id),
        nozzle_number: newNozzle.nozzle_number,
        product_id: parseInt(newNozzle.product_id),
        tank_id: parseInt(newNozzle.tank_id),
        is_active: !!newNozzle.is_active,
      })
      setNozzleDialogOpen(false)
      setNewNozzle({ pump_id: '', nozzle_number: '', product_id: '', tank_id: '', is_active: true })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create nozzle')
    }
  }

  const handleCreateMeter = async () => {
    setError('')
    try {
      await api.post('/meters/', {
        nozzle_id: parseInt(newMeter.nozzle_id),
        meter_name: newMeter.meter_name,
        max_value: newMeter.max_value === '' ? null : parseFloat(newMeter.max_value),
        last_reading: parseFloat(newMeter.last_reading || 0),
        is_active: !!newMeter.is_active,
      })
      setMeterDialogOpen(false)
      setNewMeter({ nozzle_id: '', meter_name: '', max_value: '', last_reading: 0, is_active: true })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create meter')
    }
  }

  const handleToggleMeter = async (meter) => {
    setError('')
    try {
      await api.put(`/meters/${meter.id}`, { is_active: !meter.is_active })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update meter')
    }
  }

  const handleDeleteMeter = async (meter) => {
    setError('')
    if (!window.confirm(`Delete meter "${meter.meter_name || meter.id}"?`)) return
    try {
      await api.delete(`/meters/${meter.id}`)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete meter')
    }
  }

  const handleToggleNozzle = async (nozzle) => {
    setError('')
    try {
      await api.put(`/nozzles/${nozzle.id}`, { is_active: !nozzle.is_active })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update nozzle')
    }
  }

  const handleDeleteNozzle = async (nozzle) => {
    setError('')
    if (!window.confirm(`Delete nozzle "${nozzle.nozzle_number || nozzle.id}"?`)) return
    try {
      await api.delete(`/nozzles/${nozzle.id}`)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete nozzle')
    }
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Dispenser & Nozzle Configuration
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={fetchAll}>
          Refresh
        </Button>
        {canManage && (
          <>
            <Button variant="contained" startIcon={<Add />} onClick={() => setPumpDialogOpen(true)}>
              Add Dispenser
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => setNozzleDialogOpen(true)}>
              Add Nozzle
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => setMeterDialogOpen(true)}>
              Add Meter
            </Button>
          </>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {pumps.map((pump) => {
        const pumpNozzles = nozzlesByPump.get(pump.id) || []
        return (
          <Accordion key={pump.id} defaultExpanded={false} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Typography sx={{ fontWeight: 600 }}>{pump.pump_number}</Typography>
                <Chip label={pump.fuel_type} size="small" />
                <Chip
                  label={pump.is_active ? 'Active' : 'Inactive'}
                  size="small"
                  color={pump.is_active ? 'success' : 'default'}
                />
                <Box sx={{ flexGrow: 1 }} />
                {canManage && (
                  <>
                    <FormControlLabel
                      label="Active"
                      control={<Switch checked={pump.is_active} onChange={() => handleTogglePump(pump)} />}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                    />
                    <Button
                      color="error"
                      startIcon={<Delete />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePump(pump)
                      }}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Nozzles
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {pumpNozzles.length === 0 ? (
                <Alert severity="info">Nozzles not configured for this pump.</Alert>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nozzle #</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Meters</TableCell>
                      <TableCell>Status</TableCell>
                      {canManage && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pumpNozzles.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell>{n.nozzle_number}</TableCell>
                        <TableCell>{n.fuel_type}</TableCell>
                        <TableCell>
                          {(() => {
                            const list = metersByNozzle.get(n.id) || []
                            if (list.length === 0) return <Chip size="small" label="No meters" />
                            return list.map((m) => (
                              <Chip
                                key={m.id}
                                size="small"
                                sx={{ mr: 1, mb: 0.5 }}
                                label={`${m.meter_name} (last ${Number(m.last_reading).toFixed(2)}${m.max_value ? ` / ${Number(m.max_value).toFixed(2)}` : ''})`}
                                color={m.is_active ? 'success' : 'default'}
                                variant={m.is_active ? 'filled' : 'outlined'}
                              />
                            ))
                          })()}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={n.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            color={n.is_active ? 'success' : 'default'}
                          />
                        </TableCell>
                        {canManage && (
                          <TableCell align="right">
                            <Button size="small" onClick={() => handleToggleNozzle(n)}>
                              Toggle
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDeleteNozzle(n)}>
                              Delete
                            </Button>
                            {(metersByNozzle.get(n.id) || []).map((m) => (
                              <React.Fragment key={`meter-actions-${m.id}`}>
                                <Button size="small" onClick={() => handleToggleMeter(m)}>
                                  Meter Toggle
                                </Button>
                                <Button size="small" color="error" onClick={() => handleDeleteMeter(m)}>
                                  Meter Delete
                                </Button>
                              </React.Fragment>
                            ))}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AccordionDetails>
          </Accordion>
        )
      })}

      <Dialog open={pumpDialogOpen} onClose={() => setPumpDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Dispenser</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Dispenser Number"
            value={newPump.pump_number}
            onChange={(e) => setNewPump({ ...newPump, pump_number: e.target.value })}
          />
          <TextField
            select
            fullWidth
            margin="normal"
            label="Category"
            value={newPump.fuel_type}
            onChange={(e) => setNewPump({ ...newPump, fuel_type: e.target.value })}
          >
            <MenuItem value="petrol">Petrol</MenuItem>
            <MenuItem value="diesel">Diesel</MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={newPump.is_active}
                onChange={(e) => setNewPump({ ...newPump, is_active: e.target.checked })}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPumpDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreatePump}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={nozzleDialogOpen} onClose={() => setNozzleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Nozzle</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Dispenser"
            value={newNozzle.pump_id}
            onChange={(e) => setNewNozzle({ ...newNozzle, pump_id: e.target.value })}
          >
            {pumps.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.pump_number} ({p.fuel_type})
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
            helperText="Tank must match the selected product"
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
            control={
              <Switch
                checked={newNozzle.is_active}
                onChange={(e) => setNewNozzle({ ...newNozzle, is_active: e.target.checked })}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNozzleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateNozzle}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={meterDialogOpen} onClose={() => setMeterDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Meter</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Nozzle"
            value={newMeter.nozzle_id}
            onChange={(e) => setNewMeter({ ...newMeter, nozzle_id: e.target.value })}
          >
            {nozzles.map((n) => {
              const pump = pumps.find((p) => p.id === n.pump_id)
              return (
                <MenuItem key={n.id} value={n.id}>
                  {pump ? pump.pump_number : 'Pump'} / Nozzle {n.nozzle_number} ({n.fuel_type})
                </MenuItem>
              )
            })}
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
            label="Max Value (optional, for reset)"
            type="number"
            value={newMeter.max_value}
            onChange={(e) => setNewMeter({ ...newMeter, max_value: e.target.value })}
            helperText="If set, the system treats a lower closing reading as a meter reset."
          />
          <TextField
            fullWidth
            margin="normal"
            label="Initial / Last Reading"
            type="number"
            value={newMeter.last_reading}
            onChange={(e) => setNewMeter({ ...newMeter, last_reading: e.target.value })}
          />
          <FormControlLabel
            control={
              <Switch
                checked={newMeter.is_active}
                onChange={(e) => setNewMeter({ ...newMeter, is_active: e.target.checked })}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMeterDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateMeter}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Pumps
