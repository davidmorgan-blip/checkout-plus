import express from 'express';
import { Database } from 'sqlite3';
import path from 'path';

const router = express.Router();
const dbPath = path.join(__dirname, '../../checkout_plus.db');

interface NetRevenueData {
  accountId: string;
  opportunityId: string;
  accountName: string;
  pricingModel: string;
  labelsPaidBy: string;
  expectedAnnualRevenue: number;
  actualAnnualRevenue: number;
  revenueVariance: number;
  revenueVariancePercent: number;
  adoptionRateExpected: number;
  adoptionRateActual: number;
  adoptionVariance: number;
  volumeExpected: number;
  volumeActual: number;
  volumeVariance: number;
  volumeContribution: number;
  adjustmentNeeded: boolean;
  adjustmentStatus: string;
  adoptionContribution: number;
  interactionContribution: number;
  implementationStatus: string;
  daysLive: number;
}

// Core revenue calculation functions
function calculateExpectedRevenue(opportunity: any): number {
  const {
    pricingModel,
    expectedAnnualRevenue,
    annual_order_volume,
    adoption_rate,
    initial_offset_fee,
    refund_handling_fee,
    domestic_return_rate,
    loop_share_percent,
    blended_avg_cost_per_return,
    labels_paid_by
  } = opportunity;

  if (pricingModel === 'Flat') {
    return expectedAnnualRevenue || 0;
  }

  if (pricingModel === 'Rev Share') {
    const adoptionDecimal = (adoption_rate || 50) / 100;
    const returnRateDecimal = (domestic_return_rate || 0) / 100;
    const loopShareDecimal = (loop_share_percent || 0) / 100;

    const revenueFromFees = (
      (annual_order_volume * adoptionDecimal * (initial_offset_fee || 0)) +
      (annual_order_volume * (1 - adoptionDecimal) * returnRateDecimal * (refund_handling_fee || 0))
    ) * loopShareDecimal;

    if (labels_paid_by === 'Loop') {
      // Label costs with 5pp buffer for adopted orders
      const labelCostsAdopted = annual_order_volume * (returnRateDecimal + 0.05) * adoptionDecimal * (blended_avg_cost_per_return || 0);
      const labelCostsNonAdopted = annual_order_volume * returnRateDecimal * (1 - adoptionDecimal) * (blended_avg_cost_per_return || 0);
      const totalLabelCosts = labelCostsAdopted + labelCostsNonAdopted;
      return revenueFromFees - totalLabelCosts;
    }

    return revenueFromFees;
  }

  return expectedAnnualRevenue || 0; // Fallback
}

function calculateActualRevenue(opportunity: any, actualMetrics: any): number {
  const {
    pricingModel,
    expectedAnnualRevenue,
    initial_offset_fee,
    refund_handling_fee,
    domestic_return_rate,
    loop_share_percent,
    blended_avg_cost_per_return,
    labels_paid_by
  } = opportunity;

  const {
    projected_annual_volume,
    actual_adoption_rate
  } = actualMetrics;

  if (pricingModel === 'Flat') {
    return expectedAnnualRevenue || 0;
  }

  if (pricingModel === 'Rev Share') {
    const adoptionDecimal = (actual_adoption_rate || 0) / 100;
    const returnRateDecimal = (domestic_return_rate || 0) / 100;
    const loopShareDecimal = (loop_share_percent || 0) / 100;

    const revenueFromFees = (
      (projected_annual_volume * adoptionDecimal * (initial_offset_fee || 0)) +
      (projected_annual_volume * (1 - adoptionDecimal) * returnRateDecimal * (refund_handling_fee || 0))
    ) * loopShareDecimal;

    if (labels_paid_by === 'Loop') {
      // Label costs with 5pp buffer for adopted orders
      const labelCostsAdopted = projected_annual_volume * (returnRateDecimal + 0.05) * adoptionDecimal * (blended_avg_cost_per_return || 0);
      const labelCostsNonAdopted = projected_annual_volume * returnRateDecimal * (1 - adoptionDecimal) * (blended_avg_cost_per_return || 0);
      const totalLabelCosts = labelCostsAdopted + labelCostsNonAdopted;
      return revenueFromFees - totalLabelCosts;
    }

    return revenueFromFees;
  }

  return expectedAnnualRevenue || 0; // Fallback
}

