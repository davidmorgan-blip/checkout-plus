import express from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import { database } from './utils/database';
import uploadRoutes from './routes/upload';
import analyticsRoutes from './routes/analytics';
import netRevenueRoutes from './routes/net-revenue';
import authRoutes from './routes/auth';

declare module 'express-session' {
  interface SessionData {
    user?: {
      email: string;
      name: string;
      picture?: string;
      domain: string;
    };
    oauthState?: string;
  }
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.set('trust proxy', 1);

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL || 'https://checkout-plus-dashboard.replit.app']
  : ['http://localhost:5000', 'http://localhost:3000'];

const getSessionStore = () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production for persistent session storage');
    }
    
    const PgSession = connectPgSimple(session);
    
    const sslConfig = process.env.DATABASE_URL.includes('localhost')
      ? undefined
      : (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false'
          ? { rejectUnauthorized: false }
          : { rejectUnauthorized: true });
    
    const pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig
    });
    
    return new PgSession({
      pool: pgPool,
      tableName: 'session',
      createTableIfMissing: true
    });
  }
  
  return undefined;
};

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(cookieParser());
app.use(session({
  store: getSessionStore(),
  secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('SESSION_SECRET required in production'); })() : 'dev-secret-change-me'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.session?.user) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
  }
};

// Auth Routes (no auth required)
app.use('/auth', authRoutes);

// API Routes (protected by auth)
app.use('/api/upload', requireAuth, uploadRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/net-revenue', requireAuth, netRevenueRoutes);

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
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/health')) {
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    } else {
      next();
    }
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