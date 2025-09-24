# Checkout+ Business Performance Dashboard - PRD

## Executive Summary

The Checkout+ Business Performance Dashboard is a React-based web application designed to provide comprehensive insights into the performance of Checkout+ monetization deals for Shopify merchants. The system ingests three CSV data sources to compare expected deal projections against actual performance metrics, enabling data-driven decision making and proactive deal management.

## Project Background

Checkout+ is a monetization approach for returns and exchanges software where consumer-paid fees are collected by merchants and either passed through to the software company for return shipping labels or shared as revenue while merchants handle shipping costs. The dashboard addresses the critical need to monitor key performance indicators (KPIs) such as order volumes, adoption rates, return rates, and revenue generation against initial deal projections.

## Goals & Objectives

### Primary Goals
- **Performance Monitoring**: Track actual vs. expected performance across all active Checkout+ deals
- **Variance Analysis**: Identify and quantify drivers of performance deviations
- **Proactive Management**: Enable early detection of performance issues through alerting
- **Forecasting**: Provide 12-month volume projections based on actual performance trends

### Success Metrics
- Weekly variance analysis for all active merchants (60+ currently)
- Real-time identification of merchants with significant adoption rate drops (>20% deviation)
- Accurate seasonality-adjusted forecasting within 10% of actual volumes
- 90%+ user satisfaction with dashboard usability and insights

## Data Sources & Requirements

### 1. Salesforce Opportunities Export (CSV)
**Source**: Salesforce CRM
**Update Frequency**: Daily/On-demand
**Purpose**: Expected deal projections and merchant details

**Key Fields**:
- `Opportunity: Account Casesafe ID` (Primary Key)
- `Opportunity: Account Name` (Merchant Name)
- `Opportunity: Opportunity ID`
- `Opportunity: Benchmark Vertical` (Apparel, Swimwear, Footwear, etc.)
- `Opportunity: Close Date`
- `Opportunity: Ordway Contract Effective Date`
- `Opportunity: Checkout+ Pricing Model` (Flat, Rev Share, Per Order)
- `Opportunity: Labels Paid By` (Merchant, Loop)
- `Opportunity: Checkout+ Loop Share` (Revenue share percentage)
- `Opportunity: Est Offset Net Revenue to Loop` (Annual expected revenue)
- `Opportunity: Initial Offset Fee $`
- `Opportunity: Initial Refund Handling Fee`
- `Opportunity: Last 12 month Order Volume` (Expected annual volume)
- `Opportunity: Blended avg cost per return`
- `Opportunity: Domestic Return Rate %`
- `Opportunity: Adoption Rate` (Deal-specific adoption rate)
- `Implementation Status`

**Calculated Fields**:
- Expected Eligibility Rate: 70.7% (standard across all deals)
- Expected Attach Rate: 70.7% (standard across all deals)
- Standard Expected Adoption Rate: 50% (70.7% × 70.7%)

### 2. Performance Actuals Export (CSV)
**Source**: Internal Data Warehouse
**Update Frequency**: Daily/On-demand
**Purpose**: Weekly actual performance by merchant

**Key Fields**:
- `ORDER_WEEK` (Week ending date)
- `ISO_WEEK` (ISO week number)
- `SHOP_ID` (Internal shop identifier)
- `SALESFORCE_ACCOUNT_ID` (Links to opportunities)
- `MERCHANT_NAME`
- `FIRST_OFFER_DATE` (When CO+ was first offered)
- `ORDER_COUNT` (Total orders in week)
- `ECOMM_ORDERS` (E-commerce orders)
- `HAS_RETURN_COVERAGE_FLAG` (Orders eligible for CO+)
- `OFFER_SHOWN` (Orders where CO+ was presented)
- `OFFER_NOT_SHOWN` (Orders where CO+ was not shown)
- `OFFER_COUNT` (Total CO+ offers made)
- `ACCEPTED_OFFERS` (CO+ opt-ins)
- `ADOPTION_RATE_MEDIAN_BYDAY` (Daily median adoption rate)
- `ELIGIBILITY_RATE_AVG` (% of orders eligible for CO+)
- `ATTACH_RATE_AVG` (% of eligible orders shown CO+)
- `ADOPTION_RATE_AVG` (% of shown offers that were accepted)

