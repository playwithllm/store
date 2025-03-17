
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Link,
  Alert,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import { Email as EmailIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const ForgotPassword = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Invalid email address');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      await requestPasswordReset(email);
      setIsSubmitted(true);
    } catch (error) {
      setError('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box textAlign="center" mb={4}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Forgot Password
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Enter your email to reset your password
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {isSubmitted ? (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              If an account exists with the email {email}, a password reset link has been sent.
            </Alert>
            <Box textAlign="center" mt={4}>
              <Button
                component={RouterLink}
                to="/login"
                startIcon={<ArrowBackIcon />}
                variant="outlined"
              >
                Back to Login
              </Button>
            </Box>
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            <TextField
              label="Email Address"
              variant="outlined"
              fullWidth
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              disabled={isLoading}
              sx={{ mt: 3, py: 1.5 }}
            >
              {isLoading ? (
                <>
                  <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" />
                  Processing...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
            
            <Box textAlign="center" mt={3}>
              <Typography variant="body2">
                Remember your password?{' '}
                <Link 
                  component={RouterLink} 
                  to="/login" 
                  underline="hover"
                >
                  Back to Login
                </Link>
              </Typography>
            </Box>
          </form>
        )}
      </Paper>
    </Container>
  );
};

export default ForgotPassword;
