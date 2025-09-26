import * as Papa from 'papaparse';
import Joi from 'joi';
import { database } from '../utils/database';

export interface OpportunityData {
  accountId: string;
  accountName: string;
  opportunityId: string;
  benchmarkVertical: string;
  closeDate: string;
  contractEffectiveDate: string;
  checkoutEnabled: string;
  pricingModel: string;
  labelsPaidBy: string;
  loopSharePercent: number;
  estOffsetNetRevenue: number;
  initialOffsetFee: number;
  refundHandlingFee: number;
  annualOrderVolume: number;
  blendedAvgCostPerReturn: number;
  domesticReturnRate: number;
  adoptionRate: number;
  implementationStatus: string;
  netAcv: number;
  companyAcvStartingValue: number;
  companyAcvEndingValue: number;
}

export interface PerformanceData {
  orderWeek: string;
  isoWeek: number;
  shopId: number;
  salesforceAccountId: string;
  merchantName: string;
  firstOfferDate: string;
  orderCount: number;
  ecommOrders: number;
  hasReturnCoverageFlag: number;
  offerShown: number;
  offerNotShown: number;
  offerCount: number;
  acceptedOffers: number;
  adoptionRateMedianByday: number;
  eligibilityRateAvg: number;
  attachRateAvg: number;
  adoptionRateAvg: number;
}

export interface SeasonalityData {
  vertical: string;
  weeklyPercentages: { [week: number]: number };
}

export class DataProcessorAgent {

  // Validation schemas
  private opportunitySchema = Joi.object({
    'Opportunity: Account Casesafe ID': Joi.string().required(),
    'Opportunity: Account Name': Joi.string().required(),
    'Opportunity: Opportunity ID': Joi.string().required(),
    'Opportunity: Benchmark Vertical': Joi.string().allow('', null),
    'Opportunity: Close Date': Joi.string().allow('', null),
    'Opportunity: Ordway Contract Effective Date': Joi.string().allow('', null),
    'Opportunity: Checkout+ Enabled': Joi.string().allow('', null),
    'Opportunity: Checkout+ Pricing Model': Joi.string().allow('', null),
    'Opportunity: Labels Paid By': Joi.string().allow('', null),
    'Opportunity: Checkout+ Loop Share': Joi.number().allow('', null),
    'Opportunity: Est Offset Net Revenue to Loop': Joi.number().allow('', null),
    'Opportunity: Initial Offset Fee $': Joi.number().allow('', null),
    'Opportunity: Initial Refund Handling Fee': Joi.number().allow('', null),
    'Opportunity: Last 12 month Order Volume': Joi.number().allow('', null),
    'Opportunity: Initial Refund Handling Fee_1': Joi.number().allow('', null), // Duplicate column
    'Est Offset Net Revenue (Implementation)': Joi.number().allow('', null),
    'Opportunity: Initial Offset Fee $_1': Joi.number().allow('', null), // Duplicate column
    'Opportunity: Checkout_per_order_fee_to_Loop__c': Joi.string().allow('', null),
    'Opportunity: Blended avg cost per return': Joi.number().allow('', null),
    'Opportunity: Domestic Return Rate %': Joi.number().allow('', null),
    'Opportunity: Adoption Rate': Joi.number().allow('', null),
    'Implementation Status': Joi.string().allow('', null),
    'Opportunity: Net ACV': Joi.number().allow('', null),
    'Opportunity: Company ACV - Starting Value': Joi.number().allow('', null),
    'Opportunity: Company ACV - Ending Value': Joi.number().allow('', null)
  }).unknown(true); // Allow unknown fields to handle any CSV variations

  private performanceSchema = Joi.object({
    'ORDER_WEEK': Joi.string().required(),
    'ISO_WEEK': Joi.number().required(),
    'SHOP_ID': Joi.number().required(),
    'SALESFORCE_ACCOUNT_ID': Joi.string().required(),
    'MERCHANT_NAME': Joi.string().required(),
    'FIRST_OFFER_DATE': Joi.string().allow('', null),
    'ORDER_COUNT': Joi.number().required(),
    'ECOMM_ORDERS': Joi.number().required(),
    'HAS_RETURN_COVERAGE_FLAG': Joi.number().allow(null),
    'OFFER_SHOWN': Joi.number().allow(null),
    'OFFER_NOT_SHOWN': Joi.number().allow(null),
    'OFFER_COUNT': Joi.number().allow(null),
    'ACCEPTED_OFFERS': Joi.number().allow(null),
    'ADOPTION_RATE_MEDIAN_BYDAY': Joi.number().allow(null),
    'ELIGIBILITY_RATE_AVG': Joi.number().allow(null),
    'ATTACH_RATE_AVG': Joi.number().allow(null),
    'ADOPTION_RATE_AVG': Joi.number().allow(null)
  });

