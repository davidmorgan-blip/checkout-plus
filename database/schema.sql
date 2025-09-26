-- Checkout+ Business Performance Dashboard Database Schema

-- Opportunities (from Salesforce CSV)
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_casesafe_id TEXT NOT NULL, -- Opportunity: Account Casesafe ID
  account_name TEXT, -- Opportunity: Account Name
  opportunity_id TEXT UNIQUE NOT NULL, -- Opportunity: Opportunity ID
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
CREATE TABLE IF NOT EXISTS performance_actuals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_week DATE NOT NULL, -- ORDER_WEEK
  iso_week INTEGER, -- ISO_WEEK
  shop_id INTEGER, -- SHOP_ID
  salesforce_account_id TEXT NOT NULL, -- SALESFORCE_ACCOUNT_ID
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
CREATE TABLE IF NOT EXISTS seasonality_curves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vertical TEXT NOT NULL, -- Vertical column
  iso_week INTEGER NOT NULL, -- Week number (1-52)
  order_percentage REAL, -- Percentage value for that week
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vertical, iso_week)
);

-- Merchant Exclusions (User-defined)
CREATE TABLE IF NOT EXISTS merchant_exclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salesforce_account_id TEXT NOT NULL,
  iso_week INTEGER,
  year INTEGER,
  reason TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salesforce_account_id) REFERENCES opportunities(account_casesafe_id)
);

-- Performance Alerts (System-generated)
CREATE TABLE IF NOT EXISTS performance_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salesforce_account_id TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'adoption_rate', 'volume', 'legacy_deal', 'stale_data'
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
CREATE TABLE IF NOT EXISTS revenue_cost_actuals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salesforce_account_id TEXT NOT NULL,
  iso_week INTEGER,
  year INTEGER,
  actual_revenue_generated REAL,
  actual_label_costs REAL,
  actual_return_rate_coplus REAL,
  actual_return_rate_non_coplus REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salesforce_account_id) REFERENCES opportunities(account_casesafe_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_performance_account_week ON performance_actuals(salesforce_account_id, iso_week);
CREATE INDEX IF NOT EXISTS idx_opportunities_vertical ON opportunities(benchmark_vertical);
CREATE INDEX IF NOT EXISTS idx_seasonality_vertical_week ON seasonality_curves(vertical, iso_week);
CREATE INDEX IF NOT EXISTS idx_alerts_account_type ON performance_alerts(salesforce_account_id, alert_type);