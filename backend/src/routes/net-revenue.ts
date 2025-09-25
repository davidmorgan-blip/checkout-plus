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

    // Calculate trailing 4-week performance for each merchant
    const netRevenueData: NetRevenueData[] = [];

    for (const opportunity of opportunities) {
      // Get trailing 4-week performance, fallback to all-time if no recent data
      const performanceQuery = `
        SELECT
          COALESCE(recent.avg_weekly_orders, historical.avg_weekly_orders, 0) as avg_weekly_orders,
          COALESCE(recent.avg_adoption_rate, historical.avg_adoption_rate, 0) as avg_adoption_rate
        FROM (SELECT 1) dummy
        LEFT JOIN (
          SELECT
            AVG(p.ecomm_orders) as avg_weekly_orders,
            AVG(CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END) as avg_adoption_rate
          FROM performance_actuals p
          WHERE p.salesforce_account_id = ?
            AND p.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
            AND p.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
            AND p.ecomm_orders > 0
        ) recent ON 1=1
        LEFT JOIN (
          SELECT
            AVG(p.ecomm_orders) as avg_weekly_orders,
            AVG(CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END) as avg_adoption_rate
          FROM performance_actuals p
          WHERE p.salesforce_account_id = ?
            AND p.ecomm_orders > 0
        ) historical ON 1=1
      `;

      const performance = await new Promise<any>((resolve, reject) => {
        db.get(performanceQuery, [opportunity.accountId, opportunity.accountId], (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row || {});
        });
      });

      // Get days live from opportunity query (already filtered at SQL level)
      const daysLive = opportunity.daysLive || 0;

      // Skip only if no performance data exists at all
      if (!performance.avg_weekly_orders || performance.avg_weekly_orders <= 0) {
        // Still include merchant with zero performance for analysis
        performance.avg_weekly_orders = 0;
        performance.avg_adoption_rate = 0;
      }

      // Calculate projected annual volume based on trailing performance
      const projectedAnnualVolume = performance.avg_weekly_orders * 52;
      const actualAdoptionRate = (performance.avg_adoption_rate || 0) * 100;

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

export default router;