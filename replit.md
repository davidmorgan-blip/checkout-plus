# Checkout+ Performance Dashboard - Replit Setup

## Project Overview
A comprehensive React-based web application for monitoring Checkout+ monetization deal performance. This dashboard provides insights into the performance of Checkout+ deals for Shopify merchants by comparing expected projections against actual performance metrics.

## Architecture

### Tech Stack
- **Frontend**: React 19.1.1 + TypeScript + Material-UI (MUI)
- **Backend**: Node.js + Express 5.1.0 + TypeScript
- **Database**: SQLite 3 (local file-based database)
- **Build Tools**: CRACO (Create React App Configuration Override)

### Project Structure
```
checkout-plus/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── config/         # API configuration
│   │   └── App.tsx         # Main app component
│   ├── package.json
│   ├── craco.config.js     # Webpack dev server config
│   └── .env               # Environment variables
├── backend/               # Express backend API
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── agents/        # Data processing logic
│   │   ├── utils/         # Database utilities
│   │   └── server.ts      # Main server entry point
│   └── package.json
└── database/
    └── schema.sql         # Database schema
```

## Recent Changes (Oct 1, 2025)

### Replit Environment Setup
1. **Installed Node.js 20** via Replit modules
2. **Installed all dependencies** for both frontend and backend
3. **Configured frontend for Replit proxy**:
   - Uses CRACO to configure webpack dev server
   - Set `allowedHosts: 'all'` to work with Replit's iframe proxy
   - Configured to run on 0.0.0.0:5000
   - Added proxy to package.json to forward API requests to backend in development

4. **Configured backend**:
   - Development: Runs on localhost:3001
   - Production: Runs on 0.0.0.0:5000, serves both API and frontend
   - Uses SQLite database (auto-created on startup)
   - CORS enabled for frontend communication
   - Fixed Express 5.x compatibility for static file serving

5. **Set up workflows**:
   - **Backend**: Runs on port 3001 (console output)
   - **Frontend**: Runs on port 5000 (webview output)

6. **Deployment configuration**:
   - Type: VM (maintains state for SQLite database)
   - Build: Compiles both frontend and backend TypeScript
   - Run: Backend serves both API and frontend on single port (5000)
   - Fixed Express 5.x wildcard route compatibility (uses middleware instead of route)

7. **API Configuration Fixes**:
   - Fixed ACV Impacts endpoint URL (was pointing to wrong router)
   - Simplified API base URL to use relative URLs in all environments
   - Added Create React App proxy to forward /api requests to backend in development

## Development

### Running the Application
The application runs automatically via Replit workflows:
- Frontend: http://localhost:5000 (visible in webview)
- Backend API: http://localhost:3001

### Port Configuration
- **Frontend**: Port 5000, bound to 0.0.0.0 (required for Replit proxy)
- **Backend**: Port 3001, bound to localhost

### API Communication
The frontend uses a dynamic API configuration (`frontend/src/config/api.ts`) that:
- Detects the current environment (development vs production)
- Constructs the correct backend URL based on window.location
- Uses the same protocol (http/https) as the frontend

## Database
- **Type**: SQLite 3
- **Location**: `backend/checkout_plus.db` (auto-created)
- **Schema**: Defined in `database/schema.sql`
- **Auto-initialization**: Yes, on first backend startup

The database includes tables for:
- Opportunities (Salesforce data)
- Performance actuals (weekly metrics)
- Seasonality curves (order distribution)
- Merchant exclusions (user-defined)
- Performance alerts (system-generated)

## Features
- **Dashboard Overview**: Summary metrics and trends
- **Revenue Analysis**: Revenue bridge and variance analysis
- **Merchant Stratification**: Performance distribution analysis
- **ACV Impact Analysis**: Contract value impact tracking
- **Volume Analysis**: Order volume trends and projections
- **Data Export**: CSV and Excel export functionality
- **Salesforce Integration**: Direct links to SFDC records

## Data Requirements
The application requires three types of CSV data:
1. **Salesforce Opportunities** - Deal projections and merchant details
2. **Performance Actuals** - Weekly actual performance by merchant
3. **Seasonality Curves** - Expected order distribution by week and vertical

Upload these files through the web interface.

## User Preferences
- None specified yet

## Known Issues
- Frontend has ESLint warnings for unused variables and missing hook dependencies (non-blocking)
- No production environment variables configured yet
