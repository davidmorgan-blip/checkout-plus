import express from 'express';
import { Database } from 'sqlite3';
import path from 'path';

const router = express.Router();
const dbPath = path.join(__dirname, '../../checkout_plus.db');

interface PerformanceMetrics {
  totalMerchants: number;
  activeMerchants: number;
  totalOpportunities: number;
  opportunitiesWithActuals: number;
  opportunitiesWithoutActuals: number;
  avgAdoptionRate: number;
  avgEligibilityRate: number;
  avgAttachRate: number;
  volumeWeightedAdoptionRate: number;
  volumeWeightedEligibilityRate: number;
  volumeWeightedAttachRate: number;
  weekOverWeekChange: number;
  trailing4WeekAdoptionRate: number;
  trailing4WeekEligibilityRate: number;
  trailing4WeekAttachRate: number;
  trailing4WeekVolumeWeightedAdoptionRate: number;
  trailing4WeekVolumeWeightedEligibilityRate: number;
  trailing4WeekVolumeWeightedAttachRate: number;
}

interface MerchantPerformance {
  salesforce_account_id: string;
  merchant_name: string;
  days_live: number;
  current_adoption_rate: number;
  expected_adoption_rate: number;
  adoption_variance_bps: number;
  trailing_4week_adoption_rate: number;
  trailing_4week_variance_bps: number;
  current_eligibility_rate: number;
  expected_eligibility_rate: number;
  eligibility_variance_bps: number;
  trailing_4week_eligibility_rate: number;
  trailing_4week_eligibility_variance_bps: number;
  current_ecom_orders: number;
  trailing_4week_ecom_orders: number;
  performance_tier: string;
  attach_rate: number;
  iso_week: number;
  ecomm_orders: number;
  accepted_offers: number;
  offer_shown: number;
  eligibility_rate?: number;
}