**Missing Fields (Future Enhancement)**:
- Actual return rates (CO+ vs non-CO+)
- Actual label costs
- Actual revenue/fees collected

### 3. Order Seasonality Curves (CSV)
**Source**: Historical analysis
**Update Frequency**: Annual
**Purpose**: Expected order distribution by week and vertical

**Key Fields**:
- `Vertical` (Swimwear, Total ex. Swimwear, plus individual verticals)
- Columns `1` through `52` (ISO weeks with percentage values)

**Usage**:
- If merchant `Opportunity: Benchmark Vertical` = "Swimwear", use Swimwear curve
- Otherwise, use "Total ex. Swimwear" curve
- Weekly expected volume = Annual volume × seasonality percentage for that ISO week

## User Stories & Requirements

### Core User Stories

**US1: CSV Data Upload**
- As a business analyst, I want to upload CSV files through a drag-and-drop interface so that I can refresh dashboard data with latest performance metrics
- Acceptance Criteria:
  - Support for all three CSV formats
  - Visual upload progress and success/error feedback
  - Data validation and error reporting
  - Backup of previous data before refresh

**US2: Performance Overview Dashboard**
- As a business manager, I want to see a summary view of actual vs. expected performance across all merchants so that I can quickly assess overall Checkout+ health
- Acceptance Criteria:
  - Week-over-week performance metrics
  - Color-coded variance indicators (green/yellow/red)
  - Summary statistics (total merchants, average adoption rate, etc.)
  - Filtering by days live (>30, >60, >90, all)

**US3: Revenue Bridge Analysis**
- As a business analyst, I want to understand the drivers of revenue variance so that I can identify which factors (volume, adoption, costs) are impacting performance most
- Acceptance Criteria:
  - Waterfall chart showing variance breakdown
  - Quantified impact of each variance driver
  - Week-over-week trend analysis
  - Drill-down capability to merchant level

**US4: Merchant Performance Stratification**
- As a business manager, I want to see how merchants are distributed across performance tiers so that I can prioritize account management efforts
- Acceptance Criteria:
  - Performance buckets (exceeding expectations, 0-10% below, 10-30% below, etc.)
  - Count and percentage of merchants in each bucket
  - Visual distribution charts
  - Ability to click through to merchant lists

**US5: Individual Merchant Analysis**
- As an account manager, I want to drill down into specific merchant performance so that I can understand individual deal health and take corrective action
- Acceptance Criteria:
  - Complete merchant performance history
  - Expected vs. actual trend lines
  - Key metric variance analysis
  - Seasonality-adjusted projections
  - Alert flags for significant deviations

**US6: Top Variance Contributors**
- As a business manager, I want to identify the top 5-10 merchants contributing to overall variance so that I can focus attention on highest-impact accounts
- Acceptance Criteria:
  - Ranked list of positive and negative contributors
  - Percentage contribution to total variance
  - Quick access to detailed merchant analysis
  - Week-over-week change tracking

**US7: Flexible Merchant Exclusions**
- As a business analyst, I want to exclude specific merchants from specific weeks so that I can analyze "clean" performance without merchants who changed pricing models
- Acceptance Criteria:
  - Week-by-merchant exclusion controls
  - Visual indicators of excluded data points
  - Ability to restore excluded merchants
  - Historical exclusion tracking

**US8: Performance Alerting**
- As a business manager, I want to receive alerts when merchant performance deviates significantly so that I can take proactive action
- Acceptance Criteria:
  - Configurable threshold settings
  - Visual alert indicators on dashboard
  - Alert history and acknowledgment
  - Multiple alert types (adoption rate, volume, costs)