// Net Revenue Analysis endpoint
router.get('/net-revenue', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const daysLiveFilter = req.query.daysLive as string || 'all';

    // Get opportunities with their expected revenue
    let opportunitiesQuery = `
      SELECT
        o.account_casesafe_id as accountId,
        o.opportunity_id as opportunityId,
        o.account_name as accountName,
        o.pricing_model as pricingModel,
        o.est_offset_net_revenue as expectedAnnualRevenue,
        o.annual_order_volume,
        o.adoption_rate,
        o.initial_offset_fee,
        o.refund_handling_fee,
        o.domestic_return_rate,
        o.loop_share_percent,
        o.blended_avg_cost_per_return,
        o.labels_paid_by,
        o.benchmark_vertical,
        o.implementation_status as implementationStatus,
        (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) as daysLive
      FROM opportunities o
      WHERE o.checkout_enabled = 'Yes'
        AND (o.annual_order_volume > 0 OR o.pricing_model = 'Flat')
        AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) > 0
    `;

    // Apply days live filter at SQL level for consistency with other tabs
    if (daysLiveFilter !== 'all') {
      if (daysLiveFilter === 'under30') {
        opportunitiesQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) < 30`;
      } else {
        const threshold = parseInt(daysLiveFilter);
        opportunitiesQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ${threshold}`;
      }
    }

    const opportunities = await new Promise<any[]>((resolve, reject) => {
      db.all(opportunitiesQuery, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });

    // Get seasonality data for seasonality-adjusted volume calculations
    const seasonalityData = await new Promise<any[]>((resolve, reject) => {
      db.all('SELECT vertical, iso_week, order_percentage FROM seasonality_curves ORDER BY vertical, iso_week', (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });

    // Build seasonality lookup map
    const seasonalityMap: { [key: string]: { [week: number]: number } } = {};
    seasonalityData.forEach(row => {
      if (!seasonalityMap[row.vertical]) {
        seasonalityMap[row.vertical] = {};
      }
      seasonalityMap[row.vertical][row.iso_week] = row.order_percentage;
    });

    // Calculate trailing 4-week performance for each merchant
    const netRevenueData: NetRevenueData[] = [];

    for (const opportunity of opportunities) {
      // Get trailing 4-week performance with individual week data for seasonality adjustment
      const performanceQuery = `
        SELECT
          p.iso_week,
          p.ecomm_orders as actual_weekly_orders,
          CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END as weekly_adoption_rate
        FROM performance_actuals p
        WHERE p.salesforce_account_id = ?
          AND p.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
          AND p.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
          AND p.ecomm_orders > 0
        ORDER BY p.iso_week DESC
      `;

      const weeklyPerformance = await new Promise<any[]>((resolve, reject) => {
        db.all(performanceQuery, [opportunity.accountId], (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows || []);
        });
      });

      // Get days live from opportunity query (already filtered at SQL level)
      const daysLive = opportunity.daysLive || 0;

      let projectedAnnualVolume = 0;
      let actualAdoptionRate = 0;

      // For Flat pricing, performance data isn't needed for revenue calculation
      if (opportunity.pricingModel === 'Flat') {
        // Use expected values for Flat pricing (no performance variance)
        projectedAnnualVolume = opportunity.annual_order_volume;
        actualAdoptionRate = opportunity.adoption_rate || 50;
      } else if (weeklyPerformance.length >= 4) {
        // Calculate seasonality-adjusted performance ratio (Volume tab methodology)
        const vertical = opportunity.benchmark_vertical || 'Total ex. Swimwear';
        const seasonalityCurve = vertical === 'Swimwear' ? 'Swimwear' : 'Total ex. Swimwear';

        const recentWeeks = weeklyPerformance.map(week => {
          const expectedWeeklyOrders = seasonalityMap[seasonalityCurve] && seasonalityMap[seasonalityCurve][week.iso_week]
            ? opportunity.annual_order_volume * (seasonalityMap[seasonalityCurve][week.iso_week] / 100)
            : opportunity.annual_order_volume / 52;

          return {
            actual_weekly_orders: week.actual_weekly_orders || 0,
            expected_weekly_orders: expectedWeeklyOrders,
            weekly_adoption_rate: week.weekly_adoption_rate || 0
          };
        });

        // Calculate performance ratio
        const avgActualOrders = recentWeeks.reduce((sum, w) => sum + w.actual_weekly_orders, 0) / recentWeeks.length;
        const avgExpectedOrders = recentWeeks.reduce((sum, w) => sum + w.expected_weekly_orders, 0) / recentWeeks.length;
        const performanceRatio = avgExpectedOrders > 0 ? avgActualOrders / avgExpectedOrders : 1;

        // Apply performance ratio to annual volume (seasonality-adjusted)
        projectedAnnualVolume = opportunity.annual_order_volume * performanceRatio;

        // Calculate average adoption rate from recent weeks
        actualAdoptionRate = (recentWeeks.reduce((sum, w) => sum + w.weekly_adoption_rate, 0) / recentWeeks.length) * 100;
      } else {
        // Insufficient recent data - no forecast available
        projectedAnnualVolume = 0;
        actualAdoptionRate = 0;
      }

      // Calculate expected and actual revenue
      const expectedRevenue = calculateExpectedRevenue(opportunity);
      const actualRevenue = calculateActualRevenue(opportunity, {
        projected_annual_volume: projectedAnnualVolume,
        actual_adoption_rate: actualAdoptionRate
      });

      // Calculate variances
      const revenueVariance = actualRevenue - expectedRevenue;
      const revenueVariancePercent = expectedRevenue > 0 ? (revenueVariance / expectedRevenue) * 100 : 0;
      const adoptionVariance = actualAdoptionRate - (opportunity.adoption_rate || 50);
      const volumeVariance = ((projectedAnnualVolume - opportunity.annual_order_volume) / opportunity.annual_order_volume) * 100;

      // Calculate variance contributions
      // Revenue with expected adoption but actual volume
      const revenueWithExpectedAdoption = calculateActualRevenue(opportunity, {
        projected_annual_volume: projectedAnnualVolume,
        actual_adoption_rate: opportunity.adoption_rate || 50
      });

      // Revenue with expected volume but actual adoption
      const revenueWithExpectedVolume = calculateActualRevenue(opportunity, {
        projected_annual_volume: opportunity.annual_order_volume,
        actual_adoption_rate: actualAdoptionRate
      });

      // Isolate variance contributions
      const volumeContribution = revenueWithExpectedAdoption - expectedRevenue;
      const adoptionContribution = revenueWithExpectedVolume - expectedRevenue;

      // Remaining variance (interaction effect)
      const interactionContribution = actualRevenue - revenueWithExpectedAdoption - revenueWithExpectedVolume + expectedRevenue;

      // Calculate Adjustment Needed logic
      // Volume: >20% worse than initial 12 month volume (volumeVariance < -20)
      // Adoption Rate: >1000bps (10%) worse than initial adoption rate (adoptionVariance < -10)
      const volumeNeedsAdjustment = volumeVariance < -20;
      const adoptionNeedsAdjustment = adoptionVariance < -10;
      const adjustmentNeeded = volumeNeedsAdjustment || adoptionNeedsAdjustment;

      // Calculate Adjustment Status with 60-day rule and data availability
      let adjustmentStatus: string;
      const hasRecentPerformanceData = weeklyPerformance.length > 0;

      if (daysLive < 60) {
        adjustmentStatus = 'Pending (<60 days live)';
      } else if (!hasRecentPerformanceData) {
        adjustmentStatus = 'Pending (insufficient data)';
      } else if (adjustmentNeeded) {
        adjustmentStatus = 'Adjusted';
      } else {
        adjustmentStatus = 'Not Adjusted';
      }

      // Include merchants with sufficient data for forecasting (4+ weeks) OR Flat pricing models
      if (weeklyPerformance.length >= 4 || opportunity.pricingModel === 'Flat') {
        netRevenueData.push({
        accountId: opportunity.accountId,
        opportunityId: opportunity.opportunityId,
        accountName: opportunity.accountName,
        pricingModel: opportunity.pricingModel,
        labelsPaidBy: opportunity.labels_paid_by,
        expectedAnnualRevenue: Math.round(expectedRevenue),
        actualAnnualRevenue: Math.round(actualRevenue),
        revenueVariance: Math.round(revenueVariance),
        revenueVariancePercent: Math.round(revenueVariancePercent * 10) / 10,
        adoptionRateExpected: opportunity.adoption_rate || 50,
        adoptionRateActual: Math.round(actualAdoptionRate * 10) / 10,
        adoptionVariance: Math.round(adoptionVariance * 10) / 10,
        volumeExpected: opportunity.annual_order_volume,
        volumeActual: Math.round(projectedAnnualVolume),
        volumeVariance: Math.round(volumeVariance * 10) / 10,
        volumeContribution: Math.round(volumeContribution),
        adjustmentNeeded: adjustmentNeeded,
        adjustmentStatus: adjustmentStatus,
        adoptionContribution: Math.round(adoptionContribution),
        interactionContribution: Math.round(interactionContribution),
        implementationStatus: opportunity.implementationStatus,
        daysLive: daysLive
      });
      }
    }

    res.json({
      success: true,
      data: netRevenueData
    });

  } catch (error) {
    console.error('Net revenue analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch net revenue analysis'
    });
  } finally {
    db.close();
  }
});

