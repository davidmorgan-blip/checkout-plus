import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  TextField,
  Autocomplete,
  Checkbox,
  Link,
  FormControlLabel,
  Switch
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningIcon from '@mui/icons-material/Warning';

interface AcvImpactData {
  accountId: string;
  merchantName: string;
  pricingModel: string;
  labelsPaidBy: string;
  originalNetAcv: number;
  startingAcv: number;
  originalEndingAcv: number;
  projectedEndingAcv: number;
  projectedNetAcv: number;
  acvVariance: number;
  acvVariancePercent: number;
  daysLive: number;
  hasSufficientData: boolean;
}

interface AcvSummaryData {
  totalMerchants: number;
  totalOriginalNetAcv: number;
  totalProjectedNetAcv: number;
  totalAcvVariance: number;
  avgAcvVariance: number;
  varianceCounts: {
    exceeding: number;
    meeting: number;
    below: number;
    significantlyBelow: number;
  };
}

interface AcvImpactsAnalysisProps {
  daysLiveFilter: string;
  onDaysLiveFilterChange: (filter: string) => void;
}

const AcvImpactsAnalysis: React.FC<AcvImpactsAnalysisProps> = ({
  daysLiveFilter,
  onDaysLiveFilterChange
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acvData, setAcvData] = useState<AcvImpactData[]>([]);
  const [summary, setSummary] = useState<AcvSummaryData | null>(null);
  const [search, setSearch] = useState('');
  const [varianceFilter, setVarianceFilter] = useState('all');
  const [pricingModelFilter, setPricingModelFilter] = useState('all');
  const [labelsPaidByFilter, setLabelsPaidByFilter] = useState('all');
  const [excludedMerchants, setExcludedMerchants] = useState<Set<string>>(new Set());
  const [hideInsufficientData, setHideInsufficientData] = useState(false);

  const fetchAcvData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (daysLiveFilter !== 'all') {
        params.append('daysLive', daysLiveFilter);
      }
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`http://localhost:3001/api/net-revenue/acv-impacts?${params}`);
      const data = await response.json();

      if (data.success) {
        setAcvData(data.merchants);
        setSummary(data.summary);
      } else {
        setError(data.error || 'Failed to load ACV impacts data');
      }
    } catch (err) {
      setError('Network error loading ACV impacts data');
      console.error('ACV impacts fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcvData();
  }, [daysLiveFilter, search]);

  const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absValue);

    return value < 0 ? `(${formatted})` : formatted;
  };

  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getVarianceColor = (variancePercent: number): 'success' | 'warning' | 'error' | 'default' => {
    if (variancePercent > 10) return 'success';
    if (variancePercent >= -10) return 'default';
    if (variancePercent >= -30) return 'warning';
    return 'error';
  };

  const getVarianceIcon = (variancePercent: number) => {
    if (variancePercent > 0) return <TrendingUpIcon fontSize="small" />;
    if (variancePercent < 0) return <TrendingDownIcon fontSize="small" />;
    return null;
  };

  const getVarianceTier = (variancePercent: number): string => {
    if (variancePercent > 10) return 'exceeding';
    if (variancePercent >= -10) return 'meeting';
    if (variancePercent >= -30) return 'below';
    return 'significantlyBelow';
  };

  const handleExcludeToggle = (accountId: string) => {
    const newExcluded = new Set(excludedMerchants);
    if (newExcluded.has(accountId)) {
      newExcluded.delete(accountId);
    } else {
      newExcluded.add(accountId);
    }
    setExcludedMerchants(newExcluded);
  };

  const handleSelectAll = () => {
    const allAccountIds = new Set(filteredData.map(item => item.accountId));
    setExcludedMerchants(allAccountIds);
  };

  const handleClearAll = () => {
    setExcludedMerchants(new Set());
  };

  // Calculate adjusted summary based on all active filters
  const adjustedSummary = React.useMemo(() => {
    if (!summary) return null;

    // Apply all filters to get the relevant data subset
    const filteredAndIncludedData = acvData.filter(item => {
      // Check if excluded
      if (excludedMerchants.has(item.accountId)) return false;

      // Apply variance filter
      if (varianceFilter !== 'all' && getVarianceTier(item.acvVariancePercent) !== varianceFilter) {
        return false;
      }

      // Apply pricing model filter
      if (pricingModelFilter !== 'all' && item.pricingModel !== pricingModelFilter) {
        return false;
      }

      // Apply labels paid by filter
      if (labelsPaidByFilter !== 'all' && item.labelsPaidBy !== labelsPaidByFilter) {
        return false;
      }

      return true;
    });

    const totalOriginalNetAcv = filteredAndIncludedData.reduce((sum, item) => sum + item.originalNetAcv, 0);
    const totalProjectedNetAcv = filteredAndIncludedData.reduce((sum, item) => sum + item.projectedNetAcv, 0);
    const totalAcvVariance = totalProjectedNetAcv - totalOriginalNetAcv;
    const avgAcvVariance = filteredAndIncludedData.length > 0 ? totalAcvVariance / filteredAndIncludedData.length : 0;

    const varianceCounts = {
      exceeding: filteredAndIncludedData.filter(m => m.acvVariancePercent > 10).length,
      meeting: filteredAndIncludedData.filter(m => m.acvVariancePercent >= -10 && m.acvVariancePercent <= 10).length,
      below: filteredAndIncludedData.filter(m => m.acvVariancePercent < -10 && m.acvVariancePercent >= -30).length,
      significantlyBelow: filteredAndIncludedData.filter(m => m.acvVariancePercent < -30).length
    };

    return {
      totalMerchants: filteredAndIncludedData.length,
      totalOriginalNetAcv,
      totalProjectedNetAcv,
      totalAcvVariance,
      avgAcvVariance,
      varianceCounts
    };
  }, [acvData, excludedMerchants, varianceFilter, pricingModelFilter, labelsPaidByFilter, summary]);

  const filteredData = acvData.filter(item => {
    // Variance filter
    if (varianceFilter !== 'all' && getVarianceTier(item.acvVariancePercent) !== varianceFilter) {
      return false;
    }

    // Pricing model filter
    if (pricingModelFilter !== 'all' && item.pricingModel !== pricingModelFilter) {
      return false;
    }

    // Labels paid by filter
    if (labelsPaidByFilter !== 'all' && item.labelsPaidBy !== labelsPaidByFilter) {
      return false;
    }

    // Hide insufficient data filter
    if (hideInsufficientData && !item.hasSufficientData) {
      return false;
    }

    return true;
  });

  const merchantOptions = acvData.map(item => item.merchantName).sort();

  // Get unique pricing models and counts
  const pricingModelCounts = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    acvData.forEach(item => {
      counts[item.pricingModel] = (counts[item.pricingModel] || 0) + 1;
    });
    return counts;
  }, [acvData]);

  // Get unique labels paid by and counts
  const labelsPaidByCounts = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    acvData.forEach(item => {
      counts[item.labelsPaidBy] = (counts[item.labelsPaidBy] || 0) + 1;
    });
    return counts;
  }, [acvData]);

  // Calculate stratified statistics by Labels Paid By and Pricing Model
  const stratifiedStats = React.useMemo(() => {
    // Filter data based on current filters (but not excludedMerchants yet)
    const filteredForStats = acvData.filter(item => {
      // Variance filter
      if (varianceFilter !== 'all' && getVarianceTier(item.acvVariancePercent) !== varianceFilter) {
        return false;
      }
      // Pricing model filter
      if (pricingModelFilter !== 'all' && item.pricingModel !== pricingModelFilter) {
        return false;
      }
      // Labels paid by filter
      if (labelsPaidByFilter !== 'all' && item.labelsPaidBy !== labelsPaidByFilter) {
        return false;
      }
      // Hide insufficient data filter
      if (hideInsufficientData && !item.hasSufficientData) {
        return false;
      }
      return true;
    });

    // Further filter to exclude merchants
    const includedData = filteredForStats.filter(item => !excludedMerchants.has(item.accountId));

    // Split data by sufficient/insufficient
    const sufficientData = includedData.filter(item => item.hasSufficientData);
    const insufficientData = includedData.filter(item => !item.hasSufficientData);

    // Group sufficient data by Labels Paid By and Pricing Model
    const sufficientGroups: { [key: string]: AcvImpactData[] } = {};
    sufficientData.forEach(item => {
      const key = `${item.labelsPaidBy}|${item.pricingModel}`;
      if (!sufficientGroups[key]) {
        sufficientGroups[key] = [];
      }
      sufficientGroups[key].push(item);
    });

    // Group insufficient data by Labels Paid By and Pricing Model
    const insufficientGroups: { [key: string]: AcvImpactData[] } = {};
    insufficientData.forEach(item => {
      const key = `${item.labelsPaidBy}|${item.pricingModel}`;
      if (!insufficientGroups[key]) {
        insufficientGroups[key] = [];
      }
      insufficientGroups[key].push(item);
    });

    // Calculate stats for sufficient data groups
    const sufficientGroupStats = Object.entries(sufficientGroups).map(([key, items]) => {
      const [labelsPaidBy, pricingModel] = key.split('|');
      const totalOriginalNetAcv = items.reduce((sum, item) => sum + item.originalNetAcv, 0);
      const totalProjectedNetAcv = items.reduce((sum, item) => sum + item.projectedNetAcv, 0);
      const totalAcvVariance = totalProjectedNetAcv - totalOriginalNetAcv;
      const avgAcvVariance = items.length > 0 ? totalAcvVariance / items.length : 0;

      return {
        labelsPaidBy,
        pricingModel,
        merchantCount: items.length,
        totalOriginalNetAcv,
        totalProjectedNetAcv,
        totalAcvVariance,
        avgAcvVariance,
        variancePercent: totalOriginalNetAcv !== 0 ? (totalAcvVariance / totalOriginalNetAcv) * 100 : 0,
        dataType: 'sufficient' as const
      };
    });

    // Calculate stats for insufficient data groups
    const insufficientGroupStats = Object.entries(insufficientGroups).map(([key, items]) => {
      const [labelsPaidBy, pricingModel] = key.split('|');
      const totalOriginalNetAcv = items.reduce((sum, item) => sum + item.originalNetAcv, 0);
      const totalProjectedNetAcv = items.reduce((sum, item) => sum + item.projectedNetAcv, 0);
      const totalAcvVariance = totalProjectedNetAcv - totalOriginalNetAcv; // Should be 0 for insufficient data
      const avgAcvVariance = items.length > 0 ? totalAcvVariance / items.length : 0;

      return {
        labelsPaidBy,
        pricingModel,
        merchantCount: items.length,
        totalOriginalNetAcv,
        totalProjectedNetAcv,
        totalAcvVariance,
        avgAcvVariance,
        variancePercent: totalOriginalNetAcv !== 0 ? (totalAcvVariance / totalOriginalNetAcv) * 100 : 0,
        dataType: 'insufficient' as const
      };
    });

    // Combine and sort by data type (sufficient first), then by total variance (descending)
    const groupStats = [...sufficientGroupStats, ...insufficientGroupStats].sort((a, b) => {
      if (a.dataType !== b.dataType) {
        return a.dataType === 'sufficient' ? -1 : 1; // sufficient first
      }
      return b.totalAcvVariance - a.totalAcvVariance;
    });

    return {
      groupStats,
      sufficientData,
      insufficientData,
      sufficientTotals: {
        merchantCount: sufficientData.length,
        totalOriginalNetAcv: sufficientData.reduce((sum, item) => sum + item.originalNetAcv, 0),
        totalProjectedNetAcv: sufficientData.reduce((sum, item) => sum + item.projectedNetAcv, 0),
        totalAcvVariance: sufficientData.reduce((sum, item) => sum + item.projectedNetAcv, 0) - sufficientData.reduce((sum, item) => sum + item.originalNetAcv, 0)
      },
      insufficientTotals: {
        merchantCount: insufficientData.length,
        totalOriginalNetAcv: insufficientData.reduce((sum, item) => sum + item.originalNetAcv, 0),
        totalProjectedNetAcv: insufficientData.reduce((sum, item) => sum + item.projectedNetAcv, 0),
        totalAcvVariance: insufficientData.reduce((sum, item) => sum + item.projectedNetAcv, 0) - insufficientData.reduce((sum, item) => sum + item.originalNetAcv, 0)
      }
    };
  }, [acvData, excludedMerchants, varianceFilter, pricingModelFilter, labelsPaidByFilter, hideInsufficientData]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Loading ACV Impacts Analysis...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!summary || acvData.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No ACV impact data available. Merchants need ACV values in opportunities data and 4+ weeks of performance history.
        </Alert>
      </Box>
    );
  }

  const displaySummary = adjustedSummary || summary;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AttachMoneyIcon />
        ACV Impacts Analysis
        <Tooltip title="Shows the impact of projected revenue performance on Net ACV values">
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Typography>

      {/* Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {displaySummary.totalMerchants}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Merchants{excludedMerchants.size > 0 && ` (${excludedMerchants.size} excluded)`}
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {formatCurrency(displaySummary.totalOriginalNetAcv)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Original Net ACV
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {formatCurrency(displaySummary.totalProjectedNetAcv)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Projected Net ACV
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({displaySummary.totalOriginalNetAcv !== 0 ?
                `${((displaySummary.totalProjectedNetAcv / displaySummary.totalOriginalNetAcv) * 100).toFixed(1)}%` :
                'N/A'} of original)
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography
              variant="h6"
              color={displaySummary.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}
            >
              {getVarianceIcon(displaySummary.totalAcvVariance)}
              {formatCurrency(displaySummary.totalAcvVariance)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total ACV Impact
            </Typography>
          </CardContent>
        </Card>

      </Box>

      {/* Performance Distribution Chips */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Net ACV Variance Distribution
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`All (${summary.totalMerchants})`}
            onClick={() => setVarianceFilter('all')}
            color={varianceFilter === 'all' ? 'primary' : 'default'}
            variant={varianceFilter === 'all' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`Exceeding >10% (${summary.varianceCounts.exceeding})`}
            onClick={() => setVarianceFilter('exceeding')}
            color={varianceFilter === 'exceeding' ? 'success' : 'default'}
            variant={varianceFilter === 'exceeding' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`Meeting ±10% (${summary.varianceCounts.meeting})`}
            onClick={() => setVarianceFilter('meeting')}
            color={varianceFilter === 'meeting' ? 'primary' : 'default'}
            variant={varianceFilter === 'meeting' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`Below 10-30% (${summary.varianceCounts.below})`}
            onClick={() => setVarianceFilter('below')}
            color={varianceFilter === 'below' ? 'warning' : 'default'}
            variant={varianceFilter === 'below' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`Significantly Below >30% (${summary.varianceCounts.significantlyBelow})`}
            onClick={() => setVarianceFilter('significantlyBelow')}
            color={varianceFilter === 'significantlyBelow' ? 'error' : 'default'}
            variant={varianceFilter === 'significantlyBelow' ? 'filled' : 'outlined'}
          />
        </Box>
      </Box>

      {/* Pricing Model Filter Chips */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Pricing Model
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`All (${Object.values(pricingModelCounts).reduce((a, b) => a + b, 0)})`}
            onClick={() => setPricingModelFilter('all')}
            color={pricingModelFilter === 'all' ? 'primary' : 'default'}
            variant={pricingModelFilter === 'all' ? 'filled' : 'outlined'}
          />
          {Object.entries(pricingModelCounts).map(([model, count]) => (
            <Chip
              key={model}
              label={`${model} (${count})`}
              onClick={() => setPricingModelFilter(model)}
              color={pricingModelFilter === model ? 'primary' : 'default'}
              variant={pricingModelFilter === model ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      </Box>

      {/* Labels Paid By Filter Chips */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Labels Paid By
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`All (${Object.values(labelsPaidByCounts).reduce((a, b) => a + b, 0)})`}
            onClick={() => setLabelsPaidByFilter('all')}
            color={labelsPaidByFilter === 'all' ? 'primary' : 'default'}
            variant={labelsPaidByFilter === 'all' ? 'filled' : 'outlined'}
          />
          {Object.entries(labelsPaidByCounts).map(([payer, count]) => (
            <Chip
              key={payer}
              label={`${payer === 'Loop' ? 'Loop (LPL)' : 'Merchant (MPL)'} (${count})`}
              onClick={() => setLabelsPaidByFilter(payer)}
              color={labelsPaidByFilter === payer ? 'primary' : 'default'}
              variant={labelsPaidByFilter === payer ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Days Live</InputLabel>
          <Select
            value={daysLiveFilter}
            label="Days Live"
            onChange={(e) => onDaysLiveFilterChange(e.target.value)}
          >
            <MenuItem value="all">All Merchants</MenuItem>
            <MenuItem value="under30">&lt;30 Days Live</MenuItem>
            <MenuItem value="30">30+ Days Live</MenuItem>
            <MenuItem value="60">60+ Days Live</MenuItem>
            <MenuItem value="90">90+ Days Live</MenuItem>
          </Select>
        </FormControl>

        <Autocomplete
          sx={{ minWidth: 300 }}
          options={merchantOptions}
          value={search}
          onChange={(_, newValue) => setSearch(newValue || '')}
          renderInput={(params) => (
            <TextField {...params} label="Search Merchants" variant="outlined" />
          )}
          freeSolo
        />

        <FormControlLabel
          control={
            <Switch
              checked={hideInsufficientData}
              onChange={(e) => setHideInsufficientData(e.target.checked)}
              color="primary"
            />
          }
          label="Hide insufficient data merchants"
          sx={{
            whiteSpace: 'nowrap',
            '& .MuiFormControlLabel-label': { fontSize: '0.875rem' }
          }}
        />
      </Box>

      {/* Stratified ACV Variance Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ACV Variance Summary by Pricing Model & Labels Paid By
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Subtotals showing ACV variance distribution across different merchant segments
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Labels Paid By</strong></TableCell>
                  <TableCell><strong>Pricing Model</strong></TableCell>
                  <TableCell align="right"><strong>Merchants</strong></TableCell>
                  <TableCell align="right"><strong>Original Net ACV</strong></TableCell>
                  <TableCell align="right"><strong>Projected Net ACV</strong></TableCell>
                  <TableCell align="right"><strong>ACV Variance</strong></TableCell>
                  <TableCell align="right"><strong>Variance %</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Sufficient Data Groups */}
                {stratifiedStats.groupStats.filter(group => group.dataType === 'sufficient').length > 0 && (
                  <>
                    <TableRow sx={{ backgroundColor: 'success.light', '& td': { fontWeight: 'bold', color: 'success.dark' } }}>
                      <TableCell colSpan={7} align="left">
                        <Typography variant="subtitle2" fontWeight="bold">
                          SUFFICIENT DATA MERCHANTS (Updated Projections)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {stratifiedStats.groupStats
                      .filter(group => group.dataType === 'sufficient')
                      .map((group, index) => (
                        <TableRow
                          key={`${group.labelsPaidBy}-${group.pricingModel}-sufficient`}
                          sx={{
                            backgroundColor: index % 2 === 0 ? 'action.hover' : 'inherit',
                            '&:hover': { backgroundColor: 'action.selected' }
                          }}
                        >
                          <TableCell>{group.labelsPaidBy}</TableCell>
                          <TableCell>
                            <Chip
                              label={group.pricingModel}
                              size="small"
                              color={group.pricingModel === 'Flat' ? 'info' :
                                     group.pricingModel === 'Rev Share' ? 'primary' : 'secondary'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">{group.merchantCount}</TableCell>
                          <TableCell align="right">{formatCurrency(group.totalOriginalNetAcv)}</TableCell>
                          <TableCell align="right">{formatCurrency(group.totalProjectedNetAcv)}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                              {group.totalAcvVariance >= 0 ? (
                                <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                              ) : (
                                <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                              )}
                              <Typography
                                variant="body2"
                                color={group.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                                fontWeight="medium"
                              >
                                {formatCurrency(group.totalAcvVariance)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={group.variancePercent >= 0 ? 'success.main' : 'error.main'}
                              fontWeight="medium"
                            >
                              {group.variancePercent >= 0 ? '+' : ''}{group.variancePercent.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    {/* Sufficient Data Subtotal */}
                    <TableRow sx={{ backgroundColor: 'success.light', '& td': { fontWeight: 'bold' } }}>
                      <TableCell colSpan={2}><strong>SUFFICIENT DATA SUBTOTAL</strong></TableCell>
                      <TableCell align="right">{stratifiedStats.sufficientTotals.merchantCount}</TableCell>
                      <TableCell align="right">{formatCurrency(stratifiedStats.sufficientTotals.totalOriginalNetAcv)}</TableCell>
                      <TableCell align="right">{formatCurrency(stratifiedStats.sufficientTotals.totalProjectedNetAcv)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          {stratifiedStats.sufficientTotals.totalAcvVariance >= 0 ? (
                            <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                          ) : (
                            <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                          )}
                          <Typography
                            variant="body2"
                            color={stratifiedStats.sufficientTotals.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                            fontWeight="bold"
                          >
                            {formatCurrency(stratifiedStats.sufficientTotals.totalAcvVariance)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={stratifiedStats.sufficientTotals.totalOriginalNetAcv !== 0 &&
                                 (stratifiedStats.sufficientTotals.totalAcvVariance / stratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100 >= 0 ?
                                 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {stratifiedStats.sufficientTotals.totalOriginalNetAcv !== 0 ?
                            `${((stratifiedStats.sufficientTotals.totalAcvVariance / stratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100) >= 0 ? '+' : ''}${(((stratifiedStats.sufficientTotals.totalAcvVariance / stratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
                            'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </>
                )}

                {/* Insufficient Data Groups */}
                {stratifiedStats.groupStats.filter(group => group.dataType === 'insufficient').length > 0 && (
                  <>
                    <TableRow sx={{ backgroundColor: 'grey.300', '& td': { fontWeight: 'bold', color: 'grey.800' } }}>
                      <TableCell colSpan={7} align="left">
                        <Typography variant="subtitle2" fontWeight="bold">
                          INSUFFICIENT DATA MERCHANTS (Original Projections)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {stratifiedStats.groupStats
                      .filter(group => group.dataType === 'insufficient')
                      .map((group, index) => (
                        <TableRow
                          key={`${group.labelsPaidBy}-${group.pricingModel}-insufficient`}
                          sx={{
                            backgroundColor: index % 2 === 0 ? 'action.hover' : 'inherit',
                            '&:hover': { backgroundColor: 'action.selected' }
                          }}
                        >
                          <TableCell>{group.labelsPaidBy}</TableCell>
                          <TableCell>
                            <Chip
                              label={group.pricingModel}
                              size="small"
                              color={group.pricingModel === 'Flat' ? 'info' :
                                     group.pricingModel === 'Rev Share' ? 'primary' : 'secondary'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">{group.merchantCount}</TableCell>
                          <TableCell align="right">{formatCurrency(group.totalOriginalNetAcv)}</TableCell>
                          <TableCell align="right">{formatCurrency(group.totalProjectedNetAcv)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary">
                              {formatCurrency(group.totalAcvVariance)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary">
                              {group.variancePercent.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    {/* Insufficient Data Subtotal */}
                    <TableRow sx={{ backgroundColor: 'grey.300', '& td': { fontWeight: 'bold', color: 'grey.800' } }}>
                      <TableCell colSpan={2}><strong>INSUFFICIENT DATA SUBTOTAL</strong></TableCell>
                      <TableCell align="right">{stratifiedStats.insufficientTotals.merchantCount}</TableCell>
                      <TableCell align="right">{formatCurrency(stratifiedStats.insufficientTotals.totalOriginalNetAcv)}</TableCell>
                      <TableCell align="right">{formatCurrency(stratifiedStats.insufficientTotals.totalProjectedNetAcv)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">
                          {formatCurrency(stratifiedStats.insufficientTotals.totalAcvVariance)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">
                          {stratifiedStats.insufficientTotals.totalOriginalNetAcv !== 0 ?
                            `${(((stratifiedStats.insufficientTotals.totalAcvVariance / stratifiedStats.insufficientTotals.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
                            'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </>
                )}

                {/* Grand Total Row */}
                {(stratifiedStats.sufficientTotals.merchantCount > 0 || stratifiedStats.insufficientTotals.merchantCount > 0) && displaySummary && (
                  <TableRow sx={{ backgroundColor: 'primary.light', '& td': { fontWeight: 'bold' } }}>
                    <TableCell colSpan={2}><strong>GRAND TOTAL</strong></TableCell>
                    <TableCell align="right">{displaySummary.totalMerchants}</TableCell>
                    <TableCell align="right">{formatCurrency(displaySummary.totalOriginalNetAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(displaySummary.totalProjectedNetAcv)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {displaySummary.totalAcvVariance >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                        <Typography
                          variant="body2"
                          color={displaySummary.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {formatCurrency(displaySummary.totalAcvVariance)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={displaySummary.totalOriginalNetAcv !== 0 &&
                               (displaySummary.totalAcvVariance / displaySummary.totalOriginalNetAcv) * 100 >= 0 ?
                               'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {displaySummary.totalOriginalNetAcv !== 0 ?
                          `${((displaySummary.totalAcvVariance / displaySummary.totalOriginalNetAcv) * 100) >= 0 ? '+' : ''}${(((displaySummary.totalAcvVariance / displaySummary.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
                          'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {/* No Data Row */}
                {stratifiedStats.groupStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available for current filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Merchant ACV Impacts ({filteredData.length} merchants)
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
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
                  <TableCell align="right">Starting ACV</TableCell>
                  <TableCell align="right">Original Ending ACV</TableCell>
                  <TableCell align="right">Projected Ending ACV</TableCell>
                  <TableCell align="right">Original Net ACV</TableCell>
                  <TableCell align="right">Projected Net ACV</TableCell>
                  <TableCell align="right">ACV Variance</TableCell>
                  <TableCell align="center">Variance %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((row) => (
                  <TableRow key={row.accountId} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={excludedMerchants.has(row.accountId)}
                        onChange={() => handleExcludeToggle(row.accountId)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {row.merchantName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.pricingModel} • {row.labelsPaidBy === 'Loop' ? 'LPL' : 'MPL'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">{row.daysLive}</TableCell>
                    <TableCell align="right">{formatCurrency(row.startingAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.originalEndingAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.projectedEndingAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.originalNetAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.projectedNetAcv)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {getVarianceIcon(row.acvVariance)}
                        {formatCurrency(row.acvVariance)}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Chip
                          label={formatPercent(row.acvVariancePercent)}
                          color={getVarianceColor(row.acvVariancePercent)}
                          size="small"
                          icon={getVarianceIcon(row.acvVariancePercent) || undefined}
                        />
                        {!row.hasSufficientData && Math.abs(row.acvVariancePercent) < 0.1 && (
                          <Tooltip title="Variance is 0% due to insufficient performance data - using original projected values">
                            <WarningIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AcvImpactsAnalysis;