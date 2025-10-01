import React from 'react';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

/**
 * Configuration for variance thresholds
 */
export interface VarianceThresholds {
  success: number;  // Values above this are "success" (green)
  warning: number;  // Values between warning and success are "warning" (yellow/orange)
  // Values below warning are "error" (red)
}

/**
 * Standard threshold configurations for common use cases
 */
export const VARIANCE_THRESHOLDS = {
  // For percentage-based comparisons where 0% is neutral
  PERCENTAGE: {
    success: 10,   // > 10% is success
    warning: -10,  // Between -10% and 10% is warning/meeting expectations
  },
  // For ACV variance where 100% is meeting expectations
  ACV: {
    success: 110,  // > 110% is exceeding
    warning: 90,   // Between 90% and 110% is meeting/on track
  },
};

/**
 * Returns Material-UI color based on variance value and thresholds
 * @param variance - The variance value to evaluate
 * @param thresholds - Custom thresholds, or use defaults
 * @returns MUI color string: 'success', 'warning', 'error', or 'default'
 */
export const getVarianceColor = (
  variance: number,
  thresholds: VarianceThresholds = VARIANCE_THRESHOLDS.PERCENTAGE
): 'success' | 'warning' | 'error' | 'default' => {
  if (variance >= thresholds.success) return 'success';
  if (variance >= thresholds.warning) return 'warning';
  return 'error';
};

/**
 * Returns appropriate trend icon based on variance direction
 * @param variance - The variance value to evaluate
 * @returns Trending up icon for positive, trending down for negative, null for zero
 */
export const getVarianceIcon = (variance: number) => {
  if (variance > 0) return <TrendingUpIcon fontSize="small" />;
  if (variance < 0) return <TrendingDownIcon fontSize="small" />;
  return null;
};
