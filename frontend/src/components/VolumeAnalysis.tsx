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
  Checkbox,
  Link,
  Collapse,
  Button
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TimelineIcon from '@mui/icons-material/Timeline';
import LaunchIcon from '@mui/icons-material/Launch';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { API_ENDPOINTS } from '../config/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

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
  merchant_segment: string;
  opportunity_record_type: string;
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
  merchant_segment: string;
  opportunity_record_type: string;
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
  const [merchantSegmentFilter, setMerchantSegmentFilter] = useState('all');
  const [recordTypeFilter, setRecordTypeFilter] = useState('all');
  const [excludedMerchants, setExcludedMerchants] = useState<Set<string>>(new Set());
  const [forecastChartExpanded, setForecastChartExpanded] = useState(true);

  const fetchVolumeData = async () => {
    try {
      const params = new URLSearchParams();
      if (daysLiveFilter !== 'all') {
        params.append('daysLive', daysLiveFilter);
      }

      const response = await fetch(`${API_ENDPOINTS.ANALYTICS_VOLUME}?${params}`);
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
      merchantsInWeeklyData.has(forecast.merchant_name) &&
      !excludedMerchants.has(forecast.salesforce_account_id)
    );

    return {
      all: validForecasts.length,
      exceeding: validForecasts.filter(f => getForecastPerformanceTier(f) === 'exceeding').length,
      meeting: validForecasts.filter(f => getForecastPerformanceTier(f) === 'meeting').length,
      below: validForecasts.filter(f => getForecastPerformanceTier(f) === 'below').length,
      significantly_below: validForecasts.filter(f => getForecastPerformanceTier(f) === 'significantly_below').length
    };
  };

  // Get merchant segment counts
  const getMerchantSegmentCounts = () => {
    if (!volumeData) return {};

    const merchantData = getMerchantWeeklyData();
    const counts: { [key: string]: number } = {};

    // Apply current filters except merchant segment
    const filteredData = merchantData.filter(merchant => {
      if (excludedMerchants.has(merchant.salesforce_account_id)) return false;
      if (recordTypeFilter !== 'all') {
        const recordType = merchant.opportunity_record_type === 'New Business' ? 'New Business' : 'Existing';
        if (recordType !== recordTypeFilter) return false;
      }
      return true;
    });

    filteredData.forEach(merchant => {
      const segment = merchant.merchant_segment || 'Unknown';
      counts[segment] = (counts[segment] || 0) + 1;
    });

    return counts;
  };

  // Get record type counts
  const getRecordTypeCounts = () => {
    if (!volumeData) return {};

    const merchantData = getMerchantWeeklyData();
    const counts: { [key: string]: number } = {};

    // Apply current filters except record type
    const filteredData = merchantData.filter(merchant => {
      if (excludedMerchants.has(merchant.salesforce_account_id)) return false;
      if (merchantSegmentFilter !== 'all' && (merchant.merchant_segment || 'Unknown') !== merchantSegmentFilter) return false;
      return true;
    });

    filteredData.forEach(merchant => {
      const recordType = merchant.opportunity_record_type === 'New Business' ? 'New Business' : 'Existing';
      counts[recordType] = (counts[recordType] || 0) + 1;
    });

    return counts;
  };

  // Generate 12-month forecast data for chart visualization
  const generateForecastChartData = () => {
    if (!volumeData) return null;

    const recentWeeks = getRecentWeeks(); // Get the 6 most recent weeks
    const merchantData = getMerchantWeeklyData();

    // Use existing filtered forecast logic to maintain consistency
    const merchantsInWeeklyData = new Set(merchantData.map(m => m.merchant_name));
    const filteredForecasts = volumeData.forecasts.filter(forecast => {
      const hasValidForecast = forecast.forecast_12month_orders !== null && merchantsInWeeklyData.has(forecast.merchant_name);
      if (!hasValidForecast) return false;

      // Apply exclusion filter
      if (excludedMerchants.has(forecast.salesforce_account_id)) return false;

      // Apply merchant filter
      if (merchantFilter && forecast.merchant_name !== merchantFilter) return false;

      // Apply merchant segment filter
      if (merchantSegmentFilter !== 'all' && (forecast.merchant_segment || 'Unknown') !== merchantSegmentFilter) return false;

      // Apply record type filter
      if (recordTypeFilter !== 'all') {
        const recordType = forecast.opportunity_record_type === 'New Business' ? 'New Business' : 'Existing';
        if (recordType !== recordTypeFilter) return false;
      }

      return true;
    });

    // Generate 52 weeks starting from the first week of actual data
    const startWeek = recentWeeks[0]; // First of the 6 recent weeks
    const weeks = [];
    const actualData = [];
    const expectedData = [];
    const forecastData = [];

    for (let i = 0; i < 52; i++) {
      const weekNumber = ((startWeek - 1 + i) % 52) + 1; // Handle year wraparound
      weeks.push(`Week ${weekNumber}`);

      let actualWeekTotal = 0;
      let expectedWeekTotal = 0;
      let forecastWeekTotal = 0;


      // For the first 6 weeks (actuals period)
      if (i < 6) {
        // Get actuals from weekly trends data
        const filteredMerchantData = merchantData.filter(merchant =>
          !excludedMerchants.has(merchant.salesforce_account_id) &&
          (!merchantFilter || merchant.merchant_name === merchantFilter) &&
          (merchantSegmentFilter === 'all' || (merchant.merchant_segment || 'Unknown') === merchantSegmentFilter) &&
          (recordTypeFilter === 'all' || (merchant.opportunity_record_type === 'New Business' ? 'New Business' : 'Existing') === recordTypeFilter)
        );

        filteredMerchantData.forEach(merchant => {
          const weekData = merchant.weeks.get(weekNumber);
          if (weekData) {
            actualWeekTotal += weekData.actual;
            expectedWeekTotal += weekData.expected;
          }
        });

        actualData.push(actualWeekTotal);
        expectedData.push(expectedWeekTotal);
        forecastData.push(null); // No forecast for actual periods
      } else {
        // For forecast period (weeks 7-52), leverage existing forecast logic
        actualData.push(null); // No actuals for future weeks

        filteredForecasts.forEach(forecast => {
          // Use seasonality data to distribute annual volumes across weeks
          const vertical = forecast.benchmark_vertical === 'Swimwear' ? 'Swimwear' : 'Total ex. Swimwear';
          const seasonalityEntry = volumeData.seasonalityData.find(s =>
            s.vertical === vertical && s.iso_week === weekNumber
          );

          if (seasonalityEntry) {
            // Expected weekly volume (original projected)
            const weeklyExpected = (forecast.annual_order_volume * seasonalityEntry.order_percentage) / 100;
            expectedWeekTotal += weeklyExpected;

            // Forecasted weekly volume (updated projection)
            const weeklyForecast = ((forecast.forecast_12month_orders || 0) * seasonalityEntry.order_percentage) / 100;
            forecastWeekTotal += weeklyForecast;
          } else {
            // If no seasonality data found, use average distribution (1/52 = ~1.92%)
            const avgPercentage = 1.92;
            const weeklyExpected = (forecast.annual_order_volume * avgPercentage) / 100;
            expectedWeekTotal += weeklyExpected;

            const weeklyForecast = ((forecast.forecast_12month_orders || 0) * avgPercentage) / 100;
            forecastWeekTotal += weeklyForecast;
          }
        });

        expectedData.push(expectedWeekTotal);
        forecastData.push(forecastWeekTotal);
      }
    }

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: '12-Month Volume Forecast',
        },
        tooltip: {
          callbacks: {
            label: function(context: any): string {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              if (value === null) return '';
              return `${label}: ${Math.round(value).toLocaleString()} orders`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Week'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Orders'
          },
          beginAtZero: true
        }
      },
      elements: {
        point: {
          radius: function(context: any) {
            return context.parsed.y === null ? 0 : context.dataset.pointRadius;
          }
        }
      }
    };

    return {
      data: {
        labels: weeks,
        datasets: [
          {
            label: 'Actual Orders',
            data: actualData,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.3)',
            fill: false,
            tension: 0.1,
            pointRadius: 4,
            pointBackgroundColor: 'rgb(54, 162, 235)',
          },
          {
            label: 'Expected Orders (Original)',
            data: expectedData,
            borderColor: 'rgb(169, 169, 169)',
            backgroundColor: 'rgba(169, 169, 169, 0.1)',
            fill: false,
            tension: 0.1,
            pointRadius: 2,
            pointBackgroundColor: 'rgb(169, 169, 169)',
          },
          {
            label: 'Forecasted Orders (Updated)',
            data: forecastData,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.3)',
            fill: '+1',
            tension: 0.1,
            pointRadius: 3,
            pointBackgroundColor: 'rgb(255, 99, 132)',
            borderDash: [5, 5],
          }
        ]
      },
      options: chartOptions
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
          merchant_segment: trend.merchant_segment,
          opportunity_record_type: trend.opportunity_record_type,
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

  // Exclusion handlers
  const handleExcludeToggle = (merchantId: string) => {
    const newExcluded = new Set(excludedMerchants);
    if (newExcluded.has(merchantId)) {
      newExcluded.delete(merchantId);
    } else {
      newExcluded.add(merchantId);
    }
    setExcludedMerchants(newExcluded);
  };

  const handleSelectAll = () => {
    const allMerchantIds = new Set(getMerchantWeeklyData().map(m => m.salesforce_account_id));
    setExcludedMerchants(allMerchantIds);
  };

  const handleClearAll = () => {
    setExcludedMerchants(new Set());
  };

  // Filter function for merchant data
  const getMerchantWeeklyDataFiltered = () => {
    return getMerchantWeeklyData().filter(merchant => {
      if (excludedMerchants.has(merchant.salesforce_account_id)) return false;

      // Apply merchant segment filter
      if (merchantSegmentFilter !== 'all' && (merchant.merchant_segment || 'Unknown') !== merchantSegmentFilter) return false;

      // Apply record type filter
      if (recordTypeFilter !== 'all') {
        const recordType = merchant.opportunity_record_type === 'New Business' ? 'New Business' : 'Existing';
        if (recordType !== recordTypeFilter) return false;
      }

      return true;
    });
  };

  const merchantData = getMerchantWeeklyData();
  const filteredMerchantData = getMerchantWeeklyDataFiltered();
  const recentWeeks = getRecentWeeks();

  // Calculate filtered summary metrics
  const getFilteredSummaryMetrics = () => {
    if (!volumeData || filteredMerchantData.length === 0) {
      return {
        currentWeekOrders: 0,
        expectedWeekOrders: 0,
        volumeVarianceOrders: 0,
        volumeVariancePercentage: 0,
        avgTrailing4WeekOrders: 0,
        avgExpectedTrailing4WeekOrders: 0,
        trailing4WeekVarianceOrders: 0,
        trailing4WeekVariancePercentage: 0,
        totalForecast12MonthOrders: 0,
        totalOpportunityAnnualVolume: 0,
        forecast12MonthVarianceOrders: 0,
        forecast12MonthVariancePercentage: 0,
        merchantCount: 0
      };
    }

    const currentWeek = volumeData.summary.currentWeek;

    // Calculate current week totals from filtered merchants
    let currentWeekActual = 0;
    let currentWeekExpected = 0;

    filteredMerchantData.forEach(merchant => {
      const weekData = merchant.weeks.get(currentWeek);
      if (weekData) {
        currentWeekActual += weekData.actual;
        currentWeekExpected += weekData.expected;
      }
    });

    // Calculate trailing 4-week averages from filtered merchants
    const recentWeeks = getRecentWeeks();
    const trailing4Weeks = recentWeeks.slice(-4); // Get last 4 weeks

    let trailing4WeekTotalActual = 0;
    let trailing4WeekTotalExpected = 0;
    let weekCount = 0;

    trailing4Weeks.forEach(week => {
      let weekActual = 0;
      let weekExpected = 0;

      filteredMerchantData.forEach(merchant => {
        const weekData = merchant.weeks.get(week);
        if (weekData) {
          weekActual += weekData.actual;
          weekExpected += weekData.expected;
        }
      });

      if (weekActual > 0 || weekExpected > 0) {
        trailing4WeekTotalActual += weekActual;
        trailing4WeekTotalExpected += weekExpected;
        weekCount++;
      }
    });

    const avgTrailing4WeekActual = weekCount > 0 ? trailing4WeekTotalActual / weekCount : 0;
    const avgTrailing4WeekExpected = weekCount > 0 ? trailing4WeekTotalExpected / weekCount : 0;

    // Calculate forecast totals from filtered merchants
    const filteredMerchantAccountIds = new Set(filteredMerchantData.map(m => m.salesforce_account_id));
    const filteredForecasts = volumeData.forecasts.filter(forecast =>
      forecast.forecast_12month_orders !== null &&
      filteredMerchantAccountIds.has(forecast.salesforce_account_id)
    );

    const totalForecast12Month = filteredForecasts.reduce((sum, f) => sum + (f.forecast_12month_orders || 0), 0);
    const totalAnnualVolume = filteredForecasts.reduce((sum, f) => sum + f.annual_order_volume, 0);
    const forecastVariance = totalForecast12Month - totalAnnualVolume;
    const forecastVariancePercentage = totalAnnualVolume > 0 ? (forecastVariance / totalAnnualVolume) * 100 : 0;

    return {
      currentWeekOrders: currentWeekActual,
      expectedWeekOrders: currentWeekExpected,
      volumeVarianceOrders: currentWeekActual - currentWeekExpected,
      volumeVariancePercentage: currentWeekExpected > 0 ? ((currentWeekActual - currentWeekExpected) / currentWeekExpected) * 100 : 0,
      avgTrailing4WeekOrders: avgTrailing4WeekActual,
      avgExpectedTrailing4WeekOrders: avgTrailing4WeekExpected,
      trailing4WeekVarianceOrders: avgTrailing4WeekActual - avgTrailing4WeekExpected,
      trailing4WeekVariancePercentage: avgTrailing4WeekExpected > 0 ? ((avgTrailing4WeekActual - avgTrailing4WeekExpected) / avgTrailing4WeekExpected) * 100 : 0,
      totalForecast12MonthOrders: totalForecast12Month,
      totalOpportunityAnnualVolume: totalAnnualVolume,
      forecast12MonthVarianceOrders: forecastVariance,
      forecast12MonthVariancePercentage: forecastVariancePercentage,
      merchantCount: filteredMerchantData.length
    };
  };

  const filteredSummary = getFilteredSummaryMetrics();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Volume Analysis
      </Typography>

      {/* Filter Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Merchant Segment</InputLabel>
          <Select
            value={merchantSegmentFilter}
            label="Merchant Segment"
            onChange={(e) => setMerchantSegmentFilter(e.target.value)}
          >
            <MenuItem value="all">All Segments</MenuItem>
            {Object.entries(getMerchantSegmentCounts())
              .sort(([a], [b]) => {
                const order = ['Strategic Enterprise', 'Enterprise', 'Mid-Market', 'SMB'];
                const aIndex = order.indexOf(a);
                const bIndex = order.indexOf(b);
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
              })
              .map(([segment, count]) => (
                <MenuItem key={segment} value={segment}>
                  {segment} ({count})
                </MenuItem>
              ))
            }
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Record Type</InputLabel>
          <Select
            value={recordTypeFilter}
            label="Record Type"
            onChange={(e) => setRecordTypeFilter(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            {Object.entries(getRecordTypeCounts()).map(([recordType, count]) => (
              <MenuItem key={recordType} value={recordType}>
                {recordType} ({count})
              </MenuItem>
            ))}
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
                  {Math.round(filteredSummary.currentWeekOrders).toLocaleString()} ({filteredSummary.volumeVariancePercentage >= 0 ? '+' : ''}{filteredSummary.volumeVariancePercentage.toFixed(1)}%)
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  Expected: {Math.round(filteredSummary.expectedWeekOrders).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.25 }}>
                  Merchant Count: {filteredMerchantData.length}
                  {excludedMerchants.size > 0 && (
                    <span style={{ marginLeft: '4px', color: 'rgba(0, 0, 0, 0.6)' }}>
                      ({excludedMerchants.size} excluded)
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
                  Trailing 4-Week Avg
                </Typography>
                <Typography variant="h4">
                  {Math.round(filteredSummary.avgTrailing4WeekOrders).toLocaleString()} ({filteredSummary.trailing4WeekVariancePercentage >= 0 ? '+' : ''}{filteredSummary.trailing4WeekVariancePercentage.toFixed(1)}%)
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  Expected: {Math.round(filteredSummary.avgExpectedTrailing4WeekOrders).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.25 }}>
                  Merchant Count: {filteredMerchantData.length}
                  {excludedMerchants.size > 0 && (
                    <span style={{ marginLeft: '4px', color: 'rgba(0, 0, 0, 0.6)' }}>
                      ({excludedMerchants.size} excluded)
                    </span>
                  )}
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
                  {Math.round(filteredSummary.totalForecast12MonthOrders).toLocaleString()} ({filteredSummary.forecast12MonthVariancePercentage >= 0 ? '+' : ''}{filteredSummary.forecast12MonthVariancePercentage.toFixed(1)}%)
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  Expected: {Math.round(filteredSummary.totalOpportunityAnnualVolume).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.25 }}>
                  Forecasts: {volumeData.forecasts.filter(f => f.forecast_12month_orders !== null && !excludedMerchants.has(f.salesforce_account_id)).length} of {filteredMerchantData.length}
                  {excludedMerchants.size > 0 && (
                    <span style={{ marginLeft: '4px', color: 'rgba(0, 0, 0, 0.6)' }}>
                      ({excludedMerchants.size} excluded)
                    </span>
                  )}
                </Typography>
              </Box>
              <TimelineIcon color="info" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* 12-Month Forecast Chart */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
            12-Month Volume Forecast
          </Typography>
          <IconButton
            onClick={() => setForecastChartExpanded(!forecastChartExpanded)}
            size="small"
          >
            {forecastChartExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={forecastChartExpanded}>
          <Box sx={{ height: 400, width: '100%', maxWidth: 'none' }}>
            {(() => {
              const chartData = generateForecastChartData();
              return chartData ? (
                <Line data={chartData.data} options={chartData.options} />
              ) : (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Typography color="text.secondary">
                    No forecast data available
                  </Typography>
                </Box>
              );
            })()}
          </Box>
        </Collapse>
      </Paper>

      {/* Weekly Trends Table */}
      <Paper sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
            Weekly Order Volume Trends
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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: '60px' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption">Exclude</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Link
                        component="button"
                        variant="caption"
                        onClick={handleSelectAll}
                        sx={{ cursor: 'pointer' }}
                      >
                        All
                      </Link>
                      <Typography variant="caption">|</Typography>
                      <Link
                        component="button"
                        variant="caption"
                        onClick={handleClearAll}
                        sx={{ cursor: 'pointer' }}
                      >
                        None
                      </Link>
                    </Box>
                  </Box>
                </TableCell>
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
                <TableCell padding="checkbox">
                  {/* Empty checkbox column for total row */}
                </TableCell>
                <TableCell component="th" scope="row">
                  <Typography variant="body2" fontWeight="bold" color="text.primary">
                    TOTAL ({filteredMerchantData.length} merchants{excludedMerchants.size > 0 ? `, ${excludedMerchants.size} excluded` : ''})
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="bold" color="text.primary">
                    -
                  </Typography>
                </TableCell>
                {recentWeeks.map(week => {
                  // Calculate totals for this week across filtered merchants only
                  const totalActual = filteredMerchantData.reduce((sum, merchant) => {
                    const weekData = merchant.weeks.get(week);
                    return sum + (weekData ? weekData.actual : 0);
                  }, 0);

                  const totalExpected = filteredMerchantData.reduce((sum, merchant) => {
                    const weekData = merchant.weeks.get(week);
                    return sum + (weekData ? weekData.expected : 0);
                  }, 0);

                  const totalVariance = totalActual - totalExpected;

                  // Calculate weighted average adoption rate for filtered merchants
                  let totalOrdersWithAdoption = 0;
                  let weightedAdoptionSum = 0;

                  filteredMerchantData.forEach(merchant => {
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
              {filteredMerchantData.map((merchant) => (
                <TableRow
                  key={merchant.merchant_name}
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
                      `${merchant.merchant_segment || 'Unknown'} • ${merchant.labels_paid_by === 'Loop' ? 'LPL' : merchant.labels_paid_by === 'Merchant' ? 'MPL' : merchant.labels_paid_by} • ${merchant.opportunity_record_type === 'New Business' ? 'New Business' : 'Existing'}`
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
                const filteredMerchantData = getMerchantWeeklyDataFiltered();
                const merchantsInWeeklyData = new Set(merchantData.map(m => m.merchant_name));
                const filteredForecasts = volumeData.forecasts.filter(forecast => {
                  const hasValidForecast = forecast.forecast_12month_orders !== null && merchantsInWeeklyData.has(forecast.merchant_name);
                  if (!hasValidForecast) return false;

                  // Apply exclusion filter
                  if (excludedMerchants.has(forecast.salesforce_account_id)) {
                    return false;
                  }

                  // Apply merchant filter
                  if (merchantFilter) {
                    return forecast.merchant_name === merchantFilter;
                  }

                  // Apply merchant segment filter
                  if (merchantSegmentFilter !== 'all' && (forecast.merchant_segment || 'Unknown') !== merchantSegmentFilter) return false;

                  // Apply record type filter
                  if (recordTypeFilter !== 'all') {
                    const recordType = forecast.opportunity_record_type === 'New Business' ? 'New Business' : 'Existing';
                    if (recordType !== recordTypeFilter) return false;
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
                          TOTAL ({merchantCount} merchants{excludedMerchants.size > 0 ? `, ${excludedMerchants.size} excluded` : ''})
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
                          `${forecast.merchant_segment || 'Unknown'} • ${forecast.labels_paid_by === 'Loop' ? 'LPL' : forecast.labels_paid_by === 'Merchant' ? 'MPL' : forecast.labels_paid_by} • ${forecast.opportunity_record_type === 'New Business' ? 'New Business' : 'Existing'}`
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