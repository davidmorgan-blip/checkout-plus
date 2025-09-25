import express from 'express';
import { Database } from 'sqlite3';
import path from 'path';

const router = express.Router();
const dbPath = path.join(__dirname, '../../checkout_plus.db');

interface NetRevenueData {
  accountId: string;
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
      const labelCosts = annual_order_volume * returnRateDecimal * (blended_avg_cost_per_return || 0);
      return revenueFromFees - labelCosts;
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
      const labelCosts = projected_annual_volume * returnRateDecimal * (blended_avg_cost_per_return || 0);
      return revenueFromFees - labelCosts;
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
        (SELECT JULIANDAY('now') - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) as daysLive
      FROM opportunities o
      WHERE o.checkout_enabled = 'Yes'
        AND o.annual_order_volume > 0
        AND o.pricing_model != 'Flat'
        AND (SELECT JULIANDAY('now') - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) > 0
    `;

    // Apply days live filter at SQL level for consistency with other tabs
    if (daysLiveFilter !== 'all') {
      const threshold = parseInt(daysLiveFilter);
      opportunitiesQuery += ` AND (SELECT JULIANDAY('now') - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ${threshold}`;
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

      if (weeklyPerformance.length > 0) {
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
        // Fallback to historical average if no recent data
        const fallbackQuery = `
          SELECT
            AVG(p.ecomm_orders) as avg_weekly_orders,
            AVG(CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END) as avg_adoption_rate
          FROM performance_actuals p
          WHERE p.salesforce_account_id = ?
            AND p.ecomm_orders > 0
        `;

        const fallbackPerformance = await new Promise<any>((resolve, reject) => {
          db.get(fallbackQuery, [opportunity.accountId], (err, row: any) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(row || {});
          });
        });

        if (fallbackPerformance.avg_weekly_orders && fallbackPerformance.avg_weekly_orders > 0) {
          projectedAnnualVolume = fallbackPerformance.avg_weekly_orders * 52;
          actualAdoptionRate = (fallbackPerformance.avg_adoption_rate || 0) * 100;
        } else {
          projectedAnnualVolume = 0;
          actualAdoptionRate = 0;
        }
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

      netRevenueData.push({
        accountId: opportunity.accountId,
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
        adoptionContribution: Math.round(adoptionContribution),
        interactionContribution: Math.round(interactionContribution),
        implementationStatus: opportunity.implementationStatus,
        daysLive: daysLive
      });
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
        o.opportunity_id,
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
        (SELECT JULIANDAY('now') - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) as daysLive
      FROM opportunities o
      WHERE o.checkout_enabled = 'Yes'
        AND o.annual_order_volume > 0
        AND o.pricing_model != 'Flat'
        AND (SELECT JULIANDAY('now') - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) > 0
    `;

    // Apply days live filter
    if (daysLiveFilter !== 'all') {
      const threshold = parseInt(daysLiveFilter);
      opportunitiesQuery += ` AND (SELECT JULIANDAY('now') - JULIANDAY(p.first_offer_date) FROM performance_actuals p WHERE p.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ${threshold}`;
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

      if (weeklyPerformance.length > 0) {
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
        // Fallback to historical average
        const fallbackQuery = `
          SELECT
            AVG(p.ecomm_orders) as avg_weekly_orders,
            AVG(CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END) as avg_adoption_rate
          FROM performance_actuals p
          WHERE p.salesforce_account_id = ?
            AND p.ecomm_orders > 0
        `;

        const fallbackPerformance = await new Promise<any>((resolve, reject) => {
          db.get(fallbackQuery, [opportunity.accountId], (err, row: any) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(row || {});
          });
        });

        if (fallbackPerformance.avg_weekly_orders && fallbackPerformance.avg_weekly_orders > 0) {
          projectedAnnualVolume = fallbackPerformance.avg_weekly_orders * 52;
          actualAdoptionRate = (fallbackPerformance.avg_adoption_rate || 0) * 100;
        } else {
          projectedAnnualVolume = 0;
          actualAdoptionRate = 0;
        }
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

      // If necessaryChangesOnly filter is enabled, exclude merchants with 0% adoption rate first
      // then only include merchants with other issues
      if (necessaryChangesOnly) {
        if (actualAdoptionRate < 1) {
          continue; // Skip merchants with <1% adoption rate - may indicate systemic issues
        }
        if (!hasVolumeIssue && !hasAdoptionIssue) {
          continue; // Skip merchants with no issues
        }
      }

      const merchantData: any = {
        'SFDC Account ID': opportunity.accountId,
        'SFDC Opportunity ID': opportunity.opportunity_id || '',
        'Merchant Name': opportunity.accountName,
        'Original 12 Month Order Volume': opportunity.annual_order_volume,
        'Original Adoption Rate': ((opportunity.adoption_rate || 50) / 100).toFixed(2)
      };

      // Only include problematic columns when necessaryChangesOnly is enabled
      if (necessaryChangesOnly) {
        if (hasVolumeIssue) {
          merchantData['Forecasted 12 Month Order Volume'] = Math.round(projectedAnnualVolume);
        }
        if (hasAdoptionIssue) {
          merchantData['Trailing 4 Week Adoption Rate'] = (actualAdoptionRate / 100).toFixed(2);
        }
      } else {
        // Include all columns for normal export
        merchantData['Forecasted 12 Month Order Volume'] = Math.round(projectedAnnualVolume);
        merchantData['Trailing 4 Week Adoption Rate'] = (actualAdoptionRate / 100).toFixed(2);
      }

      // Always include revenue columns at the end
      merchantData['Expected Annual Revenue'] = Math.round(expectedRevenue);
      merchantData['Projected Annual Revenue'] = Math.round(actualRevenue);
      merchantData['Revenue Variance'] = Math.round(revenueVariance);

      csvData.push(merchantData);
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

export default router;