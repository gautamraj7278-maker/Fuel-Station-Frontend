import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from '@mui/material'
import { Edit, LocalShipping } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

function Inventory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const isAdmin = role === 'admin'
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState({ price_per_liter: '', reorder_level: '' })
  const [businessDate, setBusinessDate] = useState('')

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => String(a.fuel_type).localeCompare(String(b.fuel_type)))
  }, [items])

  const todayISO = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  const fetchInventory = async (dateISO) => {
    setError('')
    try {
      const selectedDate = dateISO || businessDate || todayISO()
      const res = await api.get('/inventory/daily-status', { params: { business_date: selectedDate } })
      setItems(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch inventory')
    }
  }

  const clearBufferTanks = async () => {
    if (!window.confirm('Clear all buffer tank volumes? This will reset buffer tanks to 0.')) return
    setError('')
    try {
      const res = await api.post('/tanks/buffer/clear', null, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess(`Cleared ${res.data?.cleared || 0} buffer tank(s).`)
      await fetchInventory()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to clear buffer tanks')
    }
  }

  useEffect(() => {
    const initialDate = todayISO()
    setBusinessDate(initialDate)
    fetchInventory(initialDate)
  }, [])

  useEffect(() => {
    if (!businessDate) return
    fetchInventory(businessDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessDate])

  const openEdit = (inv) => {
    setSelected(inv)
    setEditForm({
      price_per_liter: inv.price_per_liter,
      reorder_level: inv.reorder_level,
    })
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selected) return
    setError('')
    try {
      await api.put(`/inventory/${selected.fuel_type}`, {
        price_per_liter: parseFloat(editForm.price_per_liter),
        reorder_level: parseFloat(editForm.reorder_level),
      }, { headers: { 'X-Suppress-Toast': '1' } })
      setEditOpen(false)
      setSelected(null)
      toast.showSuccess('Inventory settings updated')
      await fetchInventory()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update inventory')
    }
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Inventory Management
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Business Date"
          type="date"
          size="small"
          value={businessDate}
          onChange={(e) => setBusinessDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button variant="outlined" onClick={fetchInventory}>
          Refresh
        </Button>
        {isAdmin && (
          <Button color="error" variant="outlined" onClick={clearBufferTanks}>
            Clear Buffer Tanks
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {sortedItems.map((inv) => {
          const low = Number(inv.book_stock) <= Number(inv.reorder_level)
          return (
            <Grid item xs={12} md={4} key={String(inv.fuel_type)}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {String(inv.fuel_type).toUpperCase()}
                  </Typography>
                  <Typography variant="body2">Opening: {Number(inv.opening_stock || 0).toFixed(2)} L</Typography>
                  <Typography variant="body2">Receipts: +{Number(inv.receipts || 0).toFixed(2)} L</Typography>
                  <Typography variant="body2">Sales: -{Number(inv.sales || 0).toFixed(2)} L</Typography>
                  <Typography variant="body2">Testing to Buffer: -{Number(inv.testings || 0).toFixed(2)} L</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Book Stock: {Number(inv.book_stock || 0).toFixed(2)} L
                  </Typography>
                  <Typography variant="body2">
                    Physical Closing: {inv.physical_closing_stock == null ? '-' : `${Number(inv.physical_closing_stock).toFixed(2)} L`}
                  </Typography>
                  <Typography variant="body2">
                    Variance (Physical − Book): {inv.variance == null ? '-' : `${Number(inv.variance).toFixed(2)} L`}
                  </Typography>
                  <Typography variant="body2">Price: ₹{Number(inv.price_per_liter).toFixed(2)}/L</Typography>
                  <Typography variant="body2">Reorder Level: {Number(inv.reorder_level).toFixed(2)} L</Typography>
                  <Typography variant="body2">
                    Last Updated: {inv.last_updated ? new Date(inv.last_updated).toLocaleString() : '-'}
                  </Typography>
                  {low && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Low stock
                    </Alert>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<LocalShipping />}
                      onClick={() => navigate('/tanker-receipts?new=1&auto_confirm=1')}
                    >
                      Receive Tanker
                    </Button>
                  {isAdmin && (
                    <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => openEdit(inv)}>
                      Edit
                    </Button>
                  )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Inventory</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Price per Liter"
            type="number"
            value={editForm.price_per_liter}
            onChange={(e) => setEditForm({ ...editForm, price_per_liter: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Reorder Level"
            type="number"
            value={editForm.reorder_level}
            onChange={(e) => setEditForm({ ...editForm, reorder_level: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Inventory
