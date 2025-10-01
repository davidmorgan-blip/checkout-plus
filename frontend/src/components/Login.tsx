import React from 'react';
import { Box, Button, Container, Paper, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

const Login: React.FC = () => {
  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const domain = urlParams.get('domain');

  const getErrorMessage = () => {
    switch (error) {
      case 'invalid_domain':
        return `Access denied. Only @loopreturns.com accounts are allowed. You tried to sign in with: ${domain || 'unknown domain'}`;
      case 'no_code':
        return 'Authentication failed: No authorization code received.';
      case 'invalid_token':
        return 'Authentication failed: Invalid token.';
      case 'invalid_state':
        return 'Authentication failed: Invalid security token. Please try again.';
      case 'auth_failed':
        return 'Authentication failed. Please try again.';
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage();

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Checkout+ Performance Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
            Monitor and analyze Checkout+ monetization deal performance
          </Typography>

          {errorMessage && (
            <Paper
              sx={{
                p: 2,
                mb: 3,
                backgroundColor: 'error.light',
                color: 'error.contrastText',
                width: '100%',
              }}
            >
              <Typography variant="body2">{errorMessage}</Typography>
            </Paper>
          )}

          <Button
            variant="contained"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            sx={{
              mt: 2,
              py: 1.5,
              px: 4,
              textTransform: 'none',
              fontSize: '1rem',
            }}
          >
            Sign in with Google Workspace
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
