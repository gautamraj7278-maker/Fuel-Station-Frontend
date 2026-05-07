import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { Add } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

function Products() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])
  const navigate = useNavigate()
  const toast = useToast()

  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ product_name: '', fuel_type: '', is_active: true })

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', is_active: true })

  const fetchAll = async () => {
    setError('')
    setCategoryError('')
    try {
      const [pRes, cRes] = await Promise.all([api.get('/products/'), api.get('/product-categories/')])
      setRows(Array.isArray(pRes.data) ? pRes.data : [])
      setCategories(Array.isArray(cRes.data) ? cRes.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load products')
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const openCreate = () => {
    const defaultCategory = categories.find((c) => c.is_active)?.name || ''
    setEditing(null)
    setForm({ product_name: '', fuel_type: defaultCategory, is_active: true })
    setOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({ product_name: row.product_name, fuel_type: row.fuel_type, is_active: !!row.is_active })
    setOpen(true)
  }

  const handleSave = async () => {
    setError('')
    try {
      if (!form.product_name.trim()) {
        setError('Product name is required')
        return
      }
      if (!form.fuel_type) {
        setError('Product category is required')
        return
      }
      if (editing) {
        await api.put(`/products/${editing.id}`, form, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Product updated')
      } else {
        await api.post('/products/', form, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Product created')
      }
      setOpen(false)
      setEditing(null)
      await fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save product')
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete product "${row.product_name}"?`)) return
    setError('')
    try {
      await api.delete(`/products/${row.id}`, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess('Product deleted')
      await fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete product')
    }
  }

  const openManageCategories = () => {
    setCategoryError('')
    setEditingCategory(null)
    setCategoryForm({ name: '', is_active: true })
    setCategoryDialogOpen(true)
  }

  const startEditCategory = (category) => {
    setEditingCategory(category)
    setCategoryForm({ name: category.name || '', is_active: !!category.is_active })
  }

  const saveCategory = async () => {
    setCategoryError('')
    try {
      if (!categoryForm.name.trim()) {
        setCategoryError('Category name is required')
        return
      }
      const payload = { name: categoryForm.name.trim(), is_active: !!categoryForm.is_active }
      if (editingCategory) {
        await api.put(`/product-categories/${editingCategory.id}`, payload, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Category updated')
      } else {
        await api.post('/product-categories/', payload, { headers: { 'X-Suppress-Toast': '1' } })
        toast.showSuccess('Category created')
      }
      setEditingCategory(null)
      setCategoryForm({ name: '', is_active: true })
      await fetchAll()
    } catch (e) {
      setCategoryError(e.response?.data?.detail || 'Failed to save category')
    }
  }

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return
    setCategoryError('')
    try {
      await api.delete(`/product-categories/${category.id}`, { headers: { 'X-Suppress-Toast': '1' } })
      toast.showSuccess('Category deleted')
      await fetchAll()
    } catch (e) {
      setCategoryError(e.response?.data?.detail || 'Failed to delete category')
    }
  }

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Products
        </Typography>
        <Alert severity="info">Only Admin can manage products.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Products
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Product
        </Button>
        <Button variant="outlined" onClick={fetchAll}>
          Refresh
        </Button>
        <Button variant="outlined" onClick={openManageCategories}>
          Manage Categories
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.product_name}</TableCell>
                <TableCell>{r.fuel_type}</TableCell>
                <TableCell>{r.is_active ? 'Active' : 'Inactive'}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => navigate(`/product-prices?product_id=${r.id}`)}>
                    Price
                  </Button>
                  <Button size="small" onClick={() => openEdit(r)}>
                    Edit
                  </Button>
                  <Button size="small" color="error" onClick={() => handleDelete(r)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Product Name"
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          />
          <TextField
            select
            fullWidth
            margin="normal"
            label="Product Category"
            value={form.fuel_type}
            onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
          >
            {categories
              .filter((c) => c.is_active)
              .slice()
              .sort((a, b) => String(a.name).localeCompare(String(b.name)))
              .map((c) => (
                <MenuItem key={c.id} value={c.name}>
                  {c.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Status"
            value={form.is_active ? 'active' : 'inactive'}
            onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Product Categories</DialogTitle>
        <DialogContent>
          {categoryError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {categoryError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
            <TextField
              fullWidth
              label="Category Name"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            />
            <TextField
              select
              label="Status"
              value={categoryForm.is_active ? 'active' : 'inactive'}
              onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.value === 'active' })}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <Button variant="contained" onClick={saveCategory}>
              {editingCategory ? 'Update' : 'Add'}
            </Button>
          </Box>

          <Box sx={{ mt: 2 }}>
            {categories.length === 0 ? (
              <Alert severity="info">No categories configured yet.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories
                    .slice()
                    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                    .map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.is_active ? 'Active' : 'Inactive'}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => startEditCategory(c)}>
                          Edit
                        </Button>
                        <Button size="small" color="error" onClick={() => deleteCategory(c)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditingCategory(null)
              setCategoryForm({ name: '', is_active: true })
              setCategoryError('')
            }}
          >
            Clear
          </Button>
          <Button onClick={() => setCategoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Products