// Net Revenue Analysis CSV export endpoint
router.get('/net-revenue/export', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const daysLiveFilter = req.query.daysLive as string || 'all';
    const necessaryChangesOnly = req.query.necessaryChangesOnly === 'true';

    // Get opportunities with their expected revenue (same query as main endpoint)
    let opportunitiesQuery = `
      SELECT
        o.account_casesafe_id as accountId,
        o.opportunity_id as opportunityId,
        o.account_name as accountName,
        o.pricing_model as pricingModel,
        o.est_offset_net_revenue as expectedAnnualRevenue,
        o.annual_order_volume,
        o.adoption_rate,
        o.initial_offset_fee,
        o.refund_handling_fee,
        o.domestic_return_rate,
        o.loop_share_percent,
        o.blended_avg_cost_per_return,
        o.labels_paid_by,
        o.benchmark_vertical,
        o.implementation_status as implementationStatus,
        (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) as daysLive
      FROM opportunities o
      WHERE o.checkout_enabled = 'Yes'
        AND (o.annual_order_volume > 0 OR o.pricing_model = 'Flat')
        AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) > 0
    `;

    // Apply days live filter at SQL level for consistency with other tabs
    if (daysLiveFilter !== 'all') {
      if (daysLiveFilter === 'under30') {
        opportunitiesQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) < 30`;
      } else {
        const threshold = parseInt(daysLiveFilter);
        opportunitiesQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ${threshold}`;
      }
    }

    const opportunities = await new Promise<any[]>((resolve, reject) => {
      db.all(opportunitiesQuery, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });

    // Get seasonality data
    const seasonalityData = await new Promise<any[]>((resolve, reject) => {
      db.all('SELECT vertical, iso_week, order_percentage FROM seasonality_curves ORDER BY vertical, iso_week', (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });

    // Build seasonality lookup map
    const seasonalityMap: { [key: string]: { [week: number]: number } } = {};
    seasonalityData.forEach(row => {
      if (!seasonalityMap[row.vertical]) {
        seasonalityMap[row.vertical] = {};
      }
      seasonalityMap[row.vertical][row.iso_week] = row.order_percentage;
    });

    // Calculate data for CSV export
    const csvData: any[] = [];

    for (const opportunity of opportunities) {
      // Get trailing 4-week performance with individual week data for seasonality adjustment
      const performanceQuery = `
        SELECT
          p.iso_week,
          p.ecomm_orders as actual_weekly_orders,
          CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END as weekly_adoption_rate
        FROM performance_actuals p
        WHERE p.salesforce_account_id = ?
          AND p.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
          AND p.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
          AND p.ecomm_orders > 0
        ORDER BY p.iso_week DESC
      `;

      const weeklyPerformance = await new Promise<any[]>((resolve, reject) => {
        db.all(performanceQuery, [opportunity.accountId], (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows || []);
        });
      });

      const daysLive = opportunity.daysLive || 0;
      let projectedAnnualVolume = 0;
      let actualAdoptionRate = 0;

      if (weeklyPerformance.length >= 4) {
        // Calculate seasonality-adjusted performance ratio
        const vertical = opportunity.benchmark_vertical || 'Total ex. Swimwear';
        const seasonalityCurve = vertical === 'Swimwear' ? 'Swimwear' : 'Total ex. Swimwear';

        const recentWeeks = weeklyPerformance.map(week => {
          const expectedWeeklyOrders = seasonalityMap[seasonalityCurve] && seasonalityMap[seasonalityCurve][week.iso_week]
            ? opportunity.annual_order_volume * (seasonalityMap[seasonalityCurve][week.iso_week] / 100)
            : opportunity.annual_order_volume / 52;

          return {
            actual_weekly_orders: week.actual_weekly_orders || 0,
            expected_weekly_orders: expectedWeeklyOrders,
            weekly_adoption_rate: week.weekly_adoption_rate || 0
          };
        });

        // Calculate performance ratio
        const avgActualOrders = recentWeeks.reduce((sum, w) => sum + w.actual_weekly_orders, 0) / recentWeeks.length;
        const avgExpectedOrders = recentWeeks.reduce((sum, w) => sum + w.expected_weekly_orders, 0) / recentWeeks.length;
        const performanceRatio = avgExpectedOrders > 0 ? avgActualOrders / avgExpectedOrders : 1;

        projectedAnnualVolume = opportunity.annual_order_volume * performanceRatio;
        actualAdoptionRate = (recentWeeks.reduce((sum, w) => sum + w.weekly_adoption_rate, 0) / recentWeeks.length) * 100;
      } else {
        // Insufficient recent data - no forecast available
        projectedAnnualVolume = 0;
        actualAdoptionRate = 0;
      }

      // Calculate expected and actual revenue
      const expectedRevenue = calculateExpectedRevenue(opportunity);
      const actualRevenue = calculateActualRevenue(opportunity, {
        projected_annual_volume: projectedAnnualVolume,
        actual_adoption_rate: actualAdoptionRate
      });

      // Calculate variances
      const revenueVariance = actualRevenue - expectedRevenue;
      const revenueVariancePercent = expectedRevenue > 0 ? (revenueVariance / expectedRevenue) * 100 : 0;
      const adoptionVariance = actualAdoptionRate - (opportunity.adoption_rate || 50);
      const volumeVariance = ((projectedAnnualVolume - opportunity.annual_order_volume) / opportunity.annual_order_volume) * 100;

      // Calculate variance contributions
      const revenueWithExpectedAdoption = calculateActualRevenue(opportunity, {
        projected_annual_volume: projectedAnnualVolume,
        actual_adoption_rate: opportunity.adoption_rate || 50
      });

      const revenueWithExpectedVolume = calculateActualRevenue(opportunity, {
        projected_annual_volume: opportunity.annual_order_volume,
        actual_adoption_rate: actualAdoptionRate
      });

      const volumeContribution = revenueWithExpectedAdoption - expectedRevenue;
      const adoptionContribution = revenueWithExpectedVolume - expectedRevenue;
      const interactionContribution = actualRevenue - revenueWithExpectedAdoption - revenueWithExpectedVolume + expectedRevenue;

      const volumeVariancePercent = ((projectedAnnualVolume - opportunity.annual_order_volume) / opportunity.annual_order_volume) * 100;
      const adoptionVarianceBps = (actualAdoptionRate - (opportunity.adoption_rate || 50)) * 100; // Convert to basis points

      const hasVolumeIssue = volumeVariancePercent <= -20; // -20% or worse volume variance
      const hasAdoptionIssue = adoptionVarianceBps <= -1000; // -1000bps or worse adoption variance

      // Only include merchants with sufficient data for forecasting (4+ weeks)
      if (weeklyPerformance.length >= 4) {
        const merchantData: any = {
        'SFDC Account ID': opportunity.accountId,
        'SFDC Opportunity ID': opportunity.opportunityId || '',
        'Merchant Name': opportunity.accountName,
        'Original 12 Month Order Volume': opportunity.annual_order_volume,
        'Original Adoption Rate': ((opportunity.adoption_rate || 50) / 100).toFixed(2)
      };

      // Calculate Adjustment Status first to determine column filling logic
      let adjustmentStatus: string;
      const hasRecentPerformanceData = weeklyPerformance.length > 0;

      if (daysLive < 60) {
        adjustmentStatus = 'Pending';
      } else if (!hasRecentPerformanceData) {
        adjustmentStatus = 'Pending';
      } else if (hasVolumeIssue || hasAdoptionIssue) {
        adjustmentStatus = 'Adjusted';
      } else {
        adjustmentStatus = 'Not Adjusted';
      }

      // Only include problematic columns when necessaryChangesOnly is enabled and merchant has "Adjusted" status
      if (necessaryChangesOnly) {
        // Only fill in data for merchants with "Adjusted" status
        if (adjustmentStatus === 'Adjusted') {
          if (hasVolumeIssue) {
            merchantData['Forecasted 12 Month Order Volume'] = Math.round(projectedAnnualVolume);
          }
          if (hasAdoptionIssue) {
            merchantData['Trailing 4 Week Adoption Rate'] = (actualAdoptionRate / 100).toFixed(2);
          }
        }
        // For all other statuses (Pending, Not Adjusted), leave these columns empty (will be handled in CSV generation)
      } else {
        // Include all columns for normal export
        merchantData['Forecasted 12 Month Order Volume'] = Math.round(projectedAnnualVolume);
        merchantData['Trailing 4 Week Adoption Rate'] = (actualAdoptionRate / 100).toFixed(2);
      }

      merchantData['Adjustment Status'] = adjustmentStatus;

      // Always include revenue columns at the end
      merchantData['Expected Annual Revenue'] = Math.round(expectedRevenue);
      merchantData['Projected Annual Revenue'] = Math.round(actualRevenue);
      merchantData['Revenue Variance'] = Math.round(revenueVariance);

      csvData.push(merchantData);
      }
    }

    // Convert to CSV format
    if (csvData.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No data available for export'
      });
      return;
    }

    // For necessaryChangesOnly, ensure consistent column structure
    let headers: string[];
    if (necessaryChangesOnly) {
      // Define the maximum possible columns for necessary changes export
      headers = [
        'SFDC Account ID',
        'SFDC Opportunity ID',
        'Merchant Name',
        'Original 12 Month Order Volume',
        'Original Adoption Rate',
        'Forecasted 12 Month Order Volume',
        'Trailing 4 Week Adoption Rate',
        'Adjustment Status',
        'Expected Annual Revenue',
        'Projected Annual Revenue',
        'Revenue Variance'
      ];
    } else {
      headers = Object.keys(csvData[0]);
    }

    const csvContent = [
      headers.join(','),
      ...csvData.map(row =>
        headers.map(header => {
          const value = row[header];
          // Return empty string for missing columns in necessaryChangesOnly mode
          if (value === undefined || value === null) {
            return '';
          }
          // Escape commas and quotes in CSV values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Set headers for CSV download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `net-revenue-analysis-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Net revenue CSV export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export net revenue analysis'
    });
  } finally {
    db.close();
  }
});

