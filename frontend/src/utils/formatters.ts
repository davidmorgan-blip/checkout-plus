/**
 * Formats a number as currency with optional compact notation
 * @param value - The numeric value to format
 * @param compact - If true, uses compact notation (K, M) for large numbers
 * @returns Formatted currency string (negative values shown in parentheses)
 */
export const formatCurrency = (value: number, compact: boolean = false): string => {
  const absValue = Math.abs(value);
  let formatted: string;

  if (compact) {
    if (absValue >= 1000000) {
      formatted = `$${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      formatted = `$${(absValue / 1000).toFixed(0)}K`;
    } else {
      formatted = `$${absValue.toFixed(0)}`;
    }
  } else {
    formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absValue);
  }

  return value < 0 ? `(${formatted})` : formatted;
};

/**
 * Formats a percentage value with optional sign
 * @param value - The percentage value (e.g., 15.5 for 15.5%)
 * @param showSign - If true, shows '+' for positive values
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, showSign: boolean = true): string => {
  const sign = showSign && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

/**
 * Formats a volume/count number with optional compact notation
 * @param value - The numeric value to format
 * @param compact - If true, uses compact notation (K, M) for large numbers
 * @returns Formatted volume string
 */
export const formatVolume = (value: number, compact: boolean = true): string => {
  const absValue = Math.abs(value);
  let formatted: string;

  if (compact) {
    if (absValue >= 1000000) {
      formatted = `${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      formatted = `${(absValue / 1000).toFixed(0)}K`;
    } else {
      formatted = absValue.toFixed(0);
    }
  } else {
    formatted = Math.round(absValue).toLocaleString();
  }

  return formatted;
};

/**
 * Formats pricing model and labels paid by information
 * @param pricingModel - The pricing model (e.g., "Rev Share", "Flat")
 * @param labelsPaidBy - Who pays for labels (e.g., "Loop", "Merchant")
 * @returns Formatted string like "Rev Share • MPL" or "Flat • LPL"
 */
export const formatPricingInfo = (pricingModel: string, labelsPaidBy: string): string => {
  const labelsAbbreviation = labelsPaidBy === 'Loop' ? 'LPL' : labelsPaidBy === 'Merchant' ? 'MPL' : '';
  return labelsAbbreviation ? `${pricingModel} • ${labelsAbbreviation}` : pricingModel;
};