**US9: Forecasting & Projections**
- As a business analyst, I want to see 12-month volume projections based on actual performance so that I can update revenue forecasts
- Acceptance Criteria:
  - Seasonality-adjusted projections
  - Confidence intervals
  - Comparison to original deal projections
  - Ability to adjust forecast assumptions

## Technical Architecture

### Frontend (React)
- **Framework**: React 18+ with TypeScript
- **State Management**: Context API or Redux Toolkit
- **UI Components**: Material-UI or Chakra UI
- **Charts**: Chart.js or D3.js for visualizations
- **Data Tables**: React Table or similar
- **File Upload**: React Dropzone

### Backend (Node.js)
- **Framework**: Express.js
- **Database**: SQLite for local deployment
- **CSV Processing**: Papa Parse or similar
- **API Design**: RESTful endpoints
- **Validation**: Joi or Yup for data validation

### Data Models

```sql
-- Opportunities (from Salesforce CSV)
CREATE TABLE opportunities (
  id INTEGER PRIMARY KEY,
  account_casesafe_id TEXT UNIQUE, -- Opportunity: Account Casesafe ID
  account_name TEXT, -- Opportunity: Account Name
  opportunity_id TEXT, -- Opportunity: Opportunity ID
  benchmark_vertical TEXT, -- Opportunity: Benchmark Vertical
  close_date DATE, -- Opportunity: Close Date
  contract_effective_date DATE, -- Opportunity: Ordway Contract Effective Date
  checkout_enabled TEXT, -- Opportunity: Checkout+ Enabled
  pricing_model TEXT, -- Opportunity: Checkout+ Pricing Model (Flat, Rev Share, Per Order)
  labels_paid_by TEXT, -- Opportunity: Labels Paid By (Merchant, Loop)
  loop_share_percent REAL, -- Opportunity: Checkout+ Loop Share
  est_offset_net_revenue REAL, -- Opportunity: Est Offset Net Revenue to Loop
  initial_offset_fee REAL, -- Opportunity: Initial Offset Fee $
  refund_handling_fee REAL, -- Opportunity: Initial Refund Handling Fee
  annual_order_volume INTEGER, -- Opportunity: Last 12 month Order Volume
  blended_avg_cost_per_return REAL, -- Opportunity: Blended avg cost per return
  domestic_return_rate REAL, -- Opportunity: Domestic Return Rate %
  adoption_rate REAL, -- Opportunity: Adoption Rate
  implementation_status TEXT, -- Implementation Status
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance Actuals (from Data Warehouse CSV)
CREATE TABLE performance_actuals (
  id INTEGER PRIMARY KEY,
  order_week DATE, -- ORDER_WEEK
  iso_week INTEGER, -- ISO_WEEK
  shop_id INTEGER, -- SHOP_ID
  salesforce_account_id TEXT, -- SALESFORCE_ACCOUNT_ID
  merchant_name TEXT, -- MERCHANT_NAME
  first_offer_date DATE, -- FIRST_OFFER_DATE
  order_count INTEGER, -- ORDER_COUNT
  ecomm_orders INTEGER, -- ECOMM_ORDERS
  has_return_coverage_flag INTEGER, -- HAS_RETURN_COVERAGE_FLAG
  offer_shown INTEGER, -- OFFER_SHOWN
  offer_not_shown INTEGER, -- OFFER_NOT_SHOWN
  offer_count INTEGER, -- OFFER_COUNT
  accepted_offers INTEGER, -- ACCEPTED_OFFERS
  adoption_rate_median_byday REAL, -- ADOPTION_RATE_MEDIAN_BYDAY
  eligibility_rate_avg REAL, -- ELIGIBILITY_RATE_AVG
  attach_rate_avg REAL, -- ATTACH_RATE_AVG
  adoption_rate_avg REAL, -- ADOPTION_RATE_AVG
  days_live INTEGER, -- Calculated field
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salesforce_account_id) REFERENCES opportunities(account_casesafe_id)
);

-- Seasonality Curves (from Order Seasonality CSV)
CREATE TABLE seasonality_curves (
  id INTEGER PRIMARY KEY,
  vertical TEXT, -- Vertical column
  iso_week INTEGER, -- Week number (1-52)
  order_percentage REAL, -- Percentage value for that week
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Merchant Exclusions (User-defined)
CREATE TABLE merchant_exclusions (
  id INTEGER PRIMARY KEY,
  salesforce_account_id TEXT,
  iso_week INTEGER,
  year INTEGER,
  reason TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salesforce_account_id) REFERENCES opportunities(account_casesafe_id)
);

-- Performance Alerts (System-generated)
CREATE TABLE performance_alerts (
  id INTEGER PRIMARY KEY,
  salesforce_account_id TEXT,
  alert_type TEXT, -- 'adoption_rate', 'volume', 'legacy_deal', 'stale_data'
  threshold_value REAL,
  actual_value REAL,
  variance_percentage REAL,
  iso_week INTEGER,
  year INTEGER,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salesforce_account_id) REFERENCES opportunities(account_casesafe_id)
);

-- Future Enhancement: Revenue & Cost Actuals
CREATE TABLE revenue_cost_actuals (
  id INTEGER PRIMARY KEY,
  salesforce_account_id TEXT,
  iso_week INTEGER,
  year INTEGER,
  actual_revenue_generated REAL,
  actual_label_costs REAL,
  actual_return_rate_coplus REAL,
  actual_return_rate_non_coplus REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salesforce_account_id) REFERENCES opportunities(account_casesafe_id)
);
```