// Get performance overview metrics
router.get('/overview', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const daysLiveFilter = req.query.daysLive as string || 'all';

    // Get merchant performance with variance calculations using consistent filtering
    const merchantData = await new Promise<any[]>((resolve, reject) => {
      let query = `
        SELECT
          o.account_casesafe_id as salesforce_account_id,
          o.account_name as merchant_name,
          (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) as days_live,
          CASE WHEN COALESCE(p.ecomm_orders, 0) > 0 THEN CAST(COALESCE(p.accepted_offers, 0) AS REAL) / p.ecomm_orders ELSE 0 END as current_adoption_rate,
          o.adoption_rate as expected_adoption_rate,
          CASE WHEN COALESCE(p.ecomm_orders, 0) > 0 THEN
            (((CAST(COALESCE(p.accepted_offers, 0) AS REAL) / p.ecomm_orders) * 100) - o.adoption_rate) * 100
          ELSE 0 END as adoption_variance_bps,
          CASE WHEN COALESCE(p.ecomm_orders, 0) > 0 THEN
            ((((CAST(COALESCE(p.accepted_offers, 0) AS REAL) / p.ecomm_orders) * 100) - o.adoption_rate) / o.adoption_rate * 100)
          ELSE 0 END as adoption_variance_pct,
          CASE WHEN COALESCE(p.ecomm_orders, 0) > 0 THEN CAST(COALESCE(p.offer_shown, 0) AS REAL) / p.ecomm_orders ELSE 0 END as current_eligibility_rate,
          COALESCE(p.attach_rate_avg, 0) as attach_rate,
          COALESCE(p.iso_week, (SELECT MAX(iso_week) FROM performance_actuals)) as iso_week,
          COALESCE(p.ecomm_orders, 0) as ecomm_orders,
          COALESCE(p.accepted_offers, 0) as accepted_offers,
          COALESCE(p.offer_shown, 0) as offer_shown,
          (
            SELECT
              CASE
                WHEN COUNT(DISTINCT p2.iso_week) >= 4 AND SUM(p2.ecomm_orders) > 0 THEN
                  (((CAST(SUM(p2.accepted_offers) AS REAL) / SUM(p2.ecomm_orders)) * 100) - o.adoption_rate) * 100
                ELSE NULL
              END
            FROM performance_actuals p2
            WHERE p2.salesforce_account_id = o.account_casesafe_id
              AND p2.iso_week <= (SELECT MAX(p3.iso_week) FROM performance_actuals p3 WHERE p3.salesforce_account_id = o.account_casesafe_id)
              AND p2.iso_week > (SELECT MAX(p3.iso_week) FROM performance_actuals p3 WHERE p3.salesforce_account_id = o.account_casesafe_id) - 4
          ) as trailing_4week_variance_bps
        FROM opportunities o
        LEFT JOIN performance_actuals p ON o.account_casesafe_id = p.salesforce_account_id
          AND p.iso_week = (SELECT MAX(p2.iso_week) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id AND p2.ecomm_orders > 0)
        WHERE o.checkout_enabled = 'Yes'
          AND o.annual_order_volume > 0
          AND o.pricing_model != 'Flat'
          AND EXISTS (SELECT 1 FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id)
      `;

      if (daysLiveFilter !== 'all') {
        if (daysLiveFilter === 'under30') {
          query += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) < 30`;
        } else if (daysLiveFilter === '30-60') {
          query += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= 30 AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) < 60`;
        } else {
          const threshold = parseInt(daysLiveFilter);
          query += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ${threshold}`;
        }
      }

      db.all(query, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const merchants = rows.map(row => ({
          ...row,
          performance_tier: calculatePerformanceTier(row.trailing_4week_variance_bps !== null ? row.trailing_4week_variance_bps : row.adoption_variance_bps)
        }));

        resolve(merchants);
      });
    });

    // Calculate volume-weighted summary metrics
    const totalEcommOrders = merchantData.reduce((sum, m: any) => sum + (m.ecomm_orders || 0), 0);
    const totalAcceptedOffers = merchantData.reduce((sum, m: any) => sum + (m.accepted_offers || 0), 0);
    const totalOfferShown = merchantData.reduce((sum, m: any) => sum + (m.offer_shown || 0), 0);

    // Calculate trailing 4-week metrics
    const trailing4WeekQuery = `
      SELECT
        SUM(p.ecomm_orders) as total_ecomm_orders,
        SUM(p.accepted_offers) as total_accepted_offers,
        SUM(p.offer_shown) as total_offer_shown
      FROM performance_actuals p
      JOIN opportunities o ON p.salesforce_account_id = o.account_casesafe_id
      WHERE p.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
        AND p.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
      ${daysLiveFilter !== 'all' ? (daysLiveFilter === 'under30' ? 'AND (JULIANDAY(\'now\') - JULIANDAY(p.first_offer_date)) < ?' : daysLiveFilter === '30-60' ? 'AND (JULIANDAY(\'now\') - JULIANDAY(p.first_offer_date)) >= ? AND (JULIANDAY(\'now\') - JULIANDAY(p.first_offer_date)) < ?' : 'AND (JULIANDAY(\'now\') - JULIANDAY(p.first_offer_date)) >= ?') : ''}
    `;

    const trailing4WeekData = await new Promise<any>((resolve, reject) => {
      const trailing4WeekParams = daysLiveFilter !== 'all' ? (daysLiveFilter === 'under30' ? [30] : daysLiveFilter === '30-60' ? [30, 60] : [parseInt(daysLiveFilter)]) : [];
      db.get(trailing4WeekQuery, trailing4WeekParams, (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row || { total_ecomm_orders: 0, total_accepted_offers: 0, total_offer_shown: 0 });
      });
    });

    // Get opportunities count breakdown
    const opportunitiesCount = await new Promise<{total: number, withActuals: number}>((resolve, reject) => {
      db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN pa.salesforce_account_id IS NOT NULL THEN 1 ELSE 0 END) as with_actuals
        FROM opportunities o
        LEFT JOIN (
          SELECT DISTINCT salesforce_account_id
          FROM performance_actuals
          WHERE salesforce_account_id IS NOT NULL
        ) pa ON o.account_casesafe_id = pa.salesforce_account_id
      `, [], (err: Error | null, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          total: row?.total || 0,
          withActuals: row?.with_actuals || 0
        });
      });
    });

    // Calculate simple averages by merchant (not volume-weighted)
    const merchantsWithData = merchantData.filter((m: any) => m.ecomm_orders > 0);
    const simpleAvgAdoptionRate = merchantsWithData.length > 0 ?
      merchantsWithData.reduce((sum: number, m: any) => sum + m.current_adoption_rate, 0) / merchantsWithData.length : 0;
    const simpleAvgEligibilityRate = merchantsWithData.length > 0 ?
      merchantsWithData.reduce((sum: number, m: any) => sum + m.current_eligibility_rate, 0) / merchantsWithData.length : 0;
    const simpleAvgAttachRate = merchantsWithData.length > 0 ?
      merchantsWithData.reduce((sum: number, m: any) => sum + m.attach_rate, 0) / merchantsWithData.length : 0;

    // Calculate trailing 4-week simple averages by merchant
    const trailing4WeekMerchantQuery = `
      SELECT
        o.account_casesafe_id,
        CASE WHEN SUM(p.ecomm_orders) > 0 THEN CAST(SUM(p.accepted_offers) AS REAL) / SUM(p.ecomm_orders) ELSE 0 END as trailing_adoption_rate,
        CASE WHEN SUM(p.ecomm_orders) > 0 THEN CAST(SUM(p.offer_shown) AS REAL) / SUM(p.ecomm_orders) ELSE 0 END as trailing_eligibility_rate,
        CASE WHEN SUM(p.offer_shown) > 0 THEN CAST(SUM(p.accepted_offers) AS REAL) / SUM(p.offer_shown) ELSE 0 END as trailing_attach_rate
      FROM performance_actuals p
      JOIN opportunities o ON p.salesforce_account_id = o.account_casesafe_id
      WHERE p.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
        AND p.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
        AND o.checkout_enabled = 'Yes'
        AND o.annual_order_volume > 0
        AND o.pricing_model != 'Flat'
      GROUP BY o.account_casesafe_id
      HAVING SUM(p.ecomm_orders) > 0
    `;

    const trailing4WeekMerchantData = await new Promise<any[]>((resolve, reject) => {
      db.all(trailing4WeekMerchantQuery, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });

    const simpleAvgTrailing4WeekAdoptionRate = trailing4WeekMerchantData.length > 0 ?
      trailing4WeekMerchantData.reduce((sum: number, m: any) => sum + m.trailing_adoption_rate, 0) / trailing4WeekMerchantData.length : 0;
    const simpleAvgTrailing4WeekEligibilityRate = trailing4WeekMerchantData.length > 0 ?
      trailing4WeekMerchantData.reduce((sum: number, m: any) => sum + m.trailing_eligibility_rate, 0) / trailing4WeekMerchantData.length : 0;
    const simpleAvgTrailing4WeekAttachRate = trailing4WeekMerchantData.length > 0 ?
      trailing4WeekMerchantData.reduce((sum: number, m: any) => sum + m.trailing_attach_rate, 0) / trailing4WeekMerchantData.length : 0;

    const metrics: PerformanceMetrics = {
      totalMerchants: merchantData.length,
      activeMerchants: merchantData.filter((m: any) => m.days_live >= 7).length,
      totalOpportunities: opportunitiesCount.total,
      opportunitiesWithActuals: opportunitiesCount.withActuals,
      opportunitiesWithoutActuals: opportunitiesCount.total - opportunitiesCount.withActuals,
      // Simple averages by merchant (new primary metrics)
      avgAdoptionRate: simpleAvgAdoptionRate,
      avgEligibilityRate: simpleAvgEligibilityRate,
      avgAttachRate: simpleAvgAttachRate,
      // Volume-weighted averages (legacy/reference metrics)
      volumeWeightedAdoptionRate: totalEcommOrders > 0 ? totalAcceptedOffers / totalEcommOrders : 0,
      volumeWeightedEligibilityRate: totalEcommOrders > 0 ? totalOfferShown / totalEcommOrders : 0,
      volumeWeightedAttachRate: totalOfferShown > 0 ? totalAcceptedOffers / totalOfferShown : 0,
      weekOverWeekChange: 0, // TODO: Calculate from previous week
      // Simple trailing 4-week averages by merchant (new primary metrics)
      trailing4WeekAdoptionRate: simpleAvgTrailing4WeekAdoptionRate,
      trailing4WeekEligibilityRate: simpleAvgTrailing4WeekEligibilityRate,
      trailing4WeekAttachRate: simpleAvgTrailing4WeekAttachRate,
      // Volume-weighted trailing 4-week averages (legacy/reference metrics)
      trailing4WeekVolumeWeightedAdoptionRate: (trailing4WeekData as any)?.total_ecomm_orders > 0 ?
        (trailing4WeekData as any).total_accepted_offers / (trailing4WeekData as any).total_ecomm_orders : 0,
      trailing4WeekVolumeWeightedEligibilityRate: (trailing4WeekData as any)?.total_ecomm_orders > 0 ?
        (trailing4WeekData as any).total_offer_shown / (trailing4WeekData as any).total_ecomm_orders : 0,
      trailing4WeekVolumeWeightedAttachRate: (trailing4WeekData as any)?.total_offer_shown > 0 ?
        (trailing4WeekData as any).total_accepted_offers / (trailing4WeekData as any).total_offer_shown : 0
    };

    // Performance distribution
    const performanceTiers = {
      exceeding: merchantData.filter((m: any) => m.performance_tier === 'exceeding').length,
      meeting: merchantData.filter((m: any) => m.performance_tier === 'meeting').length,
      slightlyBelow: merchantData.filter((m: any) => m.performance_tier === 'slightly_below').length,
      significantlyBelow: merchantData.filter((m: any) => m.performance_tier === 'significantly_below').length
    };

    res.json({
      success: true,
      data: {
        metrics,
        performanceTiers,
        merchantCount: merchantData.length,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics overview'
    });
  } finally {
    db.close();
  }
});