// ACV Impacts Analysis endpoint
router.get('/acv-impacts', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const daysLiveFilter = req.query.daysLive as string;
    const search = req.query.search as string;

    // Build query with filters - include ALL opportunities, even without actuals
    let opportunitiesQuery = `
      SELECT
        o.account_casesafe_id as accountId,
        o.account_name,
        o.opportunity_id as opportunityId,
        o.benchmark_vertical,
        o.annual_order_volume,
        o.pricing_model,
        o.labels_paid_by,
        o.loop_share_percent,
        o.est_offset_net_revenue,
        o.initial_offset_fee,
        o.refund_handling_fee,
        o.blended_avg_cost_per_return,
        o.domestic_return_rate,
        o.adoption_rate,
        o.net_acv,
        o.company_acv_starting_value,
        o.company_acv_ending_value,
        (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date)
         FROM performance_actuals p
         WHERE p.salesforce_account_id = o.account_casesafe_id
         LIMIT 1) as daysLive,
        (SELECT COUNT(*) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id) as hasActualsData
      FROM opportunities o
      WHERE o.checkout_enabled = 'Yes'
        AND o.net_acv IS NOT NULL
        AND o.net_acv != 0
    `;

    // Apply days live filter (only apply to merchants with actuals data)
    if (daysLiveFilter && daysLiveFilter !== 'all') {
      if (daysLiveFilter === 'under30') {
        opportunitiesQuery += ` AND ((SELECT COUNT(*) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id) = 0 OR (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) < 30)`;
      } else {
        const threshold = parseInt(daysLiveFilter);
        opportunitiesQuery += ` AND ((SELECT COUNT(*) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id) = 0 OR (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ${threshold})`;
      }
    }

    // Apply search filter
    if (search) {
      opportunitiesQuery += ` AND LOWER(o.account_name) LIKE LOWER('%${search}%')`;
    }

    const opportunities = await new Promise<any[]>((resolve, reject) => {
      db.all(opportunitiesQuery, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });

    // Get seasonality data
    const seasonalityData = await new Promise<any[]>((resolve, reject) => {
      db.all('SELECT vertical, iso_week, order_percentage FROM seasonality_curves ORDER BY vertical, iso_week', (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });

    // Build seasonality lookup map
    const seasonalityMap: { [key: string]: { [week: number]: number } } = {};
    seasonalityData.forEach(row => {
      if (!seasonalityMap[row.vertical]) {
        seasonalityMap[row.vertical] = {};
      }
      seasonalityMap[row.vertical][row.iso_week] = row.order_percentage;
    });

    // Calculate ACV impacts for each merchant
    const merchantData: any[] = [];
    let totalOriginalNetAcv = 0;
    let totalProjectedNetAcv = 0;

    for (const opportunity of opportunities) {
      // Get trailing 4-week performance for projection calculation
      const performanceQuery = `
        SELECT
          p.iso_week,
          p.ecomm_orders as actual_weekly_orders,
          CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END as weekly_adoption_rate
        FROM performance_actuals p
        WHERE p.salesforce_account_id = ?
          AND p.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
          AND p.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
          AND p.ecomm_orders > 0
        ORDER BY p.iso_week DESC
      `;

      const weeklyPerformance = await new Promise<any[]>((resolve, reject) => {
        db.all(performanceQuery, [opportunity.accountId], (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows || []);
        });
      });

      // For Flat pricing, performance data isn't needed for ACV calculation
      let projectedAnnualVolume = 0;
      let actualAdoptionRate = 0;

      if (opportunity.pricing_model === 'Flat') {
        // Use expected values for Flat pricing (no performance variance)
        projectedAnnualVolume = opportunity.annual_order_volume;
        actualAdoptionRate = opportunity.adoption_rate || 50;
      } else if (weeklyPerformance.length >= 4) {
        // Calculate projected annual revenue using same logic as net revenue tab
        const vertical = opportunity.benchmark_vertical || 'Total ex. Swimwear';
        const seasonalityCurve = vertical === 'Swimwear' ? 'Swimwear' : 'Total ex. Swimwear';

        const recentWeeks = weeklyPerformance.map(week => {
          const expectedWeeklyOrders = seasonalityMap[seasonalityCurve] && seasonalityMap[seasonalityCurve][week.iso_week]
            ? opportunity.annual_order_volume * (seasonalityMap[seasonalityCurve][week.iso_week] / 100)
            : opportunity.annual_order_volume / 52;

          return {
            actual_weekly_orders: week.actual_weekly_orders || 0,
            expected_weekly_orders: expectedWeeklyOrders,
            weekly_adoption_rate: week.weekly_adoption_rate || 0
          };
        });

        // Calculate performance ratio and projected volumes
        const avgActualOrders = recentWeeks.reduce((sum, w) => sum + w.actual_weekly_orders, 0) / recentWeeks.length;
        const avgExpectedOrders = recentWeeks.reduce((sum, w) => sum + w.expected_weekly_orders, 0) / recentWeeks.length;
        const performanceRatio = avgExpectedOrders > 0 ? avgActualOrders / avgExpectedOrders : 1;
        projectedAnnualVolume = opportunity.annual_order_volume * performanceRatio;
        actualAdoptionRate = (recentWeeks.reduce((sum, w) => sum + w.weekly_adoption_rate, 0) / recentWeeks.length) * 100;
      }

      // Calculate projected revenue and ACV impacts for ALL merchants
      let projectedRevenue: number;
      let hasSufficientData: boolean;

      // Determine if we have sufficient data for projection
      if ((opportunity.hasActualsData > 0 && weeklyPerformance.length >= 4) || opportunity.pricing_model === 'Flat') {
        hasSufficientData = true;
        // Calculate projected annual revenue using performance data
        projectedRevenue = calculateActualRevenue({
          pricingModel: opportunity.pricing_model,
          expectedAnnualRevenue: opportunity.est_offset_net_revenue,
          initial_offset_fee: opportunity.initial_offset_fee,
          refund_handling_fee: opportunity.refund_handling_fee,
          domestic_return_rate: opportunity.domestic_return_rate,
          loop_share_percent: opportunity.loop_share_percent,
          blended_avg_cost_per_return: opportunity.blended_avg_cost_per_return,
          labels_paid_by: opportunity.labels_paid_by
        }, {
          projected_annual_volume: projectedAnnualVolume,
          actual_adoption_rate: actualAdoptionRate
        });
      } else {
        hasSufficientData = false;
        // Use original projected revenue for insufficient data (including no actuals data)
        projectedRevenue = opportunity.est_offset_net_revenue || 0;
      }

      // Calculate ACV impacts
      const originalNetAcv = opportunity.net_acv || 0;
      const startingAcv = opportunity.company_acv_starting_value || 0;
      const originalEndingAcv = opportunity.company_acv_ending_value || opportunity.est_offset_net_revenue || 0;
      const projectedEndingAcv = projectedRevenue;

      // For insufficient data merchants, ensure projected net ACV equals original net ACV (zero variance)
      const projectedNetAcv = hasSufficientData ?
        (projectedEndingAcv - startingAcv) :
        originalNetAcv;

      const acvVariance = projectedNetAcv - originalNetAcv;
      const acvVariancePercent = originalNetAcv !== 0 ? (acvVariance / Math.abs(originalNetAcv)) * 100 : 0;

      merchantData.push({
        accountId: opportunity.accountId,
        merchantName: opportunity.account_name,
        pricingModel: opportunity.pricing_model,
        labelsPaidBy: opportunity.labels_paid_by,
        originalNetAcv,
        startingAcv,
        originalEndingAcv,
        projectedEndingAcv,
        projectedNetAcv,
        acvVariance,
        acvVariancePercent,
        daysLive: Math.round(opportunity.daysLive || 0),
        hasSufficientData
      });

      totalOriginalNetAcv += originalNetAcv;
      totalProjectedNetAcv += projectedNetAcv;
    }

    // Calculate summary statistics
    const totalAcvVariance = totalProjectedNetAcv - totalOriginalNetAcv;
    const avgAcvVariance = merchantData.length > 0 ? totalAcvVariance / merchantData.length : 0;

    // Count merchants by variance categories
    const varianceCounts = {
      exceeding: merchantData.filter(m => m.acvVariancePercent > 10).length,
      meeting: merchantData.filter(m => m.acvVariancePercent >= -10 && m.acvVariancePercent <= 10).length,
      below: merchantData.filter(m => m.acvVariancePercent < -10 && m.acvVariancePercent >= -30).length,
      significantlyBelow: merchantData.filter(m => m.acvVariancePercent < -30).length
    };

    res.json({
      success: true,
      summary: {
        totalMerchants: merchantData.length,
        totalOriginalNetAcv,
        totalProjectedNetAcv,
        totalAcvVariance,
        avgAcvVariance,
        varianceCounts
      },
      merchants: merchantData.sort((a, b) => a.acvVariance - b.acvVariance)
    });

  } catch (error) {
    console.error('ACV impacts analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate ACV impacts analysis'
    });
  } finally {
    db.close();
  }
});

export default router;