### API Endpoints

```
POST /api/upload/opportunities - Upload Salesforce opportunities CSV
POST /api/upload/performance - Upload performance actuals CSV
POST /api/upload/seasonality - Upload seasonality curves CSV

GET /api/dashboard/overview - Get dashboard overview metrics
GET /api/dashboard/revenue-bridge - Get revenue variance analysis
GET /api/dashboard/stratification - Get merchant performance distribution
GET /api/dashboard/top-contributors - Get top variance contributors

GET /api/merchants - Get all merchants with filters
GET /api/merchants/:id - Get specific merchant details
GET /api/merchants/:id/performance - Get merchant performance history

POST /api/exclusions - Create merchant exclusion
DELETE /api/exclusions/:id - Remove merchant exclusion
GET /api/exclusions - Get all exclusions

GET /api/alerts - Get all alerts
PUT /api/alerts/:id/acknowledge - Acknowledge alert

GET /api/forecasts - Get 12-month volume projections
```

## Key Business Logic & Calculations

### Weekly Expected Volume Calculation
```javascript
// Calculate expected weekly volume using seasonality
const getExpectedWeeklyVolume = (merchant, isoWeek) => {
  const annualVolume = merchant['Opportunity: Last 12 month Order Volume'];
  const vertical = merchant['Opportunity: Benchmark Vertical'];

  // Use Swimwear curve if vertical is Swimwear, otherwise use Total ex. Swimwear
  const seasonalityCurve = (vertical === 'Swimwear') ? 'Swimwear' : 'Total ex. Swimwear';
  const seasonalityPercent = seasonalityData[seasonalityCurve][isoWeek];

  return annualVolume * (seasonalityPercent / 100);
};
```

### Revenue Calculations by Pricing Model

#### Flat Pricing Model
```javascript
// Monthly subscription fee
const monthlyRevenue = merchant['Opportunity: Est Offset Net Revenue to Loop'] / 12;
```

#### Rev Share with Merchant Paying Labels
```javascript
const annualRevenue = (
  (annualVolume * adoptionRate * offsetFee) +
  (annualVolume * (1 - adoptionRate) * returnRate * refundHandlingFee)
) * loopSharePercent;
```

#### Rev Share with Loop Paying Labels
```javascript
const annualRevenue = (
  ((annualVolume * adoptionRate * offsetFee) +
   (annualVolume * (1 - adoptionRate) * returnRate * refundHandlingFee)) * loopSharePercent
) - (annualVolume * returnRate * avgLabelCost);
```