// Get merchant performance list with filtering
router.get('/merchants', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const daysLiveFilter = req.query.daysLive as string || 'all';
    const performanceTier = req.query.tier as string || 'all';
    const merchantFilter = req.query.merchant as string || '';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // First, get all merchant data with calculated performance tiers
    let baseQuery = `
      SELECT
        o.account_casesafe_id as salesforce_account_id,
        o.opportunity_id,
        o.account_name as merchant_name,
        (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) as days_live,
        CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END as current_adoption_rate,
        o.adoption_rate as expected_adoption_rate,
        CASE WHEN p.ecomm_orders > 0 THEN
          (((CAST(p.accepted_offers AS REAL) / p.ecomm_orders) * 100) - o.adoption_rate) * 100
        ELSE 0 END as adoption_variance_bps,
        CASE WHEN p.ecomm_orders > 0 THEN
          ((((CAST(p.accepted_offers AS REAL) / p.ecomm_orders) * 100) - o.adoption_rate) / o.adoption_rate * 100)
        ELSE 0 END as adoption_variance_pct,
        CASE WHEN COALESCE(p.ecomm_orders, 0) > 0 THEN CAST(COALESCE(p.offer_shown, 0) AS REAL) / p.ecomm_orders ELSE 0 END as current_eligibility_rate,
        0.707 as expected_eligibility_rate,
        CASE WHEN COALESCE(p.ecomm_orders, 0) > 0 THEN
          (((CAST(COALESCE(p.offer_shown, 0) AS REAL) / p.ecomm_orders) * 100) - 70.7) * 100
        ELSE 0 END as eligibility_variance_bps,
        COALESCE(p.attach_rate_avg, 0) as attach_rate,
        COALESCE(p.ecomm_orders, 0) as current_ecom_orders,
        COALESCE(p.iso_week, (SELECT MAX(iso_week) FROM performance_actuals)) as current_week,
        o.benchmark_vertical,
        o.pricing_model,
        o.labels_paid_by,
        (
          SELECT
            CASE
              WHEN COUNT(DISTINCT p2.iso_week) >= 4 AND SUM(p2.ecomm_orders) > 0 THEN
                CAST(SUM(p2.accepted_offers) AS REAL) / SUM(p2.ecomm_orders)
              ELSE NULL
            END
          FROM performance_actuals p2
          WHERE p2.salesforce_account_id = o.account_casesafe_id
            AND p2.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
            AND p2.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
        ) as trailing_4week_adoption_rate,
        (
          SELECT
            CASE
              WHEN COUNT(DISTINCT p2.iso_week) >= 4 AND SUM(p2.ecomm_orders) > 0 THEN
                (((CAST(SUM(p2.accepted_offers) AS REAL) / SUM(p2.ecomm_orders)) * 100) - o.adoption_rate) * 100
              ELSE NULL
            END
          FROM performance_actuals p2
          WHERE p2.salesforce_account_id = o.account_casesafe_id
            AND p2.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
            AND p2.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
        ) as trailing_4week_variance_bps,
        (
          SELECT
            CASE
              WHEN COUNT(DISTINCT p2.iso_week) >= 4 AND SUM(p2.ecomm_orders) > 0 THEN
                CAST(SUM(p2.offer_shown) AS REAL) / SUM(p2.ecomm_orders)
              ELSE NULL
            END
          FROM performance_actuals p2
          WHERE p2.salesforce_account_id = o.account_casesafe_id
            AND p2.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
            AND p2.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
        ) as trailing_4week_eligibility_rate,
        (
          SELECT
            CASE
              WHEN COUNT(DISTINCT p2.iso_week) >= 4 AND SUM(p2.ecomm_orders) > 0 THEN
                (((CAST(SUM(p2.offer_shown) AS REAL) / SUM(p2.ecomm_orders)) * 100) - 70.7) * 100
              ELSE NULL
            END
          FROM performance_actuals p2
          WHERE p2.salesforce_account_id = o.account_casesafe_id
            AND p2.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
            AND p2.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
        ) as trailing_4week_eligibility_variance_bps,
        (
          SELECT
            CASE
              WHEN COUNT(DISTINCT p2.iso_week) >= 4 THEN AVG(p2.ecomm_orders)
              ELSE NULL
            END
          FROM performance_actuals p2
          WHERE p2.salesforce_account_id = o.account_casesafe_id
            AND p2.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
            AND p2.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
        ) as trailing_4week_ecom_orders
      FROM opportunities o
      LEFT JOIN (
        SELECT DISTINCT
          salesforce_account_id,
          iso_week,
          first_offer_date,
          SUM(ecomm_orders) as ecomm_orders,
          SUM(accepted_offers) as accepted_offers,
          SUM(offer_shown) as offer_shown,
          AVG(attach_rate_avg) as attach_rate_avg
        FROM performance_actuals
        GROUP BY salesforce_account_id, iso_week
      ) p ON o.account_casesafe_id = p.salesforce_account_id
        AND p.iso_week = (SELECT MAX(p2.iso_week) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id)
      WHERE o.checkout_enabled = 'Yes'
        AND o.annual_order_volume > 0
        AND o.pricing_model != 'Flat'
        AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) > 0
    `;

    const params: any[] = [];

    if (daysLiveFilter !== 'all') {
      if (daysLiveFilter === 'under30') {
        baseQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) < ?`;
        params.push(30);
      } else if (daysLiveFilter === '30-60') {
        baseQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ? AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) < ?`;
        params.push(30);
        params.push(60);
      } else {
        const threshold = parseInt(daysLiveFilter);
        baseQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ?`;
        params.push(threshold);
      }
    }

    if (merchantFilter) {
      baseQuery += ` AND o.account_name = ?`;
      params.push(merchantFilter);
    }

    baseQuery += ` ORDER BY trailing_4week_ecom_orders DESC`;

    const allMerchantData = await new Promise<MerchantPerformance[]>((resolve, reject) => {
      db.all(baseQuery, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const merchants = rows.map(row => ({
          ...row,
          performance_tier: calculatePerformanceTier(row.trailing_4week_variance_bps !== null ? row.trailing_4week_variance_bps : row.adoption_variance_bps)
        }));

        resolve(merchants);
      });
    });

    // Filter by performance tier if specified, then apply pagination
    const filteredData = performanceTier === 'all'
      ? allMerchantData
      : allMerchantData.filter(m => m.performance_tier === performanceTier);

    const paginatedData = filteredData.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedData,
      total: filteredData.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('Analytics merchants error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch merchant analytics'
    });
  } finally {
    db.close();
  }
});

// Get variance contributors (top positive and negative)
router.get('/variance-contributors', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const query = `
      SELECT
        p.salesforce_account_id,
        p.merchant_name,
        p.adoption_rate_avg as actual_adoption_rate,
        o.adoption_rate as expected_adoption_rate,
        (p.adoption_rate_avg - o.adoption_rate) as adoption_variance,
        p.order_count,
        (p.order_count * (p.adoption_rate_avg - o.adoption_rate)) as weighted_variance_impact,
        JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) as days_live
      FROM performance_actuals p
      JOIN opportunities o ON p.salesforce_account_id = o.account_casesafe_id
      WHERE p.iso_week = (SELECT MAX(iso_week) FROM performance_actuals)
        AND (JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date)) >= 30
      ORDER BY ABS(weighted_variance_impact) DESC
      LIMIT 10
    `;

    const contributors = await new Promise<any[]>((resolve, reject) => {
      db.all(query, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });

    const topPositive = contributors
      .filter(c => c.weighted_variance_impact > 0)
      .slice(0, 5);

    const topNegative = contributors
      .filter(c => c.weighted_variance_impact < 0)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        topPositive,
        topNegative,
        totalVarianceImpact: contributors.reduce((sum, c) => sum + c.weighted_variance_impact, 0)
      }
    });

  } catch (error) {
    console.error('Variance contributors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch variance contributors'
    });
  } finally {
    db.close();
  }
});

// Get volume analysis with weekly trends and forecasting
router.get('/volume', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const daysLiveFilter = req.query.daysLive as string || 'all';

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

    // Get weekly trends with expected orders calculated from annual volume + seasonality
    let weeklyTrendsQuery = `
      SELECT
        o.account_casesafe_id as salesforce_account_id,
        o.opportunity_id,
        o.account_name as merchant_name,
        p.iso_week,
        COALESCE(p.ecomm_orders, 0) as actual_weekly_orders,
        COALESCE(p.accepted_offers, 0) as accepted_offers,
        o.benchmark_vertical,
        o.annual_order_volume,
        o.labels_paid_by,
        o.adoption_rate as expected_adoption_rate,
        CASE WHEN COALESCE(p.ecomm_orders, 0) > 0 THEN CAST(COALESCE(p.accepted_offers, 0) AS REAL) / p.ecomm_orders ELSE 0 END as actual_adoption_rate,
        (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) as days_live
      FROM opportunities o
      LEFT JOIN performance_actuals p ON o.account_casesafe_id = p.salesforce_account_id
      WHERE o.checkout_enabled = 'Yes'
        AND o.annual_order_volume > 0
        AND o.pricing_model != 'Flat'
        AND EXISTS (SELECT 1 FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id)
    `;

    const params: any[] = [];
    if (daysLiveFilter !== 'all') {
      if (daysLiveFilter === 'under30') {
        weeklyTrendsQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) < ?`;
        params.push(30);
      } else if (daysLiveFilter === '30-60') {
        weeklyTrendsQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ? AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) < ?`;
        params.push(30);
        params.push(60);
      } else {
        const threshold = parseInt(daysLiveFilter);
        weeklyTrendsQuery += ` AND (SELECT JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p2.first_offer_date) FROM performance_actuals p2 WHERE p2.salesforce_account_id = o.account_casesafe_id LIMIT 1) >= ?`;
        params.push(threshold);
      }
    }

    weeklyTrendsQuery += ` ORDER BY merchant_name, p.iso_week`;

    const weeklyTrends = await new Promise<any[]>((resolve, reject) => {
      db.all(weeklyTrendsQuery, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        // Calculate expected weekly orders using seasonality
        const enrichedRows = rows.map(row => {
          const vertical = row.benchmark_vertical;
          const seasonalityCurve = (vertical === 'Swimwear') ? 'Swimwear' : 'Total ex. Swimwear';
          const seasonalityPercent = seasonalityMap[seasonalityCurve]?.[row.iso_week] || 1.92; // Default ~1/52
          const expectedWeeklyOrders = row.annual_order_volume * (seasonalityPercent / 100);

          return {
            ...row,
            expected_weekly_orders: expectedWeeklyOrders,
            variance_orders: row.actual_weekly_orders - expectedWeeklyOrders,
            variance_percentage: expectedWeeklyOrders > 0 ?
              ((row.actual_weekly_orders - expectedWeeklyOrders) / expectedWeeklyOrders * 100) : 0
          };
        });
        resolve(enrichedRows);
      });
    });

    // Calculate summary metrics
    const currentWeek = weeklyTrends.length > 0 ? Math.max(...weeklyTrends.map(t => t.iso_week)) : 38;
    const currentWeekData = weeklyTrends.filter(t => t.iso_week === currentWeek);

    const totalCurrentOrders = currentWeekData.reduce((sum, m) => sum + (m.actual_weekly_orders || 0), 0);
    const totalExpectedOrders = currentWeekData.reduce((sum, m) => sum + (m.expected_weekly_orders || 0), 0);
    const totalVarianceOrders = totalCurrentOrders - totalExpectedOrders;
    const volumeVariancePercentage = totalExpectedOrders > 0 ?
      (totalVarianceOrders / totalExpectedOrders * 100) : 0;

    // Calculate trailing 4-week averages
    const recent4Weeks = [currentWeek, currentWeek-1, currentWeek-2, currentWeek-3];
    const trailing4WeekData = weeklyTrends.filter(t => recent4Weeks.includes(t.iso_week));
    const avgTrailing4WeekOrders = trailing4WeekData.length > 0 ?
      trailing4WeekData.reduce((sum, m) => sum + (m.actual_weekly_orders || 0), 0) / 4 : 0;
    const avgExpectedTrailing4WeekOrders = trailing4WeekData.length > 0 ?
      trailing4WeekData.reduce((sum, m) => sum + (m.expected_weekly_orders || 0), 0) / 4 : 0;

    // Calculate forecasts with seasonality
    const uniqueMerchants = new Set(weeklyTrends.map(t => t.salesforce_account_id));
    const forecasts: any[] = [];

    for (const merchantId of uniqueMerchants) {
      const merchantWeeks = weeklyTrends.filter(t => t.salesforce_account_id === merchantId);
      if (merchantWeeks.length >= 4) {
        const recentWeeks = merchantWeeks.slice(-4);
        const avgActualOrders = recentWeeks.reduce((sum, w) => sum + w.actual_weekly_orders, 0) / 4;
        const avgExpectedOrders = recentWeeks.reduce((sum, w) => sum + w.expected_weekly_orders, 0) / 4;
        const performanceRatio = avgExpectedOrders > 0 ? avgActualOrders / avgExpectedOrders : 1;
        const merchant = merchantWeeks[0];

        // Project annual volume based on performance ratio
        const projectedAnnualVolume = merchant.annual_order_volume * performanceRatio;

        forecasts.push({
          salesforce_account_id: merchantId,
          opportunity_id: merchant.opportunity_id,
          merchant_name: merchant.merchant_name,
          benchmark_vertical: merchant.benchmark_vertical,
          labels_paid_by: merchant.labels_paid_by,
          trailing_4week_avg_orders: avgActualOrders,
          expected_weekly_orders: avgExpectedOrders,
          days_live: merchant.days_live,
          annual_order_volume: merchant.annual_order_volume,
          forecast_12month_orders: Math.round(projectedAnnualVolume),
          forecast_monthly_breakdown: null
        });
      }
    }

    // Calculate total opportunity annual volume for merchants with forecasts
    const totalOpportunityAnnualVolume = forecasts.reduce((sum, f) => {
      const merchant = weeklyTrends.find(w => w.salesforce_account_id === f.salesforce_account_id);
      return sum + (merchant ? merchant.annual_order_volume : 0);
    }, 0);

    const totalForecast12MonthOrders = forecasts.reduce((sum, f) => sum + (f.forecast_12month_orders || 0), 0);
    const forecast12MonthVarianceOrders = totalForecast12MonthOrders - totalOpportunityAnnualVolume;
    const forecast12MonthVariancePercentage = totalOpportunityAnnualVolume > 0 ?
      ((totalForecast12MonthOrders - totalOpportunityAnnualVolume) / totalOpportunityAnnualVolume * 100) : 0;

    res.json({
      success: true,
      data: {
        summary: {
          currentWeekOrders: totalCurrentOrders,
          expectedWeekOrders: Math.round(totalExpectedOrders),
          volumeVarianceOrders: Math.round(totalVarianceOrders),
          volumeVariancePercentage: Math.round(volumeVariancePercentage * 10) / 10,
          avgTrailing4WeekOrders: Math.round(avgTrailing4WeekOrders),
          avgExpectedTrailing4WeekOrders: Math.round(avgExpectedTrailing4WeekOrders),
          trailing4WeekVarianceOrders: Math.round(avgTrailing4WeekOrders - avgExpectedTrailing4WeekOrders),
          trailing4WeekVariancePercentage: avgExpectedTrailing4WeekOrders > 0 ?
            Math.round(((avgTrailing4WeekOrders - avgExpectedTrailing4WeekOrders) / avgExpectedTrailing4WeekOrders * 100) * 10) / 10 : 0,
          currentWeek,
          merchantCount: uniqueMerchants.size,
          forecastMerchantCount: forecasts.length,
          merchantsExcludedFromForecast: uniqueMerchants.size - forecasts.length,
          totalForecast12MonthOrders: totalForecast12MonthOrders,
          totalOpportunityAnnualVolume: totalOpportunityAnnualVolume,
          forecast12MonthVarianceOrders: Math.round(forecast12MonthVarianceOrders),
          forecast12MonthVariancePercentage: Math.round(forecast12MonthVariancePercentage * 10) / 10
        },
        weeklyTrends,
        forecasts,
        seasonalityData: []
      }
    });

  } catch (error) {
    console.error('Volume analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch volume analysis'
    });
  } finally {
    db.close();
  }
});

// Original volume endpoint (commented out due to TypeScript issues)
// router.get('/volume-full', async (req, res) => {
//   const db = new Database(dbPath);

//   try {
//     const daysLiveFilter = req.query.daysLive as string || 'all';

//     // Get weekly trends for each merchant
//     const weeklyTrendsQuery = `
//       SELECT
//         p.salesforce_account_id,
//         p.merchant_name,
//         p.iso_week,
//         p.ecomm_orders as actual_weekly_orders,
//         o.benchmark_vertical,
//         o.weekly_orders as expected_weekly_orders,
//         JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) as days_live,
//         (p.ecomm_orders - o.weekly_orders) as variance_orders,
//         CASE WHEN o.weekly_orders > 0 THEN
//           ((CAST(p.ecomm_orders AS REAL) - o.weekly_orders) / o.weekly_orders * 100)
//         ELSE 0 END as variance_percentage
//       FROM performance_actuals p
//       JOIN opportunities o ON p.salesforce_account_id = o.account_casesafe_id
//       ${daysLiveFilter !== 'all' ? `WHERE (JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date)) >= ${parseInt(daysLiveFilter)}` : ''}
//       ORDER BY p.merchant_name, p.iso_week
//     `;

