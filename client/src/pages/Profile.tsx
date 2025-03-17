
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Grid, 
  Box, 
  Divider,
  Avatar,
  Card,
  CardContent,
  IconButton,
  Alert,
  CircularProgress
} from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, updateProfile, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  useEffect(() => {
    // If user is not authenticated, redirect to login
    if (!isAuthenticated) {
      navigate('/login');
    }
    
    // Update form data when user data changes
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user, isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    
    // Reset form data if canceling edit
    if (isEditing && user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate API call with a delay
    setTimeout(() => {
      updateProfile(formData);
      setIsEditing(false);
      setIsSaving(false);
      setShowSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1000);
  };

  // Show loading until user data is available
  if (!user) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
          <Typography variant="h4" component="h1">
            My Profile
          </Typography>
          {!isEditing ? (
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<EditIcon />}
              onClick={handleEditToggle}
            >
              Edit Profile
            </Button>
          ) : (
            <Box>
              <IconButton color="error" onClick={handleEditToggle} sx={{ mr: 1 }}>
                <CancelIcon />
              </IconButton>
              <IconButton 
                color="primary" 
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? <CircularProgress size={24} /> : <SaveIcon />}
              </IconButton>
            </Box>
          )}
        </Box>

        {showSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Profile updated successfully!
          </Alert>
        )}

        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Card sx={{ mb: 3, textAlign: 'center', p: 2 }}>
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  mx: 'auto',
                  bgcolor: 'primary.main',
                  fontSize: '2.5rem',
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </Avatar>
              <CardContent>
                <Typography variant="h6">{user.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Personal Information
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Full Name"
                    variant="outlined"
                    fullWidth
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    required
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Email Address"
                    variant="outlined"
                    fullWidth
                    value={user.email}
                    disabled={true}
                    helperText="Email cannot be changed"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Phone Number"
                    variant="outlined"
                    fullWidth
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Address"
                    variant="outlined"
                    fullWidth
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    multiline
                    rows={3}
                  />
                </Grid>

                {isEditing && (
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      fullWidth
                      size="large"
                      disabled={isSaving}
                      sx={{ mt: 2 }}
                    >
                      {isSaving ? (
                        <>
                          <CircularProgress size={24} sx={{ mr: 1 }} />
                          Saving Changes...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </Grid>
                )}
              </Grid>
            </form>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default Profile;