### Variance Calculations
```javascript
// Weekly Volume Variance
const expectedVolume = getExpectedWeeklyVolume(merchant, isoWeek);
const actualVolume = weeklyData.ORDER_COUNT;
const volumeVariance = ((actualVolume - expectedVolume) / expectedVolume) * 100;

// Adoption Rate Variance
const expectedAdoption = merchant['Opportunity: Adoption Rate'] || 50; // Default 50%
const actualAdoption = weeklyData.ADOPTION_RATE_AVG * 100;
const adoptionVariance = ((actualAdoption - expectedAdoption) / expectedAdoption) * 100;

// Days Live Calculation
const daysLive = Math.floor(
  (new Date(weeklyData.ORDER_WEEK) - new Date(weeklyData.FIRST_OFFER_DATE)) / (1000 * 60 * 60 * 24)
);
```

### 12-Month Forecasting
```javascript
// Project annual volume based on recent 4-8 week average performance
const getProjectedAnnualVolume = (merchant, recentWeeks) => {
  const avgWeeklyActual = recentWeeks.reduce((sum, week) => sum + week.ORDER_COUNT, 0) / recentWeeks.length;
  const avgWeeklyExpected = recentWeeks.reduce((sum, week) => sum + getExpectedWeeklyVolume(merchant, week.ISO_WEEK), 0) / recentWeeks.length;

  const performanceRatio = avgWeeklyActual / avgWeeklyExpected;
  const originalProjection = merchant['Opportunity: Last 12 month Order Volume'];

  return originalProjection * performanceRatio;
};
```

### Alert Thresholds
- **Adoption Rate Alert**: >20% negative deviation from expected adoption rate
- **Volume Alert**: >15% negative deviation from expected weekly volume
- **New Merchant Alert**: Performance review after 30 days live
- **Legacy Deal Alert**: Flag deals with 10% adoption rate for system update
- **Stale Data Alert**: No recent performance data for active merchants

## Dashboard Wireframes & Views

### 1. Overview Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│ Checkout+ Performance Dashboard                             │
├─────────────────────────────────────────────────────────────┤
│ Filters: [Days Live: >30 ▼] [Week: Current ▼] [Upload CSVs] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ Total Orders│ │ Avg Adoption│ │ Revenue     │ │ Active      │ │
│ │ 142K (-8%)  │ │ 34.2% (-5%) │ │ $89K (-12%) │ │ Merchants 58│ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Weekly Trend Chart (Expected vs Actual)                    │
│ [Interactive line chart showing 12-week trend]              │
├─────────────────────────────────────────────────────────────┤
│ 🔴 3 Critical Alerts | 🟡 7 Warning Alerts                  │
└─────────────────────────────────────────────────────────────┘
```

### 2. Revenue Bridge Analysis
```
┌─────────────────────────────────────────────────────────────┐
│ Revenue Variance Bridge - Week 38, 2024                    │
├─────────────────────────────────────────────────────────────┤
│ Expected Revenue: $95K → Actual Revenue: $83K (-$12K)      │
├─────────────────────────────────────────────────────────────┤
│ [Waterfall Chart]                                          │
│ Expected  Volume   Adoption  Label    Other   Actual       │
│   $95K     -$8K     -$3K     -$1K     $0K     $83K        │
│     █       ▼        ▼        ▼              █            │
├─────────────────────────────────────────────────────────────┤
│ Top Contributors to Variance:                              │
│ • Volume Shortfall: -$8K (67% of variance)                 │
│ • Adoption Rate: -$3K (25% of variance)                    │
│ • Label Cost Increase: -$1K (8% of variance)               │
└─────────────────────────────────────────────────────────────┘
```

### 3. Merchant Stratification
```
┌─────────────────────────────────────────────────────────────┐
│ Merchant Performance Distribution                           │
├─────────────────────────────────────────────────────────────┤
│ Performance Buckets (Volume vs Expected):                  │
│ 🟢 Exceeding: 12 merchants (21%)                           │
│ 🟡 Within 10%: 18 merchants (31%)                          │
│ 🟠 10-30% Below: 21 merchants (36%)                        │
│ 🔴 >30% Below: 7 merchants (12%)                           │
├─────────────────────────────────────────────────────────────┤
│ [Histogram showing distribution]                            │
├─────────────────────────────────────────────────────────────┤
│ Click on any bucket to see merchant list                   │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
- Set up React + Node.js project structure
- Implement CSV upload functionality
- Create basic data models and database setup
- Build simple dashboard skeleton

