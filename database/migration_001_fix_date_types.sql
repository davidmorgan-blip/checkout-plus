-- Migration to fix date types in opportunities table
-- Convert M/D/YY format to proper YYYY-MM-DD DATE format

-- Create new table with proper date types
CREATE TABLE opportunities_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_casesafe_id TEXT NOT NULL,
  account_name TEXT,
  opportunity_id TEXT UNIQUE NOT NULL,
  benchmark_vertical TEXT,
  close_date DATE,
  contract_effective_date DATE,
  checkout_enabled TEXT,
  pricing_model TEXT,
  labels_paid_by TEXT,
  loop_share_percent REAL,
  est_offset_net_revenue REAL,
  initial_offset_fee REAL,
  refund_handling_fee REAL,
  annual_order_volume INTEGER,
  blended_avg_cost_per_return REAL,
  domestic_return_rate REAL,
  adoption_rate REAL,
  opportunity_record_type TEXT,
  implementation_status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy data with date conversion from M/D/YY to YYYY-MM-DD format
INSERT INTO opportunities_new (
  id,
  account_casesafe_id,
  account_name,
  opportunity_id,
  benchmark_vertical,
  close_date,
  contract_effective_date,
  checkout_enabled,
  pricing_model,
  labels_paid_by,
  loop_share_percent,
  est_offset_net_revenue,
  initial_offset_fee,
  refund_handling_fee,
  annual_order_volume,
  blended_avg_cost_per_return,
  domestic_return_rate,
  adoption_rate,
  opportunity_record_type,
  implementation_status,
  created_at,
  updated_at
)
SELECT
  id,
  account_casesafe_id,
  account_name,
  opportunity_id,
  benchmark_vertical,
  CASE
    WHEN close_date IS NOT NULL AND close_date != '' THEN
      '20' || substr(close_date, -2) || '-' ||
      printf('%02d', CAST(substr(close_date, 1, instr(close_date, '/')-1) AS INTEGER)) || '-' ||
      printf('%02d', CAST(substr(close_date, instr(close_date, '/')+1, instr(substr(close_date, instr(close_date, '/')+1), '/')-1) AS INTEGER))
    ELSE NULL
  END,
  CASE
    WHEN contract_effective_date IS NOT NULL AND contract_effective_date != '' THEN
      '20' || substr(contract_effective_date, -2) || '-' ||
      printf('%02d', CAST(substr(contract_effective_date, 1, instr(contract_effective_date, '/')-1) AS INTEGER)) || '-' ||
      printf('%02d', CAST(substr(contract_effective_date, instr(contract_effective_date, '/')+1, instr(substr(contract_effective_date, instr(contract_effective_date, '/')+1), '/')-1) AS INTEGER))
    ELSE NULL
  END,
  checkout_enabled,
  pricing_model,
  labels_paid_by,
  loop_share_percent,
  est_offset_net_revenue,
  initial_offset_fee,
  refund_handling_fee,
  annual_order_volume,
  blended_avg_cost_per_return,
  domestic_return_rate,
  adoption_rate,
  opportunity_record_type,
  implementation_status,
  created_at,
  updated_at
FROM opportunities;

-- Drop old table and rename new one
DROP TABLE opportunities;
ALTER TABLE opportunities_new RENAME TO opportunities;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_vertical ON opportunities(benchmark_vertical);