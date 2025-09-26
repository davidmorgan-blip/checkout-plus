import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  TextField,
  Autocomplete,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';

interface PerformanceMetrics {
  totalMerchants: number;
  activeMerchants: number;
  avgAdoptionRate: number;
  avgEligibilityRate: number;
  avgAttachRate: number;
  weekOverWeekChange: number;
  trailing4WeekAdoptionRate: number;
  trailing4WeekEligibilityRate: number;
  trailing4WeekAttachRate: number;
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

export default function PerformanceOverview() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [merchantData, setMerchantData] = useState<MerchantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysLiveFilter, setDaysLiveFilter] = useState('all');
  const [performanceTierFilter, setPerformanceTierFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [merchantFilter, setMerchantFilter] = useState<string | null>(null);

  const fetchOverviewData = async () => {
    try {
      const params = new URLSearchParams();
      if (daysLiveFilter !== 'all') {
        params.append('daysLive', daysLiveFilter);
      }

      const response = await fetch(`http://localhost:3001/api/analytics/overview?${params}`);
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

      const response = await fetch(`http://localhost:3001/api/analytics/merchants?${params}`);
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
      await Promise.all([fetchOverviewData(), fetchMerchantData()]);
      setLoading(false);
    };

    fetchData();
  }, [daysLiveFilter, performanceTierFilter, merchantFilter]);

  // Get unique merchant names for autocomplete
  const getMerchantOptions = () => {
    if (!merchantData) return [];
    const merchantNames = merchantData.map(m => m.merchant_name).filter(Boolean);
    return Array.from(new Set(merchantNames)).sort();
  };

  // Since filtering is now done server-side, just return the merchant data
  const getFilteredMerchantData = () => {
    return merchantData || [];
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Performance Overview
      </Typography>

      {/* Filter Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Days Live Filter</InputLabel>
          <Select
            value={daysLiveFilter}
            label="Days Live Filter"
            onChange={(e) => handleDaysLiveFilterChange(e.target.value)}
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
          onChange={(event, newValue) => handleMerchantFilterChange(newValue)}
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
                  Total Merchants
                </Typography>
                <Typography variant="h4">
                  {overviewData.metrics.totalMerchants}
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
                  {(overviewData.metrics.avgAdoptionRate * 100).toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  T4Wk: {(overviewData.metrics.trailing4WeekAdoptionRate * 100).toFixed(1)}%
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
                  {(overviewData.metrics.avgEligibilityRate * 100).toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                  T4Wk: {(overviewData.metrics.trailing4WeekEligibilityRate * 100).toFixed(1)}%
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
            label={`All: ${overviewData.metrics.totalMerchants}`}
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
        <Typography variant="h6" gutterBottom>
          Merchant Performance {performanceTierFilter !== 'all' ? `(${getPerformanceTierLabel(performanceTierFilter)})` : ''}
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
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