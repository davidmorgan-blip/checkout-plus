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
  Button,
  Tooltip,
  IconButton,
  FormControlLabel,
  Checkbox,
  Switch,
  TextField,
  Autocomplete,
  Link
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DownloadIcon from '@mui/icons-material/Download';
import WarningIcon from '@mui/icons-material/Warning';
import LaunchIcon from '@mui/icons-material/Launch';

interface NetRevenueData {
  accountId: string;
  opportunityId: string;
  accountName: string;
  closeDate: string;
  opportunityRecordType: string;
  pricingModel: string;
  labelsPaidBy: string;
  expectedAnnualRevenue: number;
  actualAnnualRevenue: number;
  revenueVariance: number;
  revenueVariancePercent: number;
  adoptionRateExpected: number;
  adoptionRateActual: number;
  adoptionVariance: number;
  volumeExpected: number;
  volumeActual: number;
  volumeVariance: number;
  volumeContribution: number;
  adjustmentNeeded: boolean;
  adjustmentStatus: string;
  adoptionContribution: number;
  interactionContribution: number;
  implementationStatus: string;
  daysLive: number;
  hasSufficientData: boolean;
}

interface NetRevenueAnalysisProps {}

// Helper function to render merchant name with SFDC links
const renderMerchantWithLinks = (merchantName: string, accountId: string, opportunityId: string, pricingInfo?: string) => (
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
    {pricingInfo && (
      <Typography variant="caption" color="textSecondary">
        {pricingInfo}
      </Typography>
    )}
  </Box>
);

export default function NetRevenueAnalysis({}: NetRevenueAnalysisProps) {
  const [data, setData] = useState<NetRevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysLiveFilter, setDaysLiveFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [necessaryChangesOnly, setNecessaryChangesOnly] = useState(true);
  const [adjustmentStatusFilter, setAdjustmentStatusFilter] = useState('all');
  const [revenueVarianceFilter, setRevenueVarianceFilter] = useState('all');
  const [merchantFilter, setMerchantFilter] = useState<string | null>(null);
  const [hideInsufficientData, setHideInsufficientData] = useState(true);
  const [excludedMerchants, setExcludedMerchants] = useState<Set<string>>(new Set());

  // Filter data based on adjustment status, revenue variance, and merchant name
  const getFilteredData = () => {
    if (!data) return [];

    let filtered = data;

    // Apply adjustment status filter
    if (adjustmentStatusFilter !== 'all') {
      if (adjustmentStatusFilter === 'pending') {
        filtered = filtered.filter(d => d.adjustmentStatus.startsWith('Pending'));
      } else {
        filtered = filtered.filter(d => d.adjustmentStatus === adjustmentStatusFilter);
      }
    }

    // Apply revenue variance filter
    if (revenueVarianceFilter !== 'all') {
      filtered = filtered.filter(d => {
        const tier = getRevenueVarianceTier(d);
        return tier === revenueVarianceFilter;
      });
    }

    // Apply merchant filter
    if (merchantFilter) {
      filtered = filtered.filter(d => d.accountName === merchantFilter);
    }

    // Apply hide insufficient data filter
    if (hideInsufficientData) {
      filtered = filtered.filter(d => d.hasSufficientData);
    }

    return filtered;
  };

  // Get filtered data excluding merchants (for display in table)
  const getFilteredAndIncludedData = () => {
    return getFilteredData().filter(d => !excludedMerchants.has(d.accountId));
  };

  // Get unique merchant names for autocomplete
  const getMerchantOptions = () => {
    if (!data) return [];
    const merchantNames = data.map(d => d.accountName).filter(Boolean);
    return Array.from(new Set(merchantNames)).sort();
  };

  // Calculate revenue variance performance tier
  const getRevenueVarianceTier = (merchant: NetRevenueData): string => {
    if (!merchant.revenueVariancePercent) return 'unknown';
    const variancePercent = merchant.revenueVariancePercent;
    if (variancePercent > 10) return 'exceeding';
    if (variancePercent >= -10) return 'meeting';
    if (variancePercent >= -20) return 'below';
    return 'significantly_below';
  };

  // Calculate counts for each status (only apply base filters, not status/variance filters, but include exclusions)
  const getStatusCounts = () => {
    if (!data) return { all: 0, adjusted: 0, pending: 0, notAdjusted: 0 };

    let filtered = data;

    // Apply merchant filter
    if (merchantFilter) {
      filtered = filtered.filter(d => d.accountName === merchantFilter);
    }

    // Apply hide insufficient data filter
    if (hideInsufficientData) {
      filtered = filtered.filter(d => d.hasSufficientData);
    }

    // Exclude merchants that are excluded
    filtered = filtered.filter(d => !excludedMerchants.has(d.accountId));

    return {
      all: filtered.length,
      adjusted: filtered.filter(d => d.adjustmentStatus === 'Adjusted').length,
      pending: filtered.filter(d => d.adjustmentStatus.startsWith('Pending')).length,
      notAdjusted: filtered.filter(d => d.adjustmentStatus === 'Not Adjusted').length
    };
  };

  // Calculate counts for each revenue variance tier (only apply base filters, not status/variance filters, but include exclusions)
  const getRevenueVarianceCounts = () => {
    if (!data) return { all: 0, exceeding: 0, meeting: 0, below: 0, significantly_below: 0 };

    let filtered = data;

    // Apply merchant filter
    if (merchantFilter) {
      filtered = filtered.filter(d => d.accountName === merchantFilter);
    }

    // Apply hide insufficient data filter
    if (hideInsufficientData) {
      filtered = filtered.filter(d => d.hasSufficientData);
    }

    // Exclude merchants that are excluded
    filtered = filtered.filter(d => !excludedMerchants.has(d.accountId));

    return {
      all: filtered.length,
      exceeding: filtered.filter(d => getRevenueVarianceTier(d) === 'exceeding').length,
      meeting: filtered.filter(d => getRevenueVarianceTier(d) === 'meeting').length,
      below: filtered.filter(d => getRevenueVarianceTier(d) === 'below').length,
      significantly_below: filtered.filter(d => getRevenueVarianceTier(d) === 'significantly_below').length
    };
  };

  const fetchNetRevenueData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/net-revenue/net-revenue?daysLive=${daysLiveFilter}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to load net revenue data');
      }
    } catch (error) {
      setError('Network error while loading net revenue data');
      console.error('Net revenue data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetRevenueData();
  }, [daysLiveFilter]);

  const handleExport = async () => {
    try {
      setExporting(true);

      // Create URL with parameters including excluded merchants
      const params = new URLSearchParams({
        daysLive: daysLiveFilter,
        necessaryChangesOnly: necessaryChangesOnly.toString()
      });

      // Add excluded merchants as multiple parameters
      excludedMerchants.forEach(merchantId => {
        params.append('excludedMerchants', merchantId);
      });

      const response = await fetch(`http://localhost:3001/api/net-revenue/net-revenue/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'net-revenue-analysis.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    } else {
      return `$${value.toFixed(0)}`;
    }
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatVolume = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    } else {
      return value.toFixed(0);
    }
  };

  const formatRevenueVariance = (variance: number, variancePercent: number) => {
    const formattedVariance = variance >= 0
      ? formatCurrency(variance)
      : `(${formatCurrency(Math.abs(variance))})`;
    const formattedPercent = formatPercentage(variancePercent);
    return `${formattedVariance} ${formattedPercent}`;
  };

  const formatPricingInfo = (pricingModel: string, labelsPaidBy: string) => {
    const labelsAbbreviation = labelsPaidBy === 'Loop' ? 'LPL' : labelsPaidBy === 'Merchant' ? 'MPL' : '';
    return labelsAbbreviation ? `${pricingModel} • ${labelsAbbreviation}` : pricingModel;
  };

  const getVarianceColor = (variance: number) => {
    if (variance >= 10) return 'success';
    if (variance >= -10) return 'warning';
    return 'error';
  };

  const getVarianceIcon = (variance: number) => {
    return variance >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />;
  };

  const calculateSummaryStats = () => {
    const filteredData = getFilteredAndIncludedData();
    if (!filteredData || !Array.isArray(filteredData) || filteredData.length === 0) {
      return {
        totalExpected: 0,
        totalActual: 0,
        totalVariance: 0,
        avgVariance: 0,
        avgVarianceSimple: 0,
        avgVarianceWeighted: 0,
        totalVolumeContribution: 0,
        totalAdoptionContribution: 0,
        totalInteractionContribution: 0,
        totalVolumeExpected: 0,
        totalVolumeActual: 0,
        avgAdoptionExpected: 0,
        avgAdoptionActual: 0
      };
    }

    const totalExpected = filteredData.reduce((sum, row) => sum + (row.expectedAnnualRevenue || 0), 0);
    const totalActual = filteredData.reduce((sum, row) => sum + (row.actualAnnualRevenue || 0), 0);
    const totalVariance = totalActual - totalExpected;
    // Calculate both simple average and revenue-weighted average variance
    const avgVarianceSimple = filteredData.reduce((sum, row) => sum + (row.revenueVariancePercent || 0), 0) / filteredData.length;
    const avgVarianceWeighted = totalExpected !== 0 ? (totalVariance / totalExpected) * 100 : 0;

    const totalVolumeContribution = filteredData.reduce((sum, row) => sum + (row.volumeContribution || 0), 0);
    const totalAdoptionContribution = filteredData.reduce((sum, row) => sum + (row.adoptionContribution || 0), 0);
    const totalInteractionContribution = filteredData.reduce((sum, row) => sum + (row.interactionContribution || 0), 0);

    const totalVolumeExpected = filteredData.reduce((sum, row) => sum + (row.volumeExpected || 0), 0);
    const totalVolumeActual = filteredData.reduce((sum, row) => sum + (row.volumeActual || 0), 0);

    const avgAdoptionExpected = filteredData.reduce((sum, row) => sum + (row.adoptionRateExpected || 0), 0) / filteredData.length;
    const avgAdoptionActual = filteredData.reduce((sum, row) => sum + (row.adoptionRateActual || 0), 0) / filteredData.length;

    return {
      totalExpected,
      totalActual,
      totalVariance,
      avgVariance: avgVarianceSimple,
      avgVarianceSimple,
      avgVarianceWeighted,
      totalVolumeContribution,
      totalAdoptionContribution,
      totalInteractionContribution,
      totalVolumeExpected,
      totalVolumeActual,
      avgAdoptionExpected,
      avgAdoptionActual
    };
  };

  // Exclusion handlers
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
    const allAccountIds = new Set(getFilteredData().map(item => item.accountId));
    setExcludedMerchants(allAccountIds);
  };

  const handleClearAll = () => {
    setExcludedMerchants(new Set());
  };

  const summaryStats = calculateSummaryStats();

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading net revenue analysis...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Net Revenue Analysis
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Expected vs. actual net revenue based on trailing 4-week performance
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Days Live Filter</InputLabel>
              <Select
                value={daysLiveFilter}
                onChange={(e) => setDaysLiveFilter(e.target.value)}
                label="Days Live Filter"
              >
                <MenuItem value="all">All Merchants</MenuItem>
                <MenuItem value="under30">&lt;30 Days Live</MenuItem>
                <MenuItem value="30-60">30-60 Days Live</MenuItem>
                <MenuItem value="30">30+ Days Live</MenuItem>
                <MenuItem value="60">60+ Days Live</MenuItem>
                <MenuItem value="90">90+ Days Live</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={hideInsufficientData}
                  onChange={(e) => setHideInsufficientData(e.target.checked)}
                  size="small"
                />
              }
              label="Hide insufficient data merchants"
              sx={{ ml: 0 }}
            />
          </Box>
          <Autocomplete
            sx={{ minWidth: 250 }}
            options={getMerchantOptions()}
            value={merchantFilter}
            onChange={(event, newValue) => setMerchantFilter(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filter by Merchant"
                placeholder="Search merchants..."
                size="medium"
              />
            )}
            clearOnBlur={false}
            clearOnEscape
            freeSolo={false}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={exporting || loading}
              sx={{ minWidth: 120 }}
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
            <FormControlLabel
              control={
                <Checkbox
                  checked={necessaryChangesOnly}
                  onChange={(e) => setNecessaryChangesOnly(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Tooltip title="Export only merchants with -20% or worse volume forecast OR -1000bps or worse adoption rate variance">
                  <Typography variant="caption" sx={{ cursor: 'help' }}>
                    Export adjustments only
                  </Typography>
                </Tooltip>
              }
              sx={{ ml: 0 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Expected Annual Revenue
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summaryStats.totalExpected)}
                </Typography>
                {excludedMerchants.size > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    ({excludedMerchants.size} excluded)
                  </Typography>
                )}
              </Box>
              <AttachMoneyIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Projected Annual Revenue
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(summaryStats.totalActual)}
                </Typography>
                {excludedMerchants.size > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    ({excludedMerchants.size} excluded)
                  </Typography>
                )}
              </Box>
              <AttachMoneyIcon color="secondary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Revenue Variance
                </Typography>
                <Typography variant="h5" color={summaryStats.totalVariance >= 0 ? 'success.main' : 'error.main'}>
                  {summaryStats.totalVariance >= 0 ? formatCurrency(summaryStats.totalVariance) : `(${formatCurrency(Math.abs(summaryStats.totalVariance))})`}
                </Typography>
                {excludedMerchants.size > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    ({excludedMerchants.size} excluded)
                  </Typography>
                )}
              </Box>
              {getVarianceIcon(summaryStats.totalVariance)}
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Average Variance %
                </Typography>
                <Typography variant="h5" color={summaryStats.avgVariance >= 0 ? 'success.main' : 'error.main'}>
                  {summaryStats.avgVariance >= 0 ? formatPercentage(summaryStats.avgVariance) : `(${Math.abs(summaryStats.avgVariance).toFixed(1)}%)`}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Rev-weighted: {(summaryStats.avgVarianceWeighted || 0) >= 0 ? `+${(summaryStats.avgVarianceWeighted || 0).toFixed(1)}%` : `(${Math.abs(summaryStats.avgVarianceWeighted || 0).toFixed(1)}%)`}
                </Typography>
                {excludedMerchants.size > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    ({excludedMerchants.size} excluded)
                  </Typography>
                )}
              </Box>
              {getVarianceIcon(summaryStats.avgVariance)}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Merchant Revenue Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Merchant Revenue Performance
            </Typography>
            <Tooltip title="Revenue projections based on trailing 4-week adoption rate and volume performance">
              <IconButton size="small" sx={{ ml: 1 }}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Filter Chips - Side by Side Layout */}
          <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
            {/* Adjustment Status Filter Chips */}
            <Paper sx={{ p: 3, flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Adjustment Status Filter
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`All: ${getStatusCounts().all}`}
                  color="primary"
                  variant={adjustmentStatusFilter === 'all' ? 'filled' : 'outlined'}
                  onClick={() => setAdjustmentStatusFilter('all')}
                  clickable
                />
                <Chip
                  label={`Adjusted: ${getStatusCounts().adjusted}`}
                  color="error"
                  variant={adjustmentStatusFilter === 'Adjusted' ? 'filled' : 'outlined'}
                  onClick={() => setAdjustmentStatusFilter('Adjusted')}
                  clickable
                />
                <Chip
                  label={`Not Adjusted: ${getStatusCounts().notAdjusted}`}
                  color="success"
                  variant={adjustmentStatusFilter === 'Not Adjusted' ? 'filled' : 'outlined'}
                  onClick={() => setAdjustmentStatusFilter('Not Adjusted')}
                  clickable
                />
                <Chip
                  label={`Pending: ${getStatusCounts().pending}`}
                  color="warning"
                  variant={adjustmentStatusFilter === 'pending' ? 'filled' : 'outlined'}
                  onClick={() => setAdjustmentStatusFilter('pending')}
                  clickable
                />
              </Box>
            </Paper>

            {/* Revenue Variance Filter Chips */}
            <Paper sx={{ p: 3, flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Revenue Variance Filter
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`All: ${getRevenueVarianceCounts().all}`}
                  color="primary"
                  variant={revenueVarianceFilter === 'all' ? 'filled' : 'outlined'}
                  onClick={() => setRevenueVarianceFilter('all')}
                  clickable
                />
                <Chip
                  label={`Exceeding: ${getRevenueVarianceCounts().exceeding}`}
                  color="success"
                  variant={revenueVarianceFilter === 'exceeding' ? 'filled' : 'outlined'}
                  onClick={() => setRevenueVarianceFilter('exceeding')}
                  clickable
                />
                <Chip
                  label={`Meeting: ${getRevenueVarianceCounts().meeting}`}
                  color="info"
                  variant={revenueVarianceFilter === 'meeting' ? 'filled' : 'outlined'}
                  onClick={() => setRevenueVarianceFilter('meeting')}
                  clickable
                />
                <Chip
                  label={`Below: ${getRevenueVarianceCounts().below}`}
                  color="warning"
                  variant={revenueVarianceFilter === 'below' ? 'filled' : 'outlined'}
                  onClick={() => setRevenueVarianceFilter('below')}
                  clickable
                />
                <Chip
                  label={`Significantly Below: ${getRevenueVarianceCounts().significantly_below}`}
                  color="error"
                  variant={revenueVarianceFilter === 'significantly_below' ? 'filled' : 'outlined'}
                  onClick={() => setRevenueVarianceFilter('significantly_below')}
                  clickable
                />
              </Box>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Exceeding: &gt;10% • Meeting: ±10% • Below: -10% to -20% • Significantly Below: &gt;-20%
              </Typography>
            </Paper>
          </Box>

          <TableContainer component={Paper}>
            <Table>
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
                  <TableCell align="center">Days Live</TableCell>
                  <TableCell align="right">Expected Annual Revenue</TableCell>
                  <TableCell align="right">Projected Annual Revenue</TableCell>
                  <TableCell align="right">Revenue Variance</TableCell>
                  <TableCell align="right">Variance Breakdown</TableCell>
                  <TableCell align="right">Adoption Rate</TableCell>
                  <TableCell align="right">Volume Performance</TableCell>
                  <TableCell align="center">Adjustment Needed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Total Row */}
                {data && data.length > 0 && (
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell padding="checkbox">
                      {/* Empty cell for alignment with exclude column */}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        TOTAL ({getFilteredAndIncludedData().length} merchants{excludedMerchants.size > 0 && `, ${excludedMerchants.size} excluded`})
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Aggregated Performance
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight="medium">
                        All Active
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(summaryStats.totalExpected)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(summaryStats.totalActual)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={summaryStats.totalVariance >= 0 ? 'success.main' : 'error.main'}
                      >
                        {summaryStats.totalVariance >= 0 ? formatCurrency(summaryStats.totalVariance) : `(${formatCurrency(Math.abs(summaryStats.totalVariance))})`}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'medium' }}>
                          <span style={{ color: summaryStats.totalVolumeContribution >= 0 ? '#2e7d32' : '#d32f2f' }}>
                            Vol: {formatCurrency(summaryStats.totalVolumeContribution)}
                          </span>
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 'medium' }}>
                          <span style={{ color: summaryStats.totalAdoptionContribution >= 0 ? '#2e7d32' : '#d32f2f' }}>
                            Adopt: {formatCurrency(summaryStats.totalAdoptionContribution)}
                          </span>
                        </Typography>
                        {Math.abs(summaryStats.totalInteractionContribution) > 1000 && (
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 'medium' }}>
                            Mix: {formatCurrency(summaryStats.totalInteractionContribution)}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {summaryStats.avgAdoptionActual.toFixed(1)}% (vs {summaryStats.avgAdoptionExpected.toFixed(1)}%)
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatVolume(summaryStats.totalVolumeActual)} (vs {formatVolume(summaryStats.totalVolumeExpected)})
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight="medium">
                        —
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {Array.isArray(data) ? getFilteredData()
                  .sort((a, b) => Math.abs((b.revenueVariance || 0)) - Math.abs((a.revenueVariance || 0)))
                  .map((row) => (
                    <TableRow
                      key={row.accountId}
                      hover
                      sx={{
                        backgroundColor: excludedMerchants.has(row.accountId) ? 'rgba(255, 193, 7, 0.1)' : 'inherit'
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={excludedMerchants.has(row.accountId)}
                          onChange={() => handleExcludeToggle(row.accountId)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {renderMerchantWithLinks(
                            row.accountName || 'N/A',
                            row.accountId,
                            row.opportunityId,
                            formatPricingInfo(row.pricingModel || 'Unknown', row.labelsPaidBy || '')
                          )}
                          {(row.adoptionRateActual < 1) && (
                            <Tooltip title="Very low adoption rate (<1%) - may indicate systemic issues requiring investigation">
                              <WarningIcon color="warning" sx={{ fontSize: 20 }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${Math.round(row.daysLive || 0)} days`}
                          size="small"
                          variant="outlined"
                          color={(row.daysLive || 0) >= 90 ? 'success' : (row.daysLive || 0) >= 30 ? 'warning' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(row.expectedAnnualRevenue || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(row.actualAnnualRevenue || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box>
                          <Typography
                            variant="body2"
                            color={(row.revenueVariance || 0) >= 0 ? 'success.main' : 'error.main'}
                            fontWeight="medium"
                          >
                            {(row.revenueVariance || 0) >= 0 ? formatCurrency(row.revenueVariance) : `(${formatCurrency(Math.abs(row.revenueVariance))})`}
                          </Typography>
                          <Typography
                            variant="caption"
                            color={(row.revenueVariance || 0) >= 0 ? 'success.main' : 'error.main'}
                          >
                            {formatPercentage(row.revenueVariancePercent || 0)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <span style={{ color: (row.volumeContribution || 0) >= 0 ? '#2e7d32' : '#d32f2f' }}>
                              Vol: {formatCurrency(row.volumeContribution || 0)}
                            </span>
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <span style={{ color: (row.adoptionContribution || 0) >= 0 ? '#2e7d32' : '#d32f2f' }}>
                              Adopt: {formatCurrency(row.adoptionContribution || 0)}
                            </span>
                          </Typography>
                          {Math.abs(row.interactionContribution || 0) > 100 && (
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                              Mix: {formatCurrency(row.interactionContribution || 0)}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box>
                          <Typography variant="body2">
                            {(row.adoptionRateActual || 0).toFixed(1)}% (vs {(row.adoptionRateExpected || 0).toFixed(1)}%)
                          </Typography>
                          <Typography
                            variant="caption"
                            color={(row.adoptionVariance || 0) >= 0 ? 'success.main' : 'error.main'}
                          >
                            {formatPercentage(row.adoptionVariance || 0)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box>
                          <Typography variant="body2">
                            {formatVolume(row.volumeActual || 0)} (vs {formatVolume(row.volumeExpected || 0)})
                          </Typography>
                          <Typography
                            variant="caption"
                            color={(row.volumeVariance || 0) >= 0 ? 'success.main' : 'error.main'}
                          >
                            {formatPercentage(row.volumeVariance || 0)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" flexDirection="column" alignItems="center">
                          <Chip
                            label={
                              row.adjustmentStatus.startsWith('Pending') ? "Pending" : row.adjustmentStatus
                            }
                            size="small"
                            color={
                              row.adjustmentStatus === 'Adjusted' ? "error" :
                              row.adjustmentStatus.startsWith('Pending') ? "warning" : "success"
                            }
                            variant={row.adjustmentStatus === 'Not Adjusted' ? "outlined" : "filled"}
                          />
                          {row.adjustmentStatus.startsWith('Pending') && (
                            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
                              {row.adjustmentStatus.replace('Pending ', '').replace('(', '').replace(')', '')}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )) : []}
              </TableBody>
            </Table>
          </TableContainer>

          {(!data || data.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="textSecondary">
                No revenue data available for the selected filters.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}