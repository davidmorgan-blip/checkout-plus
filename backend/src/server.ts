import express from 'express';
import cors from 'cors';
import path from 'path';
import { database } from './utils/database';
import uploadRoutes from './routes/upload';
import analyticsRoutes from './routes/analytics';
import netRevenueRoutes from './routes/net-revenue';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/net-revenue', netRevenueRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Basic API info
app.get('/api', (req, res) => {
  res.json({
    name: 'Checkout+ Dashboard API',
    version: '1.0.0',
    endpoints: {
      upload: {
        opportunities: 'POST /api/upload/opportunities',
        performance: 'POST /api/upload/performance',
        seasonality: 'POST /api/upload/seasonality',
        status: 'GET /api/upload/status'
      },
      analytics: {
        netRevenue: 'GET /api/analytics/net-revenue'
      },
      netRevenue: {
        data: 'GET /api/net-revenue/net-revenue',
        export: 'GET /api/net-revenue/net-revenue/export'
      }
    }
  });
});

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../../frontend/build');
  app.use(express.static(frontendBuildPath));
  
  // Serve index.html for all non-API routes (client-side routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  // 404 handler for development
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });
}

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await database.initialize();
    console.log('Database initialized successfully');

    const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    app.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`);
      console.log(`Health check: http://${HOST}:${PORT}/health`);
      console.log(`API info: http://${HOST}:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await database.close();
  process.exit(0);
});

startServer();