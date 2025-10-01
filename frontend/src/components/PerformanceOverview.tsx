import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Switch,
  FormControlLabel,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { renderMerchantWithLinks } from '../utils/merchantHelpers';
import { useMerchantExclusion } from '../hooks/useMerchantExclusion';
import { ExcludeCheckboxColumn } from './common/ExcludeCheckboxColumn';
import { MerchantFilterAutocomplete } from './common/MerchantFilterAutocomplete';
import { DaysLiveFilter } from './common/DaysLiveFilter';

interface PerformanceMetrics {
  totalMerchants: number;
  activeMerchants: number;
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

interface PerformanceTiers {
  exceeding: number;
  meeting: number;
  slightlyBelow: number;
  significantlyBelow: number;
}

interface OverviewData {
  metrics: PerformanceMetrics;
  performanceTiers: PerformanceTiers;
  merchantCount: number;
  lastUpdated: string;
}

interface MerchantData {
  salesforce_account_id: string;
  opportunity_id: string;
  merchant_name: string;
  days_live: number;
  current_adoption_rate: number;
  expected_adoption_rate: number;
  adoption_variance_bps: number;
  trailing_4week_adoption_rate: number | null;
  trailing_4week_variance_bps: number | null;
  current_eligibility_rate: number;
  expected_eligibility_rate: number;
  eligibility_variance_bps: number;
  trailing_4week_eligibility_rate: number | null;
  trailing_4week_eligibility_variance_bps: number | null;
  current_ecom_orders: number;
  trailing_4week_ecom_orders: number | null;
  current_week: number;
  attach_rate: number;
  performance_tier: string;
  benchmark_vertical: string;
  pricing_model: string;
  labels_paid_by: string;
}

export default function PerformanceOverview() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [merchantData, setMerchantData] = useState<MerchantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysLiveFilter, setDaysLiveFilter] = useState('all');
  const [performanceTierFilter, setPerformanceTierFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [merchantFilter, setMerchantFilter] = useState<string | null>(null);
  const [allMerchantData, setAllMerchantData] = useState<MerchantData[]>([]);
  const [hideLowAdoptionRate, setHideLowAdoptionRate] = useState(false);

  // Use the merchant exclusion hook
  const { excludedMerchants, handleExcludeToggle, handleSelectAll, handleClearAll, setExcluded } = useMerchantExclusion();

  const fetchOverviewData = async () => {
    try {
      const params = new URLSearchParams();
      if (daysLiveFilter !== 'all') {
        params.append('daysLive', daysLiveFilter);
      }

      const response = await fetch(`${API_ENDPOINTS.ANALYTICS_OVERVIEW}?${params}`);
      const result = await response.json();

      if (result.success) {
        setOverviewData(result.data);
      } else {
        setError('Failed to fetch overview data');
      }
    } catch (err) {
      setError('Network error fetching overview data');
      console.error('Overview fetch error:', err);
    }
  };

  const fetchAllMerchantData = async () => {
    try {
      const params = new URLSearchParams();
      if (daysLiveFilter !== 'all') {
        params.append('daysLive', daysLiveFilter);
      }
      // Don't apply performance tier or merchant name filters for summary data
      params.append('limit', '1000');

      const response = await fetch(`${API_ENDPOINTS.ANALYTICS_MERCHANTS}?${params}`);
      const result = await response.json();

      if (result.success) {
        setAllMerchantData(result.data);
      }
    } catch (err) {
      console.error('All merchant fetch error:', err);
    }
  };

  const fetchMerchantData = async () => {
    try {
      const params = new URLSearchParams();
      if (daysLiveFilter !== 'all') {
        params.append('daysLive', daysLiveFilter);
      }
      if (performanceTierFilter !== 'all') {
        params.append('tier', performanceTierFilter);
      }
      if (merchantFilter) {
        params.append('merchant', merchantFilter);
      }
      // Set a high limit to get all merchants
      params.append('limit', '1000');

      const response = await fetch(`${API_ENDPOINTS.ANALYTICS_MERCHANTS}?${params}`);
      const result = await response.json();

      if (result.success) {
        setMerchantData(result.data);
      } else {
        setError('Failed to fetch merchant data');
      }
    } catch (err) {
      setError('Network error fetching merchant data');
      console.error('Merchant fetch error:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([fetchOverviewData(), fetchMerchantData(), fetchAllMerchantData()]);
      setLoading(false);
    };

    fetchData();
  }, [daysLiveFilter, performanceTierFilter, merchantFilter]);

  // Automatically exclude/include merchants based on the low adoption rate toggle
  useEffect(() => {
    if (hideLowAdoptionRate) {
      // Add merchants with <2% adoption rate to the excluded set
      const lowAdoptionMerchants = allMerchantData
        .filter(m => m.current_adoption_rate < 0.02)
        .map(m => m.salesforce_account_id);

      setExcluded(prev => {
        const newExcluded = new Set(prev);
        lowAdoptionMerchants.forEach(id => newExcluded.add(id));
        return newExcluded;
      });
    } else {
      // Remove low adoption merchants from excluded set
      const lowAdoptionMerchants = allMerchantData
        .filter(m => m.current_adoption_rate < 0.02)
        .map(m => m.salesforce_account_id);

      setExcluded(prev => {
        const newExcluded = new Set(prev);
        lowAdoptionMerchants.forEach(id => newExcluded.delete(id));
        return newExcluded;
      });
    }
  }, [hideLowAdoptionRate, allMerchantData, setExcluded]);

  // Get unique merchant names for autocomplete
  const merchantOptions = merchantData ? Array.from(new Set(merchantData.map(m => m.merchant_name).filter(Boolean))).sort() : [];

  // Wrapper for handleSelectAll to pass merchant IDs
  const handleSelectAllFiltered = () => {
    const allMerchantIds = getFilteredMerchantData().map(m => m.salesforce_account_id);
    handleSelectAll(allMerchantIds);
  };

  const getFilteredMerchantData = () => {
    let filtered = merchantData || [];

    // Apply merchant filter
    if (merchantFilter) {
      filtered = filtered.filter(m => m.merchant_name === merchantFilter);
    }

    // Apply performance tier filter
    if (performanceTierFilter !== 'all') {
      filtered = filtered.filter(m => m.performance_tier === performanceTierFilter);
    }

    return filtered;
  };

  const getFilteredAndIncludedMerchantData = () => {
    return getFilteredMerchantData().filter(m => !excludedMerchants.has(m.salesforce_account_id));
  };

  // Calculate filtered summary metrics (only apply exclusions, not UI filters)
  const getFilteredSummaryMetrics = () => {
    // Get all merchant data regardless of UI filters, but excluding explicitly excluded merchants
    const filteredData = allMerchantData.filter(m => !excludedMerchants.has(m.salesforce_account_id));

    if (!filteredData || filteredData.length === 0) {
      return {
        totalMerchants: 0,
        avgAdoptionRate: 0,
        avgEligibilityRate: 0,
        avgAttachRate: 0,
        trailing4WeekAdoptionRate: 0,
        trailing4WeekEligibilityRate: 0,
        trailing4WeekAttachRate: 0,
        volumeWeightedAdoptionRate: 0,
        volumeWeightedEligibilityRate: 0,
        volumeWeightedAttachRate: 0,
        trailing4WeekVolumeWeightedAdoptionRate: 0,
        trailing4WeekVolumeWeightedEligibilityRate: 0,
        trailing4WeekVolumeWeightedAttachRate: 0
      };
    }

    const merchantCount = filteredData.length;

    // Calculate simple averages
    const avgAdoptionRate = filteredData.reduce((sum, m) => sum + m.current_adoption_rate, 0) / merchantCount;
    const avgEligibilityRate = filteredData.reduce((sum, m) => sum + m.current_eligibility_rate, 0) / merchantCount;
    const avgAttachRate = filteredData.reduce((sum, m) => sum + m.attach_rate, 0) / merchantCount;

    // Calculate trailing 4-week simple averages (filter out null values)
    const merchantsWithTrailing = filteredData.filter(m => m.trailing_4week_adoption_rate !== null);
    const trailing4WeekAdoptionRate = merchantsWithTrailing.length > 0
      ? merchantsWithTrailing.reduce((sum, m) => sum + (m.trailing_4week_adoption_rate || 0), 0) / merchantsWithTrailing.length
      : 0;

    const merchantsWithTrailingElig = filteredData.filter(m => m.trailing_4week_eligibility_rate !== null);
    const trailing4WeekEligibilityRate = merchantsWithTrailingElig.length > 0
      ? merchantsWithTrailingElig.reduce((sum, m) => sum + (m.trailing_4week_eligibility_rate || 0), 0) / merchantsWithTrailingElig.length
      : 0;

    const trailing4WeekAttachRate = avgAttachRate; // Attach rate doesn't have trailing data

    // Calculate volume-weighted averages
    const totalOrders = filteredData.reduce((sum, m) => sum + m.current_ecom_orders, 0);
    const volumeWeightedAdoptionRate = totalOrders > 0
      ? filteredData.reduce((sum, m) => sum + (m.current_adoption_rate * m.current_ecom_orders), 0) / totalOrders
      : 0;
    const volumeWeightedEligibilityRate = totalOrders > 0
      ? filteredData.reduce((sum, m) => sum + (m.current_eligibility_rate * m.current_ecom_orders), 0) / totalOrders
      : 0;
    const volumeWeightedAttachRate = totalOrders > 0
      ? filteredData.reduce((sum, m) => sum + (m.attach_rate * m.current_ecom_orders), 0) / totalOrders
      : 0;

    // Calculate trailing 4-week volume-weighted averages
    const totalTrailingOrders = filteredData
      .filter(m => m.trailing_4week_ecom_orders !== null)
      .reduce((sum, m) => sum + (m.trailing_4week_ecom_orders || 0), 0);

    const merchantsWithTrailingOrders = filteredData.filter(m =>
      m.trailing_4week_adoption_rate !== null && m.trailing_4week_ecom_orders !== null
    );
    const trailing4WeekVolumeWeightedAdoptionRate = totalTrailingOrders > 0
      ? merchantsWithTrailingOrders.reduce((sum, m) =>
          sum + ((m.trailing_4week_adoption_rate || 0) * (m.trailing_4week_ecom_orders || 0)), 0) / totalTrailingOrders
      : 0;

    const merchantsWithTrailingEligOrders = filteredData.filter(m =>
      m.trailing_4week_eligibility_rate !== null && m.trailing_4week_ecom_orders !== null
    );
    const trailing4WeekVolumeWeightedEligibilityRate = totalTrailingOrders > 0
      ? merchantsWithTrailingEligOrders.reduce((sum, m) =>
          sum + ((m.trailing_4week_eligibility_rate || 0) * (m.trailing_4week_ecom_orders || 0)), 0) / totalTrailingOrders
      : 0;

    const trailing4WeekVolumeWeightedAttachRate = totalTrailingOrders > 0
      ? filteredData
          .filter(m => m.trailing_4week_ecom_orders !== null)
          .reduce((sum, m) => sum + (m.attach_rate * (m.trailing_4week_ecom_orders || 0)), 0) / totalTrailingOrders
      : 0;

    return {
      totalMerchants: merchantCount,
      avgAdoptionRate,
      avgEligibilityRate,
      avgAttachRate,
      trailing4WeekAdoptionRate,
      trailing4WeekEligibilityRate,
      trailing4WeekAttachRate,
      volumeWeightedAdoptionRate,
      volumeWeightedEligibilityRate,
      volumeWeightedAttachRate,
      trailing4WeekVolumeWeightedAdoptionRate,
      trailing4WeekVolumeWeightedEligibilityRate,
      trailing4WeekVolumeWeightedAttachRate
    };
  };

  const getPerformanceTierColor = (tier: string) => {
    switch (tier) {
      case 'exceeding': return 'success';
      case 'meeting': return 'info';
      case 'slightly_below': return 'warning';
      case 'significantly_below': return 'error';
      default: return 'default';
    }
  };

  const getPerformanceTierLabel = (tier: string) => {
    switch (tier) {
      case 'exceeding': return 'Exceeding';
      case 'meeting': return 'Meeting';
      case 'slightly_below': return 'Slightly Below';
      case 'significantly_below': return 'Significantly Below';
      default: return tier;
    }
  };

  const handleDaysLiveFilterChange = (value: string) => {
    setDaysLiveFilter(value);
  };

  const handlePerformanceTierFilterChange = (value: string) => {
    setPerformanceTierFilter(value);
  };

  const handleMerchantFilterChange = (value: string | null) => {
    setMerchantFilter(value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading performance data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!overviewData) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        No performance data available
      </Alert>
    );
  }

  // Get filtered metrics that respect exclusions
  const filteredMetrics = getFilteredSummaryMetrics();

  // For chips, use server data. For summary tiles, use filtered metrics
  const totalMerchantsFromServer = overviewData.metrics.totalMerchants;
  const excludedCount = excludedMerchants.size;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Performance Overview
      </Typography>

      {/* Filter Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <DaysLiveFilter
          value={daysLiveFilter}
          onChange={handleDaysLiveFilterChange}
          size="small"
        />
        <MerchantFilterAutocomplete
          merchants={merchantOptions}
          value={merchantFilter}
          onChange={(event, newValue) => handleMerchantFilterChange(newValue)}
          size="small"
        />
        <FormControlLabel
          control={
            <Switch
              checked={hideLowAdoptionRate}
              onChange={(e) => setHideLowAdoptionRate(e.target.checked)}
              size="small"
            />
          }
          label="Hide <2% adoption rate"
          sx={{ ml: 2 }}
        />
      </Box>

      {/* Summary Metrics */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Merchants
                </Typography>
                <Typography variant="h4">
                  {totalMerchantsFromServer - excludedCount}
                  {excludedCount > 0 && (
                    <span style={{ marginLeft: '4px', color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.7em' }}>
                      ({excludedCount} excluded)
                    </span>
                  )}
                </Typography>
              </Box>
              <BusinessIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Avg Adoption Rate (Current Week)
                </Typography>
                <Typography variant="h4">
                  {(filteredMetrics.avgAdoptionRate * 100).toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  T4Wk: {(filteredMetrics.trailing4WeekAdoptionRate * 100).toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.2, fontSize: '0.65rem' }}>
                  Vol-weighted: {(filteredMetrics.volumeWeightedAdoptionRate * 100).toFixed(1)}% | T4Wk: {(filteredMetrics.trailing4WeekVolumeWeightedAdoptionRate * 100).toFixed(1)}%
                </Typography>
              </Box>
              <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>


        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Avg Eligibility Rate (Current Week)
                </Typography>
                <Typography variant="h4">
                  {(filteredMetrics.avgEligibilityRate * 100).toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  T4Wk: {(filteredMetrics.trailing4WeekEligibilityRate * 100).toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.2, fontSize: '0.65rem' }}>
                  Vol-weighted: {(filteredMetrics.volumeWeightedEligibilityRate * 100).toFixed(1)}% | T4Wk: {(filteredMetrics.trailing4WeekVolumeWeightedEligibilityRate * 100).toFixed(1)}%
                </Typography>
              </Box>
              <CheckCircleIcon color="secondary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Performance Tiers */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Performance Distribution
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`All: ${totalMerchantsFromServer}`}
            color="primary"
            variant={performanceTierFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => handlePerformanceTierFilterChange('all')}
            clickable
          />
          <Chip
            label={`Exceeding: ${overviewData.performanceTiers.exceeding}`}
            color="success"
            variant={performanceTierFilter === 'exceeding' ? 'filled' : 'outlined'}
            onClick={() => handlePerformanceTierFilterChange('exceeding')}
            clickable
          />
          <Chip
            label={`Meeting: ${overviewData.performanceTiers.meeting}`}
            color="info"
            variant={performanceTierFilter === 'meeting' ? 'filled' : 'outlined'}
            onClick={() => handlePerformanceTierFilterChange('meeting')}
            clickable
          />
          <Chip
            label={`Slightly Below: ${overviewData.performanceTiers.slightlyBelow}`}
            color="warning"
            variant={performanceTierFilter === 'slightly_below' ? 'filled' : 'outlined'}
            onClick={() => handlePerformanceTierFilterChange('slightly_below')}
            clickable
          />
          <Chip
            label={`Significantly Below: ${overviewData.performanceTiers.significantlyBelow}`}
            color="error"
            variant={performanceTierFilter === 'significantly_below' ? 'filled' : 'outlined'}
            onClick={() => handlePerformanceTierFilterChange('significantly_below')}
            clickable
          />
        </Box>
      </Paper>

      {/* Top Merchants Table */}
      <Paper sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
            Merchant Performance {performanceTierFilter !== 'all' ? `(${getPerformanceTierLabel(performanceTierFilter)})` : ''}
          </Typography>
          {excludedMerchants.size > 0 && (
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {excludedMerchants.size} merchant{excludedMerchants.size !== 1 ? 's' : ''} excluded
              </Typography>
            </Box>
          )}
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <ExcludeCheckboxColumn
                  onSelectAll={handleSelectAllFiltered}
                  onClearAll={handleClearAll}
                />
                <TableCell>Merchant</TableCell>
                <TableCell align="right">Days Live</TableCell>
                <TableCell align="right">Trailing 4-Week Orders</TableCell>
                <TableCell align="right">Trailing 4-Week Eligibility</TableCell>
                <TableCell align="right">
                  {merchantData.length > 0 ? `Week ${merchantData[0].current_week} Eligibility Rate` : 'Current Eligibility Rate'}
                </TableCell>
                <TableCell align="right">Trailing 4-Week Adoption</TableCell>
                <TableCell align="right">
                  {merchantData.length > 0 ? `Week ${merchantData[0].current_week} Adoption Rate` : 'Current Adoption Rate'}
                </TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getFilteredMerchantData().map((merchant) => (
                <TableRow
                  key={merchant.salesforce_account_id}
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    backgroundColor: excludedMerchants.has(merchant.salesforce_account_id) ? 'rgba(255, 193, 7, 0.1)' : 'inherit'
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={excludedMerchants.has(merchant.salesforce_account_id)}
                      onChange={() => handleExcludeToggle(merchant.salesforce_account_id)}
                    />
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {renderMerchantWithLinks(
                      merchant.merchant_name,
                      merchant.salesforce_account_id,
                      merchant.opportunity_id,
                      `${merchant.benchmark_vertical || 'Unknown'} • ${merchant.labels_paid_by === 'Loop' ? 'LPL' : merchant.labels_paid_by === 'Merchant' ? 'MPL' : merchant.labels_paid_by}`
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${Math.round(merchant.days_live)} days`}
                      size="small"
                      color={merchant.days_live > 60 ? 'success' : merchant.days_live > 30 ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {merchant.trailing_4week_ecom_orders !== null
                        ? Math.round(merchant.trailing_4week_ecom_orders).toLocaleString()
                        : 'n/a'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                      <Typography variant="body2">
                        {merchant.trailing_4week_eligibility_rate !== null
                          ? `${(merchant.trailing_4week_eligibility_rate * 100).toFixed(1)}%`
                          : 'n/a'
                        }
                      </Typography>
                      <Typography
                        variant="caption"
                        color={merchant.trailing_4week_eligibility_variance_bps !== null && merchant.trailing_4week_eligibility_variance_bps >= 0 ? 'success.main' : 'error.main'}
                      >
                        {merchant.trailing_4week_eligibility_variance_bps !== null
                          ? `${merchant.trailing_4week_eligibility_variance_bps > 0 ? '+' : ''}${Math.round(merchant.trailing_4week_eligibility_variance_bps)} bps`
                          : 'n/a'
                        }
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                      <Box display="flex" alignItems="center">
                        {(merchant.current_eligibility_rate * 100).toFixed(1)}%
                        {merchant.trailing_4week_eligibility_rate !== null ? (
                          merchant.current_eligibility_rate > merchant.trailing_4week_eligibility_rate ? (
                            <TrendingUpIcon color="success" sx={{ ml: 1, fontSize: 16 }} />
                          ) : (
                            <TrendingDownIcon color="error" sx={{ ml: 1, fontSize: 16 }} />
                          )
                        ) : null}
                      </Box>
                      <Typography
                        variant="caption"
                        color={merchant.eligibility_variance_bps >= 0 ? 'success.main' : 'error.main'}
                      >
                        {merchant.eligibility_variance_bps > 0 ? '+' : ''}
                        {Math.round(merchant.eligibility_variance_bps)} bps
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                      <Typography variant="body2">
                        {merchant.trailing_4week_adoption_rate !== null
                          ? `${(merchant.trailing_4week_adoption_rate * 100).toFixed(1)}%`
                          : 'n/a'
                        }
                      </Typography>
                      <Typography
                        variant="caption"
                        color={merchant.trailing_4week_variance_bps !== null && merchant.trailing_4week_variance_bps >= 0 ? 'success.main' : 'error.main'}
                      >
                        {merchant.trailing_4week_variance_bps !== null
                          ? `${merchant.trailing_4week_variance_bps > 0 ? '+' : ''}${Math.round(merchant.trailing_4week_variance_bps)} bps`
                          : 'n/a'
                        }
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" flexDirection="column" alignItems="flex-end">
                      <Box display="flex" alignItems="center">
                        {(merchant.current_adoption_rate * 100).toFixed(1)}%
                        {merchant.trailing_4week_adoption_rate !== null ? (
                          merchant.current_adoption_rate > merchant.trailing_4week_adoption_rate ? (
                            <TrendingUpIcon color="success" sx={{ ml: 1, fontSize: 16 }} />
                          ) : (
                            <TrendingDownIcon color="error" sx={{ ml: 1, fontSize: 16 }} />
                          )
                        ) : null}
                      </Box>
                      <Typography
                        variant="caption"
                        color={merchant.adoption_variance_bps >= 0 ? 'success.main' : 'error.main'}
                      >
                        {merchant.adoption_variance_bps > 0 ? '+' : ''}
                        {Math.round(merchant.adoption_variance_bps)} bps
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={getPerformanceTierLabel(merchant.performance_tier)}
                      size="small"
                      color={getPerformanceTierColor(merchant.performance_tier) as any}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>


        {merchantData.length === 0 && (
          <Box textAlign="center" py={4}>
            <WarningIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
            <Typography variant="body1" color="textSecondary">
              No merchants match the selected filter criteria.
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
          Last updated: {new Date(overviewData.lastUpdated).toLocaleString()}
        </Typography>
      </Paper>
    </Box>
  );
}