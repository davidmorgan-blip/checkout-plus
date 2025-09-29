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
    const opportunityLastUpdate = await database.get('SELECT MAX(created_at) as last_updated FROM opportunities');
    const opportunityMaxCloseDate = await database.get('SELECT MAX(close_date) as max_close_date FROM opportunities WHERE close_date IS NOT NULL');

    const performanceCount = await database.get('SELECT COUNT(*) as count FROM performance_actuals');
    const performanceWeeksCount = await database.get('SELECT COUNT(DISTINCT order_week) as count FROM performance_actuals');
    const performanceMaxOrderWeek = await database.get('SELECT MAX(order_week) as max_order_week FROM performance_actuals');
    const performanceLastUpdate = await database.get('SELECT MAX(created_at) as last_updated FROM performance_actuals');

    const seasonalityCount = await database.get('SELECT COUNT(*) as count FROM seasonality_curves');
    const seasonalityVerticals = await database.get('SELECT COUNT(DISTINCT vertical) as count FROM seasonality_curves');
    const seasonalityLastUpdate = await database.get('SELECT MAX(created_at) as last_updated FROM seasonality_curves');

    res.json({
      success: true,
      data: {
        opportunities: opportunityCount?.count || 0,
        opportunitiesLastUpdated: opportunityLastUpdate?.last_updated || null,
        opportunityMaxCloseDate: opportunityMaxCloseDate?.max_close_date || null,
        performanceRecords: performanceCount?.count || 0,
        performanceWeeks: performanceWeeksCount?.count || 0,
        performanceMaxOrderWeek: performanceMaxOrderWeek?.max_order_week || null,
        performanceLastUpdated: performanceLastUpdate?.last_updated || null,
        seasonalityCurves: seasonalityCount?.count || 0,
        seasonalityVerticals: seasonalityVerticals?.count || 0,
        seasonalityLastUpdated: seasonalityLastUpdate?.last_updated || null
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