//     const weeklyTrends = await new Promise<any[]>((resolve, reject) => {
//       db.all(weeklyTrendsQuery, (err, rows: any[]) => {
//         if (err) {
//           reject(err);
//           return;
//         }
//         resolve(rows);
//       });
//     });

//     // Calculate 12-month forecast using trailing 4-week performance and seasonality
//     const forecastQuery = `
//       SELECT
//         p.salesforce_account_id,
//         p.merchant_name,
//         o.benchmark_vertical,
//         AVG(p.ecomm_orders) as trailing_4week_avg_orders,
//         o.weekly_orders as expected_weekly_orders,
//         JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) as days_live
//       FROM performance_actuals p
//       JOIN opportunities o ON p.salesforce_account_id = o.account_casesafe_id
//       WHERE p.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
//         AND p.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
//         ${daysLiveFilter !== 'all' ? `AND (JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date)) >= ${parseInt(daysLiveFilter)}` : ''}
//       GROUP BY p.salesforce_account_id, p.merchant_name, o.benchmark_vertical, o.weekly_orders
//       HAVING COUNT(p.iso_week) >= 4
//     `;

//     const forecastBase = await new Promise<any[]>((resolve, reject) => {
//       db.all(forecastQuery, (err, rows: any[]) => {
//         if (err) {
//           reject(err);
//           return;
//         }
//         resolve(rows);
//       });
//     });