  async processSalesforceCSV(csvData: string): Promise<{ success: boolean; data?: OpportunityData[]; errors?: string[] }> {
    try {
      const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        return { success: false, errors: parsed.errors.map((e: any) => e.message) };
      }

      const opportunities: OpportunityData[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i] as any;

        try {
          const { error } = this.opportunitySchema.validate(row);
          if (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
            continue;
          }

          const opportunity: OpportunityData = {
            accountId: row['Opportunity: Account Casesafe ID'],
            accountName: row['Opportunity: Account Name'],
            opportunityId: row['Opportunity: Opportunity ID'],
            benchmarkVertical: row['Opportunity: Benchmark Vertical'] || '',
            closeDate: row['Opportunity: Close Date'] || '',
            contractEffectiveDate: row['Opportunity: Ordway Contract Effective Date'] || '',
            checkoutEnabled: row['Opportunity: Checkout+ Enabled'] || '',
            pricingModel: row['Opportunity: Checkout+ Pricing Model'] || '',
            labelsPaidBy: row['Opportunity: Labels Paid By'] || '',
            loopSharePercent: parseFloat(row['Opportunity: Checkout+ Loop Share']) || 0,
            estOffsetNetRevenue: parseFloat(row['Opportunity: Est Offset Net Revenue to Loop']) || 0,
            initialOffsetFee: parseFloat(row['Opportunity: Initial Offset Fee $']) || 0,
            refundHandlingFee: parseFloat(row['Opportunity: Initial Refund Handling Fee']) || 0,
            annualOrderVolume: parseInt(row['Opportunity: Last 12 month Order Volume']) || 0,
            blendedAvgCostPerReturn: parseFloat(row['Opportunity: Blended avg cost per return']) || 0,
            domesticReturnRate: parseFloat(row['Opportunity: Domestic Return Rate %']) || 0,
            adoptionRate: parseFloat(row['Opportunity: Adoption Rate']) || 50,
            implementationStatus: row['Implementation Status'] || '',
            netAcv: parseFloat(row['Opportunity: Net ACV']) || 0,
            companyAcvStartingValue: parseFloat(row['Opportunity: Company ACV - Starting Value']) || 0,
            companyAcvEndingValue: parseFloat(row['Opportunity: Company ACV - Ending Value']) || 0
          };

          opportunities.push(opportunity);

        } catch (error) {
          errors.push(`Row ${i + 1}: ${error}`);
        }
      }