### Phase 2: Basic Analytics (Weeks 3-4)
- Implement core variance calculations
- Build overview dashboard with key metrics
- Create basic filtering and date selection
- Add simple data tables for merchant lists

### Phase 3: Advanced Visualizations (Weeks 5-6)
- Implement revenue bridge analysis
- Build merchant stratification views
- Add interactive charts and drill-down capability
- Create individual merchant detail pages

### Phase 4: Alerting & Forecasting (Weeks 7-8)
- Implement alert system and thresholds
- Build 12-month forecasting logic
- Add seasonality adjustments
- Create merchant exclusion functionality

### Phase 5: Polish & Optimization (Weeks 9-10)
- Performance optimization
- Enhanced UI/UX
- Comprehensive testing
- Documentation and deployment guides

## Risk Assessment & Mitigation

### Technical Risks
- **CSV Format Changes**: Implement flexible parsing with field mapping
- **Data Quality Issues**: Build comprehensive validation and error handling
- **Performance with Large Datasets**: Implement pagination and data virtualization

### Business Risks
- **Changing Requirements**: Use modular architecture to accommodate evolving needs
- **Data Source Reliability**: Implement robust error handling and fallback mechanisms
- **User Adoption**: Focus on intuitive UI and provide training materials

## Success Criteria & KPIs

### Technical Success
- 99% uptime for local deployment
- <3 second load times for dashboard views
- Support for 100+ merchants without performance degradation
- Successful CSV processing with 99.9% accuracy

### Business Success
- Weekly usage by all business stakeholders
- 50% reduction in time spent on manual variance analysis
- Early detection of 90% of performance issues through alerting
- Improved forecast accuracy within 5% of actual results

## Future Enhancements

### Phase 2 Considerations
- **Enhanced Data Sources**:
  - 4th CSV file with actual revenue, return rates, and label costs
  - Integration with Salesforce API for real-time deal updates
  - Automated data pipeline from internal data warehouse
- **Advanced Analytics**:
  - ML-based forecasting models using seasonal patterns and performance trends
  - Cohort analysis for merchant performance over time
  - Predictive alerts for merchants likely to underperform
- **System Improvements**:
  - Automated report generation and distribution
  - Mobile responsive design for field access
  - Multi-tenant support for different business units
  - Integration with business intelligence tools (Tableau, PowerBI)
- **Operational Features**:
  - Automated merchant health scoring
  - Integration with account management tools
  - Custom dashboard creation for different stakeholder groups

### Data Enhancement Roadmap

#### Missing Data Fields (High Priority)
- **Actual Revenue Data**: Weekly fees collected by pricing model
- **Actual Return Rates**: CO+ vs non-CO+ return behavior
- **Actual Label Costs**: Weekly shipping label expenses
- **Customer Lifetime Value**: Revenue impact per customer cohort

#### Legacy Data Cleanup
- **10% Adoption Rate Deals**: System flagging and migration to current model
- **Missing Vertical Classifications**: Automatic categorization based on merchant name/domain
- **Historical Data Backfill**: Import 12+ months of performance history for trending

#### Integration Opportunities
- **Real-time Salesforce Sync**: Opportunity updates without CSV exports
- **Automated Data Warehouse Feeds**: Eliminate manual CSV exports
- **Webhook-based Updates**: Real-time performance monitoring

---

*This PRD serves as the foundational document for the Checkout+ Business Performance Dashboard development. It will be updated as requirements evolve and implementation progresses.*