//     // Get seasonality curves for forecast calculation
//     const seasonalityQuery = `
//       SELECT vertical, iso_week, order_percentage
//       FROM seasonality_curves
//       ORDER BY vertical, iso_week
//     `;

//     const seasonalityData = await new Promise<any[]>((resolve, reject) => {
//       db.all(seasonalityQuery, (err, rows: any[]) => {
//         if (err) {
//           reject(err);
//           return;
//         }
//         resolve(rows);
//       });
//     });

//     // Calculate volume summary metrics
//     const currentWeek = Math.max(...weeklyTrends.map(t => t.iso_week));
//     const currentWeekData = weeklyTrends.filter(t => t.iso_week === currentWeek);

//     const totalCurrentOrders = currentWeekData.reduce((sum, m) => sum + (m.actual_weekly_orders || 0), 0);
//     const totalExpectedOrders = currentWeekData.reduce((sum, m) => sum + (m.expected_weekly_orders || 0), 0);
//     const totalVarianceOrders = totalCurrentOrders - totalExpectedOrders;
//     const volumeVariancePercentage = totalExpectedOrders > 0 ?
//       (totalVarianceOrders / totalExpectedOrders * 100) : 0;

//     // Calculate trailing 4-week averages
//     const recent4Weeks = [currentWeek, currentWeek-1, currentWeek-2, currentWeek-3];
//     const trailing4WeekData = weeklyTrends.filter(t => recent4Weeks.includes(t.iso_week));
//     const avgTrailing4WeekOrders = trailing4WeekData.length > 0 ?
//       trailing4WeekData.reduce((sum, m) => sum + (m.actual_weekly_orders || 0), 0) / 4 : 0;

//     // Calculate 12-month forecasts
//     const forecasts = forecastBase.map(merchant => {
//       const seasonalityCurve = seasonalityData.filter(s => s.vertical === merchant.benchmark_vertical);

//       if (seasonalityCurve.length === 0) {
//         return {
//           ...merchant,
//           forecast_12month_orders: null,
//           forecast_monthly_breakdown: null
//         };
//       }

//       // Calculate baseline weekly run rate from trailing 4-week performance
//       const baselineWeeklyOrders = merchant.trailing_4week_avg_orders;

//       // Calculate 12-month forecast by applying seasonality curves
//       let totalForecastOrders = 0;
//       const monthlyBreakdown = [];

//       for (let month = 1; month <= 12; month++) {
//         const weeksInMonth = 4.33; // Average weeks per month
//         let monthlyOrders = 0;

//         // Get average seasonality multiplier for this month's weeks
//         const monthStartWeek = Math.round((month - 1) * 4.33) + 1;
//         const monthEndWeek = Math.min(Math.round(month * 4.33), 52);

//         let seasonalitySum = 0;
//         let weekCount = 0;

//         for (let week = monthStartWeek; week <= monthEndWeek; week++) {
//           const seasonalityEntry = seasonalityCurve.find(s => s.iso_week === week);
//           if (seasonalityEntry) {
//             seasonalitySum += seasonalityEntry.order_percentage / 100;
//             weekCount++;
//           }
//         }

//         const avgSeasonalityMultiplier = weekCount > 0 ? seasonalitySum / weekCount : 1;
//         monthlyOrders = baselineWeeklyOrders * weeksInMonth * avgSeasonalityMultiplier;

//         monthlyBreakdown.push({
//           month,
//           forecasted_orders: Math.round(monthlyOrders),
//           seasonality_multiplier: avgSeasonalityMultiplier
//         });

//         totalForecastOrders += monthlyOrders;
//       }

//       return {
//         ...merchant,
//         forecast_12month_orders: Math.round(totalForecastOrders),
//         forecast_monthly_breakdown: monthlyBreakdown
//       };
//     });

//     res.json({
//       success: true,
//       data: {
//         summary: {
//           currentWeekOrders: totalCurrentOrders,
//           expectedWeekOrders: totalExpectedOrders,
//           volumeVarianceOrders: totalVarianceOrders,
//           volumeVariancePercentage,
//           avgTrailing4WeekOrders,
//           currentWeek,
//           merchantCount: currentWeekData.length,
//           totalForecast12MonthOrders: forecasts.reduce((sum, f) => sum + (f.forecast_12month_orders || 0), 0)
//         },
//         weeklyTrends,
//         forecasts,
//         seasonalityData
//       }
//     });

//   } catch (error) {
//     console.error('Volume analysis error:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch volume analysis'
//     });
//   } finally {
//     db.close();
//   }
// });

// Net Revenue Analysis endpoint
// Temporary simple net-revenue endpoint with mock data
router.get('/net-revenue', async (req, res) => {
  try {
    const mockData = [
      {
        accountId: 'MOCK001',
        accountName: 'Example Merchant 1',
        pricingModel: 'Rev Share',
        expectedAnnualRevenue: 50000,
        actualAnnualRevenue: 45000,
        revenueVariance: -5000,
        revenueVariancePercent: -10.0,
        adoptionRateExpected: 50.0,
        adoptionRateActual: 45.0,
        adoptionVariance: -10.0,
        volumeExpected: 100000,
        volumeActual: 90000,
        volumeVariance: -10.0,
        implementationStatus: 'Live',
        daysLive: 120
      },
      {
        accountId: 'MOCK002',
        accountName: 'Example Merchant 2',
        pricingModel: 'Flat',
        expectedAnnualRevenue: 24000,
        actualAnnualRevenue: 26400,
        revenueVariance: 2400,
        revenueVariancePercent: 10.0,
        adoptionRateExpected: 50.0,
        adoptionRateActual: 55.0,
        adoptionVariance: 10.0,
        volumeExpected: 80000,
        volumeActual: 88000,
        volumeVariance: 10.0,
        implementationStatus: 'Live',
        daysLive: 90
      }
    ];

    res.json({
      success: true,
      data: mockData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch net revenue analysis'
    });
  }
});

// Original complex endpoint (commented out due to TypeScript issues)
/*
router.get('/net-revenue-original', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const daysLiveFilter = req.query.daysLive as string || 'all';

    // Get merchant revenue data with actual performance
    let revenueQuery = `
      SELECT
        p.salesforce_account_id,
        o.opportunity_id,
        p.merchant_name,
        p.iso_week,
        p.ecomm_orders as actual_weekly_orders,
        p.accepted_offers,
        o.benchmark_vertical,
        o.annual_order_volume,
        o.labels_paid_by,
        o.pricing_model,
        o.est_offset_net_revenue,
        o.initial_offset_fee,
        o.refund_handling_fee,
        o.domestic_return_rate,
        o.loop_share_percent,
        o.blended_avg_cost_per_return,
        o.adoption_rate as expected_adoption_rate,
        CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END as actual_adoption_rate,
        JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date) as days_live
      FROM performance_actuals p
      JOIN opportunities o ON p.salesforce_account_id = o.account_casesafe_id
      WHERE o.pricing_model != 'Flat'
    `;

    const params: any[] = [];
    if (daysLiveFilter !== 'all') {
      const threshold = parseInt(daysLiveFilter);
      revenueQuery += ` AND (JULIANDAY((SELECT MAX(order_week) FROM performance_actuals)) - JULIANDAY(p.first_offer_date)) >= ?`;
      params.push(threshold);
    }

    revenueQuery += ` ORDER BY p.merchant_name, p.iso_week`;

    const revenueData = await new Promise<any[]>((resolve, reject) => {
      db.all(revenueQuery, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        // Calculate revenue metrics for each row
        const enrichedRows = rows.map(row => {
          // Use Salesforce expected revenue as baseline (est_offset_net_revenue)
          const expectedAnnualRevenue = row.est_offset_net_revenue || 0;

          // Calculate actual revenue based on actual adoption rate performance
          const actualAnnualRevenue = calculateActualRevenue(row);

          // Weekly revenues (1/52 of annual)
          const expectedWeeklyRevenue = expectedAnnualRevenue / 52;
          const actualWeeklyRevenue = actualAnnualRevenue / 52;

          // Calculate theoretical revenue using our formula for comparison
          const theoreticalRevenue = calculateExpectedRevenue(row);

          return {
            ...row,
            expected_annual_revenue: expectedAnnualRevenue,
            theoretical_annual_revenue: theoreticalRevenue,
            actual_annual_revenue: actualAnnualRevenue,
            expected_weekly_revenue: expectedWeeklyRevenue,
            actual_weekly_revenue: actualWeeklyRevenue,
            revenue_variance_annual: actualAnnualRevenue - expectedAnnualRevenue,
            revenue_variance_percentage: expectedAnnualRevenue > 0 ?
              ((actualAnnualRevenue - expectedAnnualRevenue) / expectedAnnualRevenue * 100) : 0
          };
        });

        resolve(enrichedRows);
      });
    });

    // Calculate current week summary
    const currentWeek = revenueData.length > 0 ? Math.max(...revenueData.map(r => r.iso_week)) : 38;
    const currentWeekData = revenueData.filter(r => r.iso_week === currentWeek);

    const totalExpectedRevenue = currentWeekData.reduce((sum, r) => sum + (r.expected_annual_revenue || 0), 0);
    const totalActualRevenue = currentWeekData.reduce((sum, r) => sum + (r.actual_annual_revenue || 0), 0);
    const totalRevenueVariance = totalActualRevenue - totalExpectedRevenue;
    const revenueVariancePercentage = totalExpectedRevenue > 0 ?
      (totalRevenueVariance / totalExpectedRevenue * 100) : 0;

    // Calculate trailing 4-week averages by merchant
    const recent4Weeks = [currentWeek, currentWeek-1, currentWeek-2, currentWeek-3];
    const uniqueMerchants = new Set(revenueData.map(r => r.salesforce_account_id));
    const revenueForecasts: any[] = [];

    for (const merchantId of uniqueMerchants) {
      const merchantData = revenueData.filter(r => r.salesforce_account_id === merchantId && recent4Weeks.includes(r.iso_week));
      if (merchantData.length >= 4) {
        const merchant = merchantData[0];
        const avgActualAnnualRevenue = merchantData.reduce((sum, r) => sum + r.actual_annual_revenue, 0) / merchantData.length;
        const avgExpectedAnnualRevenue = merchantData.reduce((sum, r) => sum + r.expected_annual_revenue, 0) / merchantData.length;

        revenueForecasts.push({
          salesforce_account_id: merchantId,
          opportunity_id: merchant.opportunity_id,
          merchant_name: merchant.merchant_name,
          benchmark_vertical: merchant.benchmark_vertical,
          labels_paid_by: merchant.labels_paid_by,
          pricing_model: merchant.pricing_model,
          days_live: merchant.days_live,
          expected_annual_revenue: merchant.expected_annual_revenue,
          trailing_4week_avg_revenue: avgActualAnnualRevenue,
          forecast_annual_revenue: avgActualAnnualRevenue,
          revenue_variance: avgActualAnnualRevenue - avgExpectedAnnualRevenue,
          revenue_variance_percentage: avgExpectedAnnualRevenue > 0 ?
            ((avgActualAnnualRevenue - avgExpectedAnnualRevenue) / avgExpectedAnnualRevenue * 100) : 0
        });
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalExpectedRevenue: Math.round(totalExpectedRevenue),
          totalActualRevenue: Math.round(totalActualRevenue),
          totalRevenueVariance: Math.round(totalRevenueVariance),
          revenueVariancePercentage: Math.round(revenueVariancePercentage * 10) / 10
        },
        revenueData,
        forecasts: revenueForecasts
      }
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

// Helper functions for revenue calculations using correct formulas
function calculateExpectedRevenue(merchant: any): number {
  const {
    pricing_model,
    est_offset_net_revenue,
    annual_order_volume,
    expected_adoption_rate,
    initial_offset_fee,
    refund_handling_fee,
    domestic_return_rate,
    loop_share_percent,
    blended_avg_cost_per_return,
    labels_paid_by
  } = merchant;

  if (pricing_model === 'Flat') {
    // Monthly subscription fee * 12 months
    return (est_offset_net_revenue || 0);
  }

  if (pricing_model === 'Rev Share') {
    const adoptionRatePercent = (expected_adoption_rate || 50) / 100;
    const returnRatePercent = (domestic_return_rate || 0) / 100;
    const loopSharePercent = (loop_share_percent || 0) / 100;

    // Revenue from fees = (volume * adoption * offset fee) + (volume * (1-adoption) * return rate * refund fee)
    const revenueFromFees = (
      (annual_order_volume * adoptionRatePercent * (initial_offset_fee || 0)) +
      (annual_order_volume * (1 - adoptionRatePercent) * returnRatePercent * (refund_handling_fee || 0))
    ) * loopSharePercent;

    if (labels_paid_by === 'Loop') {
      // Subtract label costs: volume * return rate * avg label cost
      const labelCosts = annual_order_volume * returnRatePercent * (blended_avg_cost_per_return || 0);
      return revenueFromFees - labelCosts;
    }

    // Merchant pays labels - no label cost deduction
    return revenueFromFees;
  }

  return est_offset_net_revenue || 0;
}

function calculateActualRevenue(merchant: any): number {
  const {
    pricing_model,
    est_offset_net_revenue,
    annual_order_volume,
    actual_adoption_rate,
    initial_offset_fee,
    refund_handling_fee,
    domestic_return_rate,
    loop_share_percent,
    blended_avg_cost_per_return,
    labels_paid_by
  } = merchant;

  if (pricing_model === 'Flat') {
    // Flat pricing doesn't vary with adoption rate performance
    return (est_offset_net_revenue || 0);
  }

  if (pricing_model === 'Rev Share') {
    const adoptionRatePercent = actual_adoption_rate || 0;
    const returnRatePercent = (domestic_return_rate || 0) / 100;
    const loopSharePercent = (loop_share_percent || 0) / 100;

    // Revenue from fees using ACTUAL adoption rate
    const revenueFromFees = (
      (annual_order_volume * adoptionRatePercent * (initial_offset_fee || 0)) +
      (annual_order_volume * (1 - adoptionRatePercent) * returnRatePercent * (refund_handling_fee || 0))
    ) * loopSharePercent;

    if (labels_paid_by === 'Loop') {
      // Subtract label costs: volume * return rate * avg label cost
      const labelCosts = annual_order_volume * returnRatePercent * (blended_avg_cost_per_return || 0);
      return revenueFromFees - labelCosts;
    }

    // Merchant pays labels - no label cost deduction
    return revenueFromFees;
  }

  return est_offset_net_revenue || 0;
}

*/