      return { success: errors.length === 0, data: opportunities, errors: errors.length > 0 ? errors : undefined };

    } catch (error) {
      return { success: false, errors: [`CSV parsing error: ${error}`] };
    }
  }

  async processPerformanceCSV(csvData: string): Promise<{ success: boolean; data?: PerformanceData[]; errors?: string[] }> {
    try {
      const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        return { success: false, errors: parsed.errors.map((e: any) => e.message) };
      }

      const performanceData: PerformanceData[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i] as any;

        try {
          const { error } = this.performanceSchema.validate(row);
          if (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
            continue;
          }

          const performance: PerformanceData = {
            orderWeek: row['ORDER_WEEK'],
            isoWeek: parseInt(row['ISO_WEEK']),
            shopId: parseInt(row['SHOP_ID']),
            salesforceAccountId: row['SALESFORCE_ACCOUNT_ID'],
            merchantName: row['MERCHANT_NAME'],
            firstOfferDate: row['FIRST_OFFER_DATE'] || '',
            orderCount: parseInt(row['ORDER_COUNT']),
            ecommOrders: parseInt(row['ECOMM_ORDERS']),
            hasReturnCoverageFlag: parseInt(row['HAS_RETURN_COVERAGE_FLAG']) || 0,
            offerShown: parseInt(row['OFFER_SHOWN']) || 0,
            offerNotShown: parseInt(row['OFFER_NOT_SHOWN']) || 0,
            offerCount: parseInt(row['OFFER_COUNT']) || 0,
            acceptedOffers: parseInt(row['ACCEPTED_OFFERS']) || 0,
            adoptionRateMedianByday: parseFloat(row['ADOPTION_RATE_MEDIAN_BYDAY']) || 0,
            eligibilityRateAvg: parseFloat(row['ELIGIBILITY_RATE_AVG']) || 0,
            attachRateAvg: parseFloat(row['ATTACH_RATE_AVG']) || 0,
            adoptionRateAvg: parseFloat(row['ADOPTION_RATE_AVG']) || 0
          };

          performanceData.push(performance);

        } catch (error) {
          errors.push(`Row ${i + 1}: ${error}`);
        }
      }

      return { success: errors.length === 0, data: performanceData, errors: errors.length > 0 ? errors : undefined };

    } catch (error) {
      return { success: false, errors: [`CSV parsing error: ${error}`] };
    }
  }

  async processSeasonalityCSV(csvData: string): Promise<{ success: boolean; data?: SeasonalityData[]; errors?: string[] }> {
    try {
      const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        return { success: false, errors: parsed.errors.map((e: any) => e.message) };
      }

      const seasonalityData: SeasonalityData[] = [];
      const errors: string[] = [];

      for (const row of parsed.data as any[]) {
        try {
          const vertical = row['Vertical'];
          if (!vertical) continue;

          const weeklyPercentages: { [week: number]: number } = {};

          // Process weeks 1-52
          for (let week = 1; week <= 52; week++) {
            let percentageStr = row[week.toString()] || '0';
            // Remove % symbol if present
            if (typeof percentageStr === 'string') {
              percentageStr = percentageStr.replace('%', '');
            }
            const percentage = parseFloat(percentageStr) || 0;
            // Preserve more significant digits by rounding to 6 decimal places
            weeklyPercentages[week] = Math.round(percentage * 1000000) / 1000000;
          }

          seasonalityData.push({
            vertical,
            weeklyPercentages
          });

        } catch (error) {
          errors.push(`Error processing vertical ${row['Vertical']}: ${error}`);
        }
      }

      return { success: errors.length === 0, data: seasonalityData, errors: errors.length > 0 ? errors : undefined };

    } catch (error) {
      return { success: false, errors: [`CSV parsing error: ${error}`] };
    }
  }

  async saveOpportunities(opportunities: OpportunityData[]): Promise<void> {
    // Use a transaction to ensure both DELETE and INSERT operations complete atomically
    await database.run('BEGIN TRANSACTION');

    try {
      // Filter to keep only the most recent opportunity per account based on close date
      const latestOpportunities = new Map<string, OpportunityData>();

      for (const opp of opportunities) {
        const accountId = opp.accountId;
        const existing = latestOpportunities.get(accountId);

        if (!existing || this.parseTimezoneNeutralDate(opp.closeDate) > this.parseTimezoneNeutralDate(existing.closeDate)) {
          latestOpportunities.set(accountId, opp);
        }
      }

      const filteredOpportunities = Array.from(latestOpportunities.values());
      console.log(`Filtered ${opportunities.length} opportunities down to ${filteredOpportunities.length} (keeping most recent per account)`);

      // Clear existing opportunities data to prevent stale records
      await database.run('DELETE FROM opportunities');

      const sql = `
        INSERT OR REPLACE INTO opportunities (
          account_casesafe_id, account_name, opportunity_id, benchmark_vertical,
          close_date, contract_effective_date, checkout_enabled, pricing_model,
          labels_paid_by, loop_share_percent, est_offset_net_revenue, initial_offset_fee,
          refund_handling_fee, annual_order_volume, blended_avg_cost_per_return,
          domestic_return_rate, adoption_rate, implementation_status, net_acv,
          company_acv_starting_value, company_acv_ending_value, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      for (const opp of filteredOpportunities) {
        await database.run(sql, [
          opp.accountId, opp.accountName, opp.opportunityId, opp.benchmarkVertical,
          opp.closeDate, opp.contractEffectiveDate, opp.checkoutEnabled, opp.pricingModel,
          opp.labelsPaidBy, opp.loopSharePercent, opp.estOffsetNetRevenue, opp.initialOffsetFee,
          opp.refundHandlingFee, opp.annualOrderVolume, opp.blendedAvgCostPerReturn,
          opp.domesticReturnRate, opp.adoptionRate, opp.implementationStatus, opp.netAcv,
          opp.companyAcvStartingValue, opp.companyAcvEndingValue
        ]);
      }

      await database.run('COMMIT');
    } catch (error) {
      await database.run('ROLLBACK');
      throw error;
    }
  }

  async savePerformanceData(performanceData: PerformanceData[]): Promise<void> {
    // Clear existing performance data to prevent duplicates
    await database.run('DELETE FROM performance_actuals');

    const sql = `
      INSERT INTO performance_actuals (
        order_week, iso_week, shop_id, salesforce_account_id, merchant_name,
        first_offer_date, order_count, ecomm_orders, has_return_coverage_flag,
        offer_shown, offer_not_shown, offer_count, accepted_offers,
        adoption_rate_median_byday, eligibility_rate_avg, attach_rate_avg, adoption_rate_avg,
        days_live
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const perf of performanceData) {
      // Calculate days live
      const daysLive = this.calculateDaysLive(perf.firstOfferDate, perf.orderWeek);

      await database.run(sql, [
        perf.orderWeek, perf.isoWeek, perf.shopId, perf.salesforceAccountId, perf.merchantName,
        perf.firstOfferDate, perf.orderCount, perf.ecommOrders, perf.hasReturnCoverageFlag,
        perf.offerShown, perf.offerNotShown, perf.offerCount, perf.acceptedOffers,
        perf.adoptionRateMedianByday, perf.eligibilityRateAvg, perf.attachRateAvg, perf.adoptionRateAvg,
        daysLive
      ]);
    }
  }

  async saveSeasonalityData(seasonalityData: SeasonalityData[]): Promise<void> {
    // Clear existing seasonality data
    await database.run('DELETE FROM seasonality_curves');

    const sql = `
      INSERT INTO seasonality_curves (vertical, iso_week, order_percentage)
      VALUES (?, ?, ?)
    `;

    for (const data of seasonalityData) {
      for (const [week, percentage] of Object.entries(data.weeklyPercentages)) {
        await database.run(sql, [data.vertical, parseInt(week), percentage]);
      }
    }
  }

  private parseTimezoneNeutralDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  private calculateDaysLive(firstOfferDate: string, orderWeek: string): number {
    if (!firstOfferDate || !orderWeek) return 0;

    try {
      // Parse dates in local timezone to avoid timezone shift issues
      const startDate = this.parseTimezoneNeutralDate(firstOfferDate);
      const weekStart = this.parseTimezoneNeutralDate(orderWeek);
      // Calculate week ending date (order_week + 6 days)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const diffTime = Math.abs(weekEnd.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      return 0;
    }
  }

  // Business logic calculations
  calculateExpectedWeeklyVolume(merchant: OpportunityData, isoWeek: number, seasonalityData: { [vertical: string]: { [week: number]: number } }): number {
    const annualVolume = merchant.annualOrderVolume;
    const vertical = merchant.benchmarkVertical;

    // Use Swimwear curve if vertical is Swimwear, otherwise use Total ex. Swimwear
    const seasonalityCurve = (vertical === 'Swimwear') ? 'Swimwear' : 'Total ex. Swimwear';
    const seasonalityPercent = seasonalityData[seasonalityCurve]?.[isoWeek] || 0;

    return annualVolume * (seasonalityPercent / 100);
  }

  calculateExpectedRevenue(merchant: OpportunityData): number {
    const {
      pricingModel,
      estOffsetNetRevenue,
      annualOrderVolume,
      adoptionRate,
      initialOffsetFee,
      refundHandlingFee,
      domesticReturnRate,
      loopSharePercent,
      blendedAvgCostPerReturn,
      labelsPaidBy
    } = merchant;

    if (pricingModel === 'Flat') {
      return estOffsetNetRevenue;
    }

    if (pricingModel === 'Rev Share') {
      const adoptionRateDecimal = adoptionRate / 100;
      const returnRateDecimal = domesticReturnRate / 100;
      const loopShareDecimal = loopSharePercent / 100;

      const revenueFromFees = (
        (annualOrderVolume * adoptionRateDecimal * initialOffsetFee) +
        (annualOrderVolume * (1 - adoptionRateDecimal) * returnRateDecimal * refundHandlingFee)
      ) * loopShareDecimal;

      if (labelsPaidBy === 'Loop') {
        const labelCosts = annualOrderVolume * returnRateDecimal * blendedAvgCostPerReturn;
        return revenueFromFees - labelCosts;
      }

      return revenueFromFees;
    }

    return estOffsetNetRevenue; // Fallback
  }
}

export const dataProcessorAgent = new DataProcessorAgent();