import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Autocomplete,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TimelineIcon from '@mui/icons-material/Timeline';
import LaunchIcon from '@mui/icons-material/Launch';

interface VolumeSummary {
  currentWeekOrders: number;
  expectedWeekOrders: number;
  volumeVarianceOrders: number;
  volumeVariancePercentage: number;
  avgTrailing4WeekOrders: number;
  avgExpectedTrailing4WeekOrders: number;
  trailing4WeekVarianceOrders: number;
  trailing4WeekVariancePercentage: number;
  currentWeek: number;
  merchantCount: number;
  totalForecast12MonthOrders: number;
  totalOpportunityAnnualVolume: number;
  forecast12MonthVarianceOrders: number;
  forecast12MonthVariancePercentage: number;
}

interface WeeklyTrend {
  salesforce_account_id: string;
  opportunity_id: string;
  merchant_name: string;
  iso_week: number;
  actual_weekly_orders: number;
  benchmark_vertical: string;
  labels_paid_by: string;
  expected_weekly_orders: number;
  expected_adoption_rate: number;
  actual_adoption_rate: number;
  days_live: number;
  variance_orders: number;
  variance_percentage: number;
}

interface ForecastData {
  salesforce_account_id: string;
  opportunity_id: string;
  merchant_name: string;
  benchmark_vertical: string;
  labels_paid_by: string;
  trailing_4week_avg_orders: number;
  expected_weekly_orders: number;
  days_live: number;
  annual_order_volume: number;
  forecast_12month_orders: number | null;
  forecast_monthly_breakdown: any[] | null;
}

interface VolumeData {
  summary: VolumeSummary;
  weeklyTrends: WeeklyTrend[];
  forecasts: ForecastData[];
  seasonalityData: any[];
}

// Helper function to render merchant name with SFDC links
const renderMerchantWithLinks = (merchantName: string, accountId: string, opportunityId: string, verticalAndPayment?: string) => (
  <Box>
    <Box display="flex" alignItems="center" gap={0.5}>
      <Typography variant="body2" fontWeight="medium">
        {merchantName}
      </Typography>
      <Tooltip title="View SFDC Account">
        <IconButton
          size="small"
          sx={{ padding: '2px' }}
          onClick={() => window.open(`https://loopreturn.lightning.force.com/lightning/r/Account/${accountId}/view`, '_blank')}
        >
          <LaunchIcon sx={{ fontSize: 12, color: 'primary.main' }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="View SFDC Opportunity">
        <IconButton
          size="small"
          sx={{ padding: '2px' }}
          onClick={() => window.open(`https://loopreturn.lightning.force.com/lightning/r/Opportunity/${opportunityId}/view`, '_blank')}
        >
          <LaunchIcon sx={{ fontSize: 12, color: 'secondary.main' }} />
        </IconButton>
      </Tooltip>
    </Box>
    {verticalAndPayment && (
      <Typography variant="caption" color="textSecondary">
        {verticalAndPayment}
      </Typography>
    )}
  </Box>
);

export default function VolumeAnalysis() {
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysLiveFilter, setDaysLiveFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [merchantFilter, setMerchantFilter] = useState<string | null>(null);
  const [forecastTierFilter, setForecastTierFilter] = useState('all');

  const fetchVolumeData = async () => {
    try {
      const params = new URLSearchParams();
      if (daysLiveFilter !== 'all') {
        params.append('daysLive', daysLiveFilter);
      }

      const response = await fetch(`http://localhost:3001/api/analytics/volume?${params}`);
      const result = await response.json();

      if (result.success) {
        setVolumeData(result.data);
      } else {
        setError('Failed to fetch volume data');
      }
    } catch (err) {
      setError('Network error fetching volume data');
      console.error('Volume fetch error:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      await fetchVolumeData();
      setLoading(false);
    };

    fetchData();
  }, [daysLiveFilter]);

  // Get unique merchant names for autocomplete
  const getMerchantOptions = () => {
    if (!volumeData) return [];
    // Get merchants from both forecasts and weekly trends data
    const forecastMerchants = volumeData.forecasts.map(f => f.merchant_name).filter(Boolean);
    const trendsMerchants = volumeData.weeklyTrends.map(t => t.merchant_name).filter(Boolean);
    const allMerchants = [...forecastMerchants, ...trendsMerchants];
    return Array.from(new Set(allMerchants)).sort();
  };

  // Calculate forecast performance tier based on forecast vs expected volume
  const getForecastPerformanceTier = (forecast: ForecastData): string => {
    if (!forecast.forecast_12month_orders || forecast.annual_order_volume === 0) return 'unknown';

    const variancePercent = ((forecast.forecast_12month_orders - forecast.annual_order_volume) / forecast.annual_order_volume) * 100;

    if (variancePercent > 10) return 'exceeding';
    if (variancePercent >= -10) return 'meeting';
    if (variancePercent >= -20) return 'below';
    return 'significantly_below';
  };

  // Get forecast tier counts
  const getForecastTierCounts = () => {
    if (!volumeData) return { all: 0, exceeding: 0, meeting: 0, below: 0, significantly_below: 0 };

    const merchantData = getMerchantWeeklyData();
    const merchantsInWeeklyData = new Set(merchantData.map(m => m.merchant_name));
    const validForecasts = volumeData.forecasts.filter(forecast =>
      forecast.forecast_12month_orders !== null &&
      merchantsInWeeklyData.has(forecast.merchant_name)
    );

    return {
      all: validForecasts.length,
      exceeding: validForecasts.filter(f => getForecastPerformanceTier(f) === 'exceeding').length,
      meeting: validForecasts.filter(f => getForecastPerformanceTier(f) === 'meeting').length,
      below: validForecasts.filter(f => getForecastPerformanceTier(f) === 'below').length,
      significantly_below: validForecasts.filter(f => getForecastPerformanceTier(f) === 'significantly_below').length
    };
  };

  // Get the most recent 6 weeks for table headers
  const getRecentWeeks = () => {
    if (!volumeData) return [];
    const weekSet = new Set(volumeData.weeklyTrends.map(t => t.iso_week));
    const weeks = Array.from(weekSet);
    const sortedWeeks = weeks.sort((a, b) => b - a); // Sort descending
    return sortedWeeks.slice(0, 6).reverse(); // Take most recent 6, then reverse for chronological order
  };

  // Group weekly trends by merchant for table display
  const getMerchantWeeklyData = () => {
    if (!volumeData) return [];

    const recentWeeks = getRecentWeeks();
    const merchantMap = new Map();

    // First pass: Create merchant entries for ALL merchants
    volumeData.weeklyTrends.forEach(trend => {
      if (!merchantMap.has(trend.salesforce_account_id)) {
        merchantMap.set(trend.salesforce_account_id, {
          salesforce_account_id: trend.salesforce_account_id,
          opportunity_id: trend.opportunity_id,
          merchant_name: trend.merchant_name,
          benchmark_vertical: trend.benchmark_vertical,
          labels_paid_by: trend.labels_paid_by,
          days_live: trend.days_live,
          weeks: new Map(),
          trailing6WeekTotal: 0
        });
      }
    });

    // Second pass: Add weekly data for recent 6 weeks only
    volumeData.weeklyTrends.forEach(trend => {
      if (!recentWeeks.includes(trend.iso_week)) return;

      const merchant = merchantMap.get(trend.salesforce_account_id);
      merchant.weeks.set(trend.iso_week, {
        actual: trend.actual_weekly_orders,
        expected: trend.expected_weekly_orders,
        variance: trend.variance_orders,
        variancePercentage: trend.variance_percentage,
        actualAdoptionRate: trend.actual_adoption_rate,
        expectedAdoptionRate: trend.expected_adoption_rate
      });

      // Add to trailing 6-week total
      merchant.trailing6WeekTotal += trend.actual_weekly_orders;
    });

    // Convert to array and filter by merchant if needed
    let merchantArray = Array.from(merchantMap.values());

    // Apply merchant filter
    if (merchantFilter) {
      merchantArray = merchantArray.filter(merchant => merchant.merchant_name === merchantFilter);
    }

    // Sort by most recent week's volume (descending)
    const mostRecentWeek = Math.max(...recentWeeks);
    return merchantArray.sort((a, b) => {
      const aRecentVolume = a.weeks.get(mostRecentWeek)?.actual || 0;
      const bRecentVolume = b.weeks.get(mostRecentWeek)?.actual || 0;
      return bRecentVolume - aRecentVolume;
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading volume data...</Typography>
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

  if (!volumeData) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        No volume data available
      </Alert>
    );
  }

  const merchantData = getMerchantWeeklyData();
  const recentWeeks = getRecentWeeks();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Volume Analysis
      </Typography>

      {/* Filter Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Days Live Filter</InputLabel>
          <Select
            value={daysLiveFilter}
            label="Days Live Filter"
            onChange={(e) => setDaysLiveFilter(e.target.value)}
          >
            <MenuItem value="all">All Merchants</MenuItem>
            <MenuItem value="under30">&lt;30 Days Live</MenuItem>
            <MenuItem value="30-60">30-60 Days Live</MenuItem>
            <MenuItem value="30">&gt; 30 Days Live</MenuItem>
            <MenuItem value="60">&gt; 60 Days Live</MenuItem>
            <MenuItem value="90">&gt; 90 Days Live</MenuItem>
          </Select>
        </FormControl>
        <Autocomplete
          size="small"
          sx={{ minWidth: 250 }}
          options={getMerchantOptions()}
          value={merchantFilter}
          onChange={(event, newValue) => setMerchantFilter(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Filter by Merchant"
              placeholder="Search merchants..."
            />
          )}
          clearOnBlur={false}
          clearOnEscape
          freeSolo={false}
        />
      </Box>

      {/* Summary Metrics */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Week {volumeData.summary.currentWeek} Total Orders
                </Typography>
                <Typography variant="h4">
                  {volumeData.summary.currentWeekOrders.toLocaleString()} ({volumeData.summary.volumeVariancePercentage >= 0 ? '+' : ''}{volumeData.summary.volumeVariancePercentage.toFixed(1)}%)
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  Expected: {volumeData.summary.expectedWeekOrders.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.25 }}>
                  Merchant Count: {volumeData.summary.merchantCount}
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
                  Trailing 4-Week Avg
                </Typography>
                <Typography variant="h4">
                  {volumeData.summary.avgTrailing4WeekOrders.toLocaleString()} ({volumeData.summary.trailing4WeekVariancePercentage >= 0 ? '+' : ''}{volumeData.summary.trailing4WeekVariancePercentage.toFixed(1)}%)
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  Expected: {volumeData.summary.avgExpectedTrailing4WeekOrders.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.25 }}>
                  Merchant Count: {volumeData.summary.merchantCount}
                </Typography>
              </Box>
              <AssessmentIcon color="secondary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  12-Month Forecast
                </Typography>
                <Typography variant="h4">
                  {volumeData.summary.totalForecast12MonthOrders.toLocaleString()} ({volumeData.summary.forecast12MonthVariancePercentage >= 0 ? '+' : ''}{volumeData.summary.forecast12MonthVariancePercentage.toFixed(1)}%)
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  Expected: {volumeData.summary.totalOpportunityAnnualVolume.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.25 }}>
                  Forecasts: {volumeData.forecasts.length} of {volumeData.summary.merchantCount}
                </Typography>
              </Box>
              <TimelineIcon color="info" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Weekly Trends Table */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Weekly Order Volume Trends
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Merchant</TableCell>
                <TableCell align="right">Days Live</TableCell>
                {recentWeeks.map(week => (
                  <TableCell key={week} align="center">
                    <Typography variant="caption" fontWeight="bold">
                      Week {week}
                    </Typography>
                    <Typography variant="caption" display="block" color="textSecondary">
                      Orders / Adoption
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Total Row */}
              <TableRow sx={{ backgroundColor: 'grey.100', '& .MuiTableCell-root': { fontWeight: 'bold' } }}>
                <TableCell component="th" scope="row">
                  <Typography variant="body2" fontWeight="bold" color="text.primary">
                    TOTAL ({volumeData.summary.merchantCount} merchants)
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="bold" color="text.primary">
                    -
                  </Typography>
                </TableCell>
                {recentWeeks.map(week => {
                  // Calculate totals for this week across all merchants
                  const totalActual = merchantData.reduce((sum, merchant) => {
                    const weekData = merchant.weeks.get(week);
                    return sum + (weekData ? weekData.actual : 0);
                  }, 0);

                  const totalExpected = merchantData.reduce((sum, merchant) => {
                    const weekData = merchant.weeks.get(week);
                    return sum + (weekData ? weekData.expected : 0);
                  }, 0);

                  const totalVariance = totalActual - totalExpected;

                  // Calculate weighted average adoption rate
                  let totalOrdersWithAdoption = 0;
                  let weightedAdoptionSum = 0;

                  merchantData.forEach(merchant => {
                    const weekData = merchant.weeks.get(week);
                    if (weekData && weekData.actual > 0) {
                      totalOrdersWithAdoption += weekData.actual;
                      weightedAdoptionSum += weekData.actualAdoptionRate * weekData.actual;
                    }
                  });

                  const avgAdoptionRate = totalOrdersWithAdoption > 0 ? weightedAdoptionSum / totalOrdersWithAdoption : 0;

                  return (
                    <TableCell key={week} align="center">
                      <Box>
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {totalActual.toLocaleString()}
                        </Typography>
                        <Typography
                          variant="caption"
                          color={totalVariance >= 0 ? 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {totalVariance >= 0 ? `+${Math.round(totalVariance).toLocaleString()}` : `(${Math.abs(Math.round(totalVariance)).toLocaleString()})`}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.primary" fontWeight="bold">
                          {(avgAdoptionRate * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* Individual Merchant Rows */}
              {merchantData.map((merchant) => (
                <TableRow
                  key={merchant.merchant_name}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
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
                  {recentWeeks.map(week => {
                    const weekData = merchant.weeks.get(week);
                    return (
                      <TableCell key={week} align="center">
                        {weekData ? (
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {weekData.actual.toLocaleString()}
                            </Typography>
                            <Typography
                              variant="caption"
                              color={weekData.variance >= 0 ? 'success.main' : 'error.main'}
                            >
                              {weekData.variance >= 0 ? `+${Math.round(weekData.variance).toLocaleString()}` : `(${Math.abs(Math.round(weekData.variance)).toLocaleString()})`}
                            </Typography>
                            <Typography variant="caption" display="block" color="textSecondary">
                              {(weekData.actualAdoptionRate * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            n/a
                          </Typography>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
          Actual orders with variance vs. expected shown in middle, adoption rate shown below
        </Typography>
      </Paper>

      {/* 12-Month Forecast Table */}
      <Paper sx={{ p: 2, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          12-Month Volume Forecasts
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Based on trailing 4-week performance adjusted for seasonal patterns
        </Typography>

        {/* Forecast Performance Filter Chips */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Volume Forecast Performance Filter
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`All: ${getForecastTierCounts().all}`}
              color="primary"
              variant={forecastTierFilter === 'all' ? 'filled' : 'outlined'}
              onClick={() => setForecastTierFilter('all')}
              clickable
            />
            <Chip
              label={`Exceeding: ${getForecastTierCounts().exceeding}`}
              color="success"
              variant={forecastTierFilter === 'exceeding' ? 'filled' : 'outlined'}
              onClick={() => setForecastTierFilter('exceeding')}
              clickable
            />
            <Chip
              label={`Meeting: ${getForecastTierCounts().meeting}`}
              color="info"
              variant={forecastTierFilter === 'meeting' ? 'filled' : 'outlined'}
              onClick={() => setForecastTierFilter('meeting')}
              clickable
            />
            <Chip
              label={`Below: ${getForecastTierCounts().below}`}
              color="warning"
              variant={forecastTierFilter === 'below' ? 'filled' : 'outlined'}
              onClick={() => setForecastTierFilter('below')}
              clickable
            />
            <Chip
              label={`Significantly Below: ${getForecastTierCounts().significantly_below}`}
              color="error"
              variant={forecastTierFilter === 'significantly_below' ? 'filled' : 'outlined'}
              onClick={() => setForecastTierFilter('significantly_below')}
              clickable
            />
          </Box>
          <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
            Exceeding: &gt;10% above expected • Meeting: ±10% of expected • Below: 10-20% under • Significantly Below: &gt;20% under
          </Typography>
        </Paper>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Merchant</TableCell>
                <TableCell align="right">Days Live</TableCell>
                <TableCell align="right">Expected Weekly</TableCell>
                <TableCell align="right">T4Wk Avg Orders</TableCell>
                <TableCell align="right" sx={{ borderRight: 3, borderRightColor: 'divider' }}>Weekly Variance</TableCell>
                <TableCell align="right">12-Month Volume</TableCell>
                <TableCell align="right">12-Month Forecast</TableCell>
                <TableCell align="right">vs Expected (12M)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const merchantData = getMerchantWeeklyData();
                const merchantsInWeeklyData = new Set(merchantData.map(m => m.merchant_name));
                const filteredForecasts = volumeData.forecasts.filter(forecast => {
                  const hasValidForecast = forecast.forecast_12month_orders !== null && merchantsInWeeklyData.has(forecast.merchant_name);
                  if (!hasValidForecast) return false;

                  // Apply merchant filter
                  if (merchantFilter) {
                    return forecast.merchant_name === merchantFilter;
                  }

                  // Apply forecast tier filter
                  if (forecastTierFilter !== 'all') {
                    const tier = getForecastPerformanceTier(forecast);
                    return tier === forecastTierFilter;
                  }

                  return true;
                });
                const merchantCount = filteredForecasts.length;

                // Calculate totals
                const totalExpectedWeekly = filteredForecasts.reduce((sum, f) => sum + f.expected_weekly_orders, 0);
                const totalTrailing4Week = filteredForecasts.reduce((sum, f) => sum + f.trailing_4week_avg_orders, 0);
                const totalWeeklyVariance = totalTrailing4Week - totalExpectedWeekly;
                const totalWeeklyVariancePct = totalExpectedWeekly > 0 ? (totalWeeklyVariance / totalExpectedWeekly * 100) : 0;
                const totalAnnualVolume = filteredForecasts.reduce((sum, f) => sum + f.annual_order_volume, 0);
                const totalForecast = filteredForecasts.reduce((sum, f) => sum + (f.forecast_12month_orders || 0), 0);
                const totalVariance = totalForecast - totalAnnualVolume;
                const totalVariancePct = totalAnnualVolume > 0 ? (totalVariance / totalAnnualVolume * 100) : 0;

                return (
                  <>
                    {/* Total Row */}
                    <TableRow sx={{ backgroundColor: 'grey.100', '& .MuiTableCell-root': { fontWeight: 'bold' } }}>
                      <TableCell component="th" scope="row">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          TOTAL ({merchantCount} merchants)
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          -
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {Math.round(totalExpectedWeekly).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {Math.round(totalTrailing4Week).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ borderRight: 3, borderRightColor: 'divider' }}>
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <Typography
                            variant="body2"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {totalWeeklyVariance >= 0 ? `+${Math.round(totalWeeklyVariance).toLocaleString()}` : `(${Math.abs(Math.round(totalWeeklyVariance)).toLocaleString()})`}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {totalWeeklyVariancePct >= 0 ? `+${totalWeeklyVariancePct.toFixed(1)}%` : `(${Math.abs(totalWeeklyVariancePct).toFixed(1)}%)`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {totalAnnualVolume.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {totalForecast.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <Typography
                            variant="body2"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {totalVariance >= 0 ? `+${Math.round(totalVariance).toLocaleString()}` : `(${Math.abs(Math.round(totalVariance)).toLocaleString()})`}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {totalVariancePct >= 0 ? `+${totalVariancePct.toFixed(1)}%` : `(${Math.abs(totalVariancePct).toFixed(1)}%)`}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Individual Merchant Rows */}
                    {filteredForecasts
                      .sort((a, b) => (b.forecast_12month_orders || 0) - (a.forecast_12month_orders || 0))
                      .map((forecast) => {
                  const forecastVsExpected = forecast.forecast_12month_orders! - forecast.annual_order_volume;
                  const forecastVsExpectedPct = forecast.annual_order_volume > 0 ?
                    (forecastVsExpected / forecast.annual_order_volume * 100) : 0;

                  const weeklyVariance = forecast.trailing_4week_avg_orders - forecast.expected_weekly_orders;
                  const weeklyVariancePct = forecast.expected_weekly_orders > 0 ?
                    (weeklyVariance / forecast.expected_weekly_orders * 100) : 0;

                  return (
                    <TableRow
                      key={forecast.salesforce_account_id}
                      sx={{
                        '&:last-child td, &:last-child th': { border: 0 },
                        '&:last-child .weekly-variance-column': { borderRight: '3px solid', borderRightColor: 'divider' }
                      }}
                    >
                      <TableCell component="th" scope="row">
                        {renderMerchantWithLinks(
                          forecast.merchant_name,
                          forecast.salesforce_account_id,
                          forecast.opportunity_id,
                          `${forecast.benchmark_vertical || 'Unknown'} • ${forecast.labels_paid_by === 'Loop' ? 'LPL' : forecast.labels_paid_by === 'Merchant' ? 'MPL' : forecast.labels_paid_by}`
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${Math.round(forecast.days_live)} days`}
                          size="small"
                          color={forecast.days_live > 60 ? 'success' : forecast.days_live > 30 ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {Math.round(forecast.expected_weekly_orders).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {Math.round(forecast.trailing_4week_avg_orders).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" className="weekly-variance-column" sx={{ borderRight: 3, borderRightColor: 'divider' }}>
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <Typography
                            variant="body2"
                            color={weeklyVariance >= 0 ? 'success.main' : 'error.main'}
                            fontWeight={weeklyVariance >= 0 ? 'normal' : 'bold'}
                          >
                            {weeklyVariance >= 0 ? `+${Math.round(weeklyVariance).toLocaleString()}` : `(${Math.abs(Math.round(weeklyVariance)).toLocaleString()})`}
                          </Typography>
                          <Typography
                            variant="caption"
                            color={weeklyVariancePct >= 0 ? 'success.main' : 'error.main'}
                            fontWeight={weeklyVariancePct >= 0 ? 'normal' : 'bold'}
                          >
                            {weeklyVariancePct >= 0 ? `+${weeklyVariancePct.toFixed(1)}%` : `(${Math.abs(weeklyVariancePct).toFixed(1)}%)`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {forecast.annual_order_volume.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {forecast.forecast_12month_orders!.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" flexDirection="column" alignItems="flex-end">
                          <Typography
                            variant="body2"
                            color={forecastVsExpected >= 0 ? 'success.main' : 'error.main'}
                            fontWeight={forecastVsExpected >= 0 ? 'normal' : 'bold'}
                          >
                            {forecastVsExpected >= 0 ? `+${Math.round(forecastVsExpected).toLocaleString()}` : `(${Math.abs(Math.round(forecastVsExpected)).toLocaleString()})`}
                          </Typography>
                          <Typography
                            variant="caption"
                            color={forecastVsExpectedPct >= 0 ? 'success.main' : 'error.main'}
                            fontWeight={forecastVsExpectedPct >= 0 ? 'normal' : 'bold'}
                          >
                            {forecastVsExpectedPct >= 0 ? `+${forecastVsExpectedPct.toFixed(1)}%` : `(${Math.abs(forecastVsExpectedPct).toFixed(1)}%)`}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                  </>
                );
              })()}
            </TableBody>
          </Table>
        </TableContainer>

        {volumeData.forecasts.filter(f => f.forecast_12month_orders !== null).length === 0 && (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="textSecondary">
              No forecast data available. Merchants need at least 4 weeks of performance data for forecasting.
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
          Forecasts use trailing 4-week performance as baseline, adjusted by seasonality curves
        </Typography>
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
          Note: Only merchants with ≥4 weeks of performance data are included in forecasting. Newer merchants appear in the Weekly Order Volume table above but require more historical data for reliable projections.
        </Typography>
      </Paper>
    </Box>
  );
}