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
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function Employees() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.role === 'cashier' ? 'operator' : user?.role), [user])
  const canManage = useMemo(() => role === 'admin', [role])

  const [employees, setEmployees] = useState([])
  const [designations, setDesignations] = useState([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [empDialogOpen, setEmpDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [empForm, setEmpForm] = useState({
    employee_name: '',
    dob: '',
    address: '',
    contact_no: '',
    id_no: '',
    designation_id: '',
    is_active: true,
  })

  const [desDialogOpen, setDesDialogOpen] = useState(false)
  const [editingDesignation, setEditingDesignation] = useState(null)
  const [desForm, setDesForm] = useState({ name: '', is_active: true })

  const designationById = useMemo(() => {
    const map = new Map()
    for (const d of designations) map.set(d.id, d)
    return map
  }, [designations])

  const fetchAll = async () => {
    setError('')
    setInfo('')
    try {
      const [eRes, dRes] = await Promise.all([api.get('/employees/'), api.get('/designations/')])
      setEmployees(Array.isArray(eRes.data) ? eRes.data : [])
      setDesignations(Array.isArray(dRes.data) ? dRes.data : [])
      if ((eRes.data || []).length === 0) {
        setInfo('No employees added yet. Click “Add Employee” to get started.')
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load employees/designations')
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const openCreateEmployee = () => {
    setEditingEmployee(null)
    setEmpForm({
      employee_name: '',
      dob: '',
      address: '',
      contact_no: '',
      id_no: '',
      designation_id: '',
      is_active: true,
    })
    setEmpDialogOpen(true)
  }

  const openEditEmployee = (e) => {
    setEditingEmployee(e)
    setEmpForm({
      employee_name: e.employee_name || '',
      dob: e.dob || '',
      address: e.address || '',
      contact_no: e.contact_no || '',
      id_no: e.id_no || '',
      designation_id: e.designation_id == null ? '' : String(e.designation_id),
      is_active: !!e.is_active,
    })
    setEmpDialogOpen(true)
  }

  const saveEmployee = async () => {
    setError('')
    try {
      const payload = {
        employee_name: empForm.employee_name,
        dob: empForm.dob ? empForm.dob : null,
        address: empForm.address || null,
        contact_no: empForm.contact_no || null,
        id_no: empForm.id_no || null,
        designation_id: empForm.designation_id === '' ? null : parseInt(empForm.designation_id),
        is_active: !!empForm.is_active,
      }

      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, payload)
      } else {
        await api.post('/employees/', payload)
      }

      setEmpDialogOpen(false)
      setEditingEmployee(null)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save employee')
    }
  }

  const deleteEmployee = async (e) => {
    setError('')
    if (!window.confirm(`Delete employee "${e.employee_name}"?`)) return
    try {
      await api.delete(`/employees/${e.id}`)
      fetchAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete employee')
    }
  }

  const openManageDesignations = () => {
    setEditingDesignation(null)
    setDesForm({ name: '', is_active: true })
    setDesDialogOpen(true)
  }

  const startEditDesignation = (d) => {
    setEditingDesignation(d)
    setDesForm({ name: d.name || '', is_active: !!d.is_active })
  }

  const saveDesignation = async () => {
    setError('')
    try {
      if (!desForm.name.trim()) {
        setError('Designation name is required')
        return
      }
      const payload = { name: desForm.name.trim(), is_active: !!desForm.is_active }
      if (editingDesignation) {
        await api.put(`/designations/${editingDesignation.id}`, payload)
      } else {
        await api.post('/designations/', payload)
      }
      setEditingDesignation(null)
      setDesForm({ name: '', is_active: true })
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save designation')
    }
  }

  const deleteDesignation = async (d) => {
    setError('')
    if (!window.confirm(`Delete designation "${d.name}"?`)) return
    try {
      await api.delete(`/designations/${d.id}`)
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete designation')
    }
  }

  if (!canManage) {
    return (
      <Container maxWidth={false}>
        <Typography variant="h4" gutterBottom>
          Employees
        </Typography>
        <Alert severity="info">Only Admin can manage employees.</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth={false}>
      <Typography variant="h4" gutterBottom>
        Employees
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={fetchAll}>
          Refresh
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={openCreateEmployee}>
          Add Employee
        </Button>
        <Button variant="outlined" onClick={openManageDesignations}>
          Manage Designations
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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee Name</TableCell>
              <TableCell>DOB</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Contact No</TableCell>
              <TableCell>ID No</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((e) => {
              const d = e.designation_id ? designationById.get(e.designation_id) : null
              return (
                <TableRow key={e.id}>
                  <TableCell>{e.employee_name}</TableCell>
                  <TableCell>{e.dob || ''}</TableCell>
                  <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.address || ''}
                  </TableCell>
                  <TableCell>{e.contact_no || ''}</TableCell>
                  <TableCell>{e.id_no || ''}</TableCell>
                  <TableCell>{d ? d.name : ''}</TableCell>
                  <TableCell>{e.is_active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEditEmployee(e)}>
                      Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => deleteEmployee(e)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Alert severity="info">No employees found.</Alert>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Employee dialog */}
      <Dialog open={empDialogOpen} onClose={() => setEmpDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Employee Name"
            value={empForm.employee_name}
            onChange={(e) => setEmpForm({ ...empForm, employee_name: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="DOB"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={empForm.dob}
            onChange={(e) => setEmpForm({ ...empForm, dob: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Address"
            multiline
            minRows={2}
            value={empForm.address}
            onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Contact No"
            value={empForm.contact_no}
            onChange={(e) => setEmpForm({ ...empForm, contact_no: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="ID No"
            value={empForm.id_no}
            onChange={(e) => setEmpForm({ ...empForm, id_no: e.target.value })}
          />
          <TextField
            select
            fullWidth
            margin="normal"
            label="Designation"
            value={empForm.designation_id}
            onChange={(e) => setEmpForm({ ...empForm, designation_id: e.target.value })}
          >
            <MenuItem value="">None</MenuItem>
            {designations
              .filter((d) => d.is_active)
              .map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Status"
            value={empForm.is_active ? 'active' : 'inactive'}
            onChange={(e) => setEmpForm({ ...empForm, is_active: e.target.value === 'active' })}
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmpDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEmployee}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Designations dialog */}
      <Dialog open={desDialogOpen} onClose={() => setDesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Designations</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
            <TextField
              fullWidth
              label="Designation Name"
              value={desForm.name}
              onChange={(e) => setDesForm({ ...desForm, name: e.target.value })}
            />
            <TextField
              select
              label="Status"
              value={desForm.is_active ? 'active' : 'inactive'}
              onChange={(e) => setDesForm({ ...desForm, is_active: e.target.value === 'active' })}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <Button variant="contained" onClick={saveDesignation}>
              {editingDesignation ? 'Update' : 'Add'}
            </Button>
          </Box>

          <Box sx={{ mt: 2 }}>
            {(designations || []).length === 0 ? (
              <Alert severity="info">No designations configured yet.</Alert>
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
                  {designations.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.name}</TableCell>
                      <TableCell>{d.is_active ? 'Active' : 'Inactive'}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => startEditDesignation(d)}>
                          Edit
                        </Button>
                        <Button size="small" color="error" onClick={() => deleteDesignation(d)}>
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
              setEditingDesignation(null)
              setDesForm({ name: '', is_active: true })
            }}
          >
            Clear
          </Button>
          <Button onClick={() => setDesDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Employees
