import express from 'express';
import multer from 'multer';
import { dataProcessorAgent } from '../agents/DataProcessorAgent';
import { database } from '../utils/database';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  },
});

// Upload Salesforce opportunities CSV
router.post('/opportunities', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No CSV file provided' });
    }

    const csvData = req.file.buffer.toString('utf-8');
    const result = await dataProcessorAgent.processSalesforceCSV(csvData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'CSV validation failed',
        details: result.errors
      });
    }

    if (result.data) {
      await dataProcessorAgent.saveOpportunities(result.data);
    }

    res.json({
      success: true,
      message: `Successfully processed ${result.data?.length || 0} opportunities`,
      recordsProcessed: result.data?.length || 0,
      warnings: result.errors
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload performance actuals CSV
router.post('/performance', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No CSV file provided' });
    }

    const csvData = req.file.buffer.toString('utf-8');
    const result = await dataProcessorAgent.processPerformanceCSV(csvData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'CSV validation failed',
        details: result.errors
      });
    }

    if (result.data) {
      await dataProcessorAgent.savePerformanceData(result.data);
    }

    res.json({
      success: true,
      message: `Successfully processed ${result.data?.length || 0} performance records`,
      recordsProcessed: result.data?.length || 0,
      warnings: result.errors
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload seasonality CSV
router.post('/seasonality', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No CSV file provided' });
    }

    const csvData = req.file.buffer.toString('utf-8');
    const result = await dataProcessorAgent.processSeasonalityCSV(csvData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'CSV validation failed',
        details: result.errors
      });
    }

    if (result.data) {
      await dataProcessorAgent.saveSeasonalityData(result.data);
    }

    res.json({
      success: true,
      message: `Successfully processed ${result.data?.length || 0} seasonality curves`,
      recordsProcessed: result.data?.length || 0,
      warnings: result.errors
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get upload status/summary
router.get('/status', async (req, res) => {
  try {
    const opportunityCount = await database.get('SELECT COUNT(*) as count FROM opportunities');
    const performanceCount = await database.get('SELECT COUNT(*) as count FROM performance_actuals');
    const seasonalityCount = await database.get('SELECT COUNT(*) as count FROM seasonality_curves');

    res.json({
      success: true,
      data: {
        opportunities: opportunityCount?.count || 0,
        performanceRecords: performanceCount?.count || 0,
        seasonalityCurves: seasonalityCount?.count || 0
      }
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upload status'
    });
  }
});

export default router;