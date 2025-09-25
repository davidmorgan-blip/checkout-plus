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
  Checkbox
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DownloadIcon from '@mui/icons-material/Download';
import WarningIcon from '@mui/icons-material/Warning';

interface NetRevenueData {
  accountId: string;
  accountName: string;
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
}

interface NetRevenueAnalysisProps {}

export default function NetRevenueAnalysis({}: NetRevenueAnalysisProps) {
  const [data, setData] = useState<NetRevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysLiveFilter, setDaysLiveFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [necessaryChangesOnly, setNecessaryChangesOnly] = useState(true);

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
      const response = await fetch(`http://localhost:3001/api/net-revenue/net-revenue/export?daysLive=${daysLiveFilter}&necessaryChangesOnly=${necessaryChangesOnly}`);

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
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        totalExpected: 0,
        totalActual: 0,
        totalVariance: 0,
        avgVariance: 0,
        totalVolumeContribution: 0,
        totalAdoptionContribution: 0,
        totalInteractionContribution: 0,
        totalVolumeExpected: 0,
        totalVolumeActual: 0,
        avgAdoptionExpected: 0,
        avgAdoptionActual: 0
      };
    }

    const totalExpected = data.reduce((sum, row) => sum + (row.expectedAnnualRevenue || 0), 0);
    const totalActual = data.reduce((sum, row) => sum + (row.actualAnnualRevenue || 0), 0);
    const totalVariance = totalActual - totalExpected;
    const avgVariance = data.reduce((sum, row) => sum + (row.revenueVariancePercent || 0), 0) / data.length;

    const totalVolumeContribution = data.reduce((sum, row) => sum + (row.volumeContribution || 0), 0);
    const totalAdoptionContribution = data.reduce((sum, row) => sum + (row.adoptionContribution || 0), 0);
    const totalInteractionContribution = data.reduce((sum, row) => sum + (row.interactionContribution || 0), 0);

    const totalVolumeExpected = data.reduce((sum, row) => sum + (row.volumeExpected || 0), 0);
    const totalVolumeActual = data.reduce((sum, row) => sum + (row.volumeActual || 0), 0);

    const avgAdoptionExpected = data.reduce((sum, row) => sum + (row.adoptionRateExpected || 0), 0) / data.length;
    const avgAdoptionActual = data.reduce((sum, row) => sum + (row.adoptionRateActual || 0), 0) / data.length;

    return {
      totalExpected,
      totalActual,
      totalVariance,
      avgVariance,
      totalVolumeContribution,
      totalAdoptionContribution,
      totalInteractionContribution,
      totalVolumeExpected,
      totalVolumeActual,
      avgAdoptionExpected,
      avgAdoptionActual
    };
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
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Days Live Filter</InputLabel>
            <Select
              value={daysLiveFilter}
              onChange={(e) => setDaysLiveFilter(e.target.value)}
              label="Days Live Filter"
            >
              <MenuItem value="all">All Merchants</MenuItem>
              <MenuItem value="30">30+ Days Live</MenuItem>
              <MenuItem value="60">60+ Days Live</MenuItem>
              <MenuItem value="90">90+ Days Live</MenuItem>
            </Select>
          </FormControl>
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
                  {formatCurrency(summaryStats.totalVariance)}
                </Typography>
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
                  {formatPercentage(summaryStats.avgVariance)}
                </Typography>
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

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
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
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        TOTAL ({data.length} merchants)
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
                        {data.filter(d => d.adjustmentStatus === 'Adjusted').length} Adjusted, {data.filter(d => d.adjustmentStatus.startsWith('Pending')).length} Pending, {data.filter(d => d.adjustmentStatus === 'Not Adjusted').length} Not Adjusted
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {Array.isArray(data) ? data
                  .sort((a, b) => Math.abs((b.revenueVariance || 0)) - Math.abs((a.revenueVariance || 0)))
                  .map((row) => (
                    <TableRow key={row.accountId} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {row.accountName || 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {formatPricingInfo(row.pricingModel || 'Unknown', row.labelsPaidBy || '')}
                            </Typography>
                          </Box>
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