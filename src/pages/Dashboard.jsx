import React, { useEffect, useState } from 'react'
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  MenuItem,
} from '@mui/material'
import {
  PointOfSale,
  Inventory,
  CurrencyRupee,
  LocalGasStation,
} from '@mui/icons-material'
import api from '../services/api'

function Dashboard() {
  const [dailySales, setDailySales] = useState(null)
  const [inventory, setInventory] = useState([])
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const today = todayISO()
    setDateFrom(today)
    setDateTo(today)
    fetchProducts()
  }, [])

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    fetchDashboardData()
  }, [productId, dateFrom, dateTo])

  const todayISO = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products/')
      setProducts(res.data || [])
    } catch (error) {
      console.error('Failed to fetch products:', error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      const params = {
        from_date: dateFrom,
        to_date: dateTo,
      }
      if (productId) {
        params.product_id = productId
      }
      const [salesResponse, inventoryResponse] = await Promise.all([
        api.get('/reports/sales-range', { params }),
        api.get('/reports/inventory-status'),
      ])
      setDailySales(salesResponse.data)
      setInventory(inventoryResponse.data)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    }
  }

  const selectedProduct = products.find((p) => String(p.id) === String(productId))
  const productLabel = selectedProduct ? selectedProduct.product_name : 'All Products'

  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography color="textSecondary" gutterBottom>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="textSecondary" display="block">
                {subtitle}
              </Typography>
            )}
            <Typography variant="h4">{value}</Typography>
          </Box>
          <Box sx={{ color: color, fontSize: 48 }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
        <TextField
          label="Product"
          select
          size="small"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">All Products</MenuItem>
          {products.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.product_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="From Date"
          type="date"
          size="small"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="To Date"
          type="date"
          size="small"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Transactions"
            value={dailySales?.total_transactions || 0}
            icon={<PointOfSale />}
            color="primary.main"
            subtitle={productLabel}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Liters Sold"
            value={dailySales?.total_quantity?.toFixed(2) || 0}
            icon={<LocalGasStation />}
            color="success.main"
            subtitle={productLabel}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Revenue"
            value={`₹${dailySales?.total_revenue?.toFixed(2) || 0}`}
            icon={<CurrencyRupee />}
            color="warning.main"
            subtitle={productLabel}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Low Stock Items"
            value={inventory.filter((i) => i.needs_reorder).length}
            icon={<Inventory />}
            color="error.main"
          />
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Inventory Status
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {inventory.map((item) => (
                <Grid item xs={12} sm={4} key={item.fuel_type}>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: item.needs_reorder ? 'error.light' : 'success.light',
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">
                      {item.fuel_type.toUpperCase()}
                    </Typography>
                    <Typography variant="body2">
                      Stock: {item.current_stock.toFixed(2)} L
                    </Typography>
                    <Typography variant="body2">
                      Price: ₹{item.price_per_liter.toFixed(2)}/L
                    </Typography>
                    {item.needs_reorder && (
                      <Typography variant="caption" color="error">
                        ⚠️ Needs Reorder
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}

export default Dashboard