// Test endpoint to validate revenue calculations (commented out due to dependencies)
/*
// router.get('/test-revenue-calc', async (req, res) => {
//   const db = new Database(dbPath);

//   try {
//     const testQuery = `
//       SELECT
//         account_name,
//         pricing_model,
//         labels_paid_by,
//         annual_order_volume,
//         adoption_rate,
//         initial_offset_fee,
//         refund_handling_fee,
//         domestic_return_rate,
//         loop_share_percent,
//         blended_avg_cost_per_return,
//         est_offset_net_revenue
//       FROM opportunities
//       WHERE pricing_model = 'Rev Share'
//       AND est_offset_net_revenue IS NOT NULL
//       AND annual_order_volume > 0
//       LIMIT 5
//     `;

//     const testData = await new Promise<any[]>((resolve, reject) => {
//       db.all(testQuery, (err, rows: any[]) => {
//         if (err) {
//           reject(err);
//           return;
//         }

//         const calculations = rows.map(row => {
//           const calculatedRevenue = calculateExpectedRevenue(row);
//           const difference = calculatedRevenue - (row.est_offset_net_revenue || 0);
//           const percentDifference = row.est_offset_net_revenue > 0 ?
//             (difference / row.est_offset_net_revenue * 100) : 0;

//           return {
//             account_name: row.account_name,
//             pricing_model: row.pricing_model,
//             labels_paid_by: row.labels_paid_by,
//             annual_volume: row.annual_order_volume,
//             adoption_rate: row.adoption_rate,
//             offset_fee: row.initial_offset_fee,
//             refund_fee: row.refund_handling_fee,
//             return_rate: row.domestic_return_rate,
//             loop_share: row.loop_share_percent,
//             label_cost: row.blended_avg_cost_per_return,
//             database_revenue: row.est_offset_net_revenue,
//             calculated_revenue: Math.round(calculatedRevenue * 100) / 100,
//             difference: Math.round(difference * 100) / 100,
//             percent_difference: Math.round(percentDifference * 10) / 10
//           };
//         });

//         resolve(calculations);
//       });
//     });

//     res.json({
//       success: true,
//       data: testData
//     });

//   } catch (error) {
//     console.error('Revenue calculation test error:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to test revenue calculations'
//     });
//   } finally {
//     db.close();
//   }
// });

// Core revenue calculation functions for net revenue analysis
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

// Net Revenue Analysis endpoint (moved to net-revenue.ts)
/*router.get('/net-revenue', async (req, res) => {
  const db = new Database(dbPath);

  try {
    const daysLiveFilter = req.query.daysLive as string || 'all';

    // Get opportunities with their expected revenue
    const opportunitiesQuery = `
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
        o.implementation_status as implementationStatus
      FROM opportunities o
      WHERE o.checkout_enabled = 'Yes'
        AND o.annual_order_volume > 0
    `;

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
    const netRevenueData: any[] = [];

    for (const opportunity of opportunities) {
      // Get trailing 4-week performance
      const performanceQuery = `
        SELECT
          AVG(p.ecomm_orders) as avg_weekly_orders,
          AVG(CASE WHEN p.ecomm_orders > 0 THEN CAST(p.accepted_offers AS REAL) / p.ecomm_orders ELSE 0 END) as avg_adoption_rate,
          MAX(p.days_live) as days_live
        FROM performance_actuals p
        WHERE p.salesforce_account_id = ?
          AND p.iso_week <= (SELECT MAX(iso_week) FROM performance_actuals)
          AND p.iso_week > (SELECT MAX(iso_week) FROM performance_actuals) - 4
          AND p.ecomm_orders > 0
      `;

      const performance = await new Promise<any>((resolve, reject) => {
        db.get(performanceQuery, [opportunity.accountId], (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row || {});
        });
      });

      // Skip if no performance data or doesn't meet days live filter
      const daysLive = performance.days_live || 0;
      if (daysLiveFilter !== 'all') {
        const threshold = parseInt(daysLiveFilter);
        if (daysLive < threshold) continue;
      }

      if (!performance.avg_weekly_orders || performance.avg_weekly_orders <= 0) continue;

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
});*/

// Helper function to calculate performance tier based on variance percentage

function calculatePerformanceTier(varianceBps: number): string {
  if (varianceBps > 500) return 'exceeding';          // >500bps above expected
  if (varianceBps >= -500) return 'meeting';          // Within ±500bps of expected
  if (varianceBps >= -1000) return 'slightly_below';  // 500-1000bps below expected
  return 'significantly_below';                       // >1000bps below expected
}

export default router;