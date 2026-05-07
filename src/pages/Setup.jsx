import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material'
import { CheckCircle, Person } from '@mui/icons-material'
import api from '../services/api'

const STATUS_RETRY_DELAY_MS = 1500
const STATUS_MAX_RETRIES = 6

function Setup() {
  const [setupStatus, setSetupStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    admin_username: 'admin',
    admin_password: '',
    admin_email: 'admin@fuelstation.com',
    admin_full_name: 'System Administrator',
  })
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    let retryTimer = null

    const checkSetupStatus = async (attempt = 0) => {
      try {
        const response = await api.get('/setup/status')
        if (cancelled) return
        setSetupStatus(response.data)
        setStatusError('')

        // If already setup, redirect to login
        if (response.data.is_setup) {
          setTimeout(() => navigate('/login'), 2000)
        }
        setLoading(false)
      } catch (error) {
        if (cancelled) return
        if (attempt < STATUS_MAX_RETRIES) {
          retryTimer = setTimeout(
            () => checkSetupStatus(attempt + 1),
            STATUS_RETRY_DELAY_MS
          )
          return
        }
        console.error('Failed to check setup status:', error)
        setStatusError('Unable to reach the server. Please wait and retry.')
        setLoading(false)
      }
    }

    checkSetupStatus()

    return () => {
      cancelled = true
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await api.post('/setup/initialize', formData)
      
      if (response.data.success) {
        setSuccess(true)
        setTimeout(() => navigate('/login'), 3000)
      } else {
        setError(response.data.errors.join(', '))
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Setup failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (setupStatus?.is_setup) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
            <Box display="flex" justifyContent="center" mb={2}>
              <CheckCircle color="success" sx={{ fontSize: 60 }} />
            </Box>
            <Typography variant="h5" align="center" gutterBottom>
              System Already Configured
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary">
              Redirecting to login...
            </Typography>
          </Paper>
        </Box>
      </Container>
    )
  }

  if (success) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
            <Box display="flex" justifyContent="center" mb={2}>
              <CheckCircle color="success" sx={{ fontSize: 60 }} />
            </Box>
            <Typography variant="h5" align="center" gutterBottom color="success.main">
              Setup Complete!
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" gutterBottom>
              Your Fuel Station system is ready.
            </Typography>
            <Box mt={3}>
              <Alert severity="success">
                <strong>Your Login Credentials:</strong>
                <br />
                Username: {formData.admin_username}
                <br />
                Password: (as entered)
                <br />
                <br />
                Please save these credentials securely!
              </Alert>
            </Box>
            <Typography variant="body2" align="center" color="text.secondary" mt={2}>
              Redirecting to login in 3 seconds...
            </Typography>
          </Paper>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          marginTop: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            Quick Setup
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" gutterBottom>
            Create your admin user to start the application.
          </Typography>

          <Stepper activeStep={0} sx={{ mt: 4, mb: 4 }}>
            <Step>
              <StepLabel>Create Admin</StepLabel>
            </Step>
          </Stepper>

          <Typography variant="h6" gutterBottom>
            What will be created:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <Person color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Admin Account"
                secondary="Full system access with username and password"
              />
            </ListItem>
          </List>

          {statusError && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {statusError}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Admin Account Details:
            </Typography>

            <TextField
              margin="normal"
              required
              fullWidth
              label="Admin Username"
              value={formData.admin_username}
              onChange={(e) =>
                setFormData({ ...formData, admin_username: e.target.value })
              }
            />

            <TextField
              margin="normal"
              required
              fullWidth
              label="Admin Password"
              type="password"
              value={formData.admin_password}
              onChange={(e) =>
                setFormData({ ...formData, admin_password: e.target.value })
              }
              inputProps={{ maxLength: 72 }}
              helperText="Choose a strong password (6-72 chars). Avoid emojis/non-ASCII (bcrypt limit is 72 bytes)."
            />

            <TextField
              margin="normal"
              required
              fullWidth
              label="Admin Email"
              type="email"
              value={formData.admin_email}
              onChange={(e) =>
                setFormData({ ...formData, admin_email: e.target.value })
              }
            />

            <TextField
              margin="normal"
              required
              fullWidth
              label="Full Name"
              value={formData.admin_full_name}
              onChange={(e) =>
                setFormData({ ...formData, admin_full_name: e.target.value })
              }
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={submitting || !formData.admin_password}
            >
              {submitting ? 'Setting up...' : 'Create Admin User'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}

export default Setup
