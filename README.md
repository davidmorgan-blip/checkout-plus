# Checkout+ Performance Dashboard

A comprehensive React-based web application for monitoring Checkout+ monetization deal performance, providing insights into the performance of Checkout+ deals for Shopify merchants by comparing expected projections against actual performance metrics.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/davidmorgan-blip/checkout-plus.git
cd checkout-plus

# Run the automated setup script
chmod +x setup.sh
./setup.sh

# OR follow manual installation steps below
```

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher (tested with v24.4.0)
- **npm**: v9.0.0 or higher (tested with v11.4.2)
- **Git**: For version control

### System Requirements
- **macOS**: 10.15+ (recommended)
- **Windows**: 10+ with WSL2 (untested)
- **Linux**: Ubuntu 18.04+ (untested)

## 🛠️ Manual Installation

### 1. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup
The SQLite database will be automatically created when you start the backend server. The schema is defined in `database/schema.sql` and will be applied automatically.

### 3. Environment Setup
No environment variables are required for basic operation. The application uses SQLite for local development.

## 🏃‍♂️ Running the Application

### Development Mode (Recommended)

Start both backend and frontend in development mode:

```bash
# Terminal 1 - Start Backend Server
cd backend
npm run dev

# Terminal 2 - Start Frontend Development Server
cd frontend
npm start
```

**Access the application:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### Production Build

```bash
# Build frontend for production
cd frontend
npm run build

# Build backend for production
cd backend
npm run build
npm start
```

## 📊 Data Upload

The application requires three types of CSV data:

1. **Salesforce Opportunities** - Deal projections and merchant details
2. **Performance Actuals** - Weekly actual performance by merchant
3. **Seasonality Curves** - Expected order distribution by week and vertical

Upload these files through the web interface at: http://localhost:3000

## 🗂️ Project Structure

```
checkout-plus/
├── README.md                 # This file
├── setup.sh                  # Automated setup script
├── package.json              # Root package configuration
├── .gitignore                # Git ignore patterns
├── CLAUDE.md                 # Project requirements document
├── backend/                  # Node.js + Express backend
│   ├── src/
│   │   ├── server.ts         # Main server entry point
│   │   ├── routes/           # API endpoints
│   │   ├── agents/           # Data processing logic
│   │   └── utils/            # Database utilities
│   ├── package.json          # Backend dependencies
│   └── tsconfig.json         # TypeScript configuration
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── App.tsx          # Main app component
│   │   └── index.tsx        # React entry point
│   ├── package.json         # Frontend dependencies
│   └── public/              # Static assets
├── database/
│   └── schema.sql           # Database schema definition
└── data/                    # Data files (gitignored)
    └── (CSV files go here)
```

## 🔧 Available Scripts

### Backend Scripts
```bash
cd backend
npm run dev      # Start development server with hot reload
npm run build    # Build TypeScript to JavaScript
npm start        # Start production server
npm test         # Run tests (not implemented)
```

### Frontend Scripts
```bash
cd frontend
npm start        # Start development server
npm run build    # Build for production
npm test         # Run tests
npm run eject    # Eject from Create React App (not recommended)
```

## 🗄️ Database

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

## 🔒 Security Notes

- Database files are excluded from Git (`.gitignore`)
- CSV data files are excluded from Git
- No sensitive credentials required for local development
- Database is local SQLite (not exposed to network)

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**
   - Backend: Change port in `backend/src/server.ts` (default: 3001)
   - Frontend: Set `PORT=3002` environment variable (default: 3000)

2. **Database issues**
   - Delete `backend/checkout_plus.db` and restart backend to recreate

3. **Node modules issues**
   - Delete `node_modules` folders and run `npm install` again

4. **TypeScript errors**
   - Ensure Node.js version is compatible (v18+)
   - Try `npm run build` to check for compilation errors

### Getting Help

1. Check the console output for error messages
2. Verify all dependencies are installed correctly
3. Ensure Node.js and npm versions meet requirements
4. Check that all required files are present

## 📈 Features

- **Dashboard Overview**: Summary metrics and trends
- **Revenue Analysis**: Revenue bridge and variance analysis
- **Merchant Stratification**: Performance distribution analysis
- **ACV Impact Analysis**: Contract value impact tracking
- **Volume Analysis**: Order volume trends and projections
- **Data Export**: CSV and Excel export functionality
- **Salesforce Integration**: Direct links to SFDC records

## 🔄 Development Workflow

1. Make changes to code
2. Test locally with development servers
3. Commit changes to Git
4. Push to GitHub repository

## 📝 License

ISC License - See package.json for details

## 🤝 Contributing

This is a private project. Contact the repository owner for contribution guidelines.

---

**Generated with Claude Code** 🤖