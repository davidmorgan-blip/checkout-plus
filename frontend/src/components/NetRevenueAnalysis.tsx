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
  IconButton
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

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
  implementationStatus: string;
  daysLive: number;
}

interface NetRevenueAnalysisProps {}

export default function NetRevenueAnalysis({}: NetRevenueAnalysisProps) {
  const [data, setData] = useState<NetRevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysLiveFilter, setDaysLiveFilter] = useState('all');

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
      return { totalExpected: 0, totalActual: 0, totalVariance: 0, avgVariance: 0 };
    }

    const totalExpected = data.reduce((sum, row) => sum + (row.expectedAnnualRevenue || 0), 0);
    const totalActual = data.reduce((sum, row) => sum + (row.actualAnnualRevenue || 0), 0);
    const totalVariance = totalActual - totalExpected;
    const avgVariance = data.reduce((sum, row) => sum + (row.revenueVariancePercent || 0), 0) / data.length;

    return { totalExpected, totalActual, totalVariance, avgVariance };
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
                  <TableCell align="right">Adoption Rate</TableCell>
                  <TableCell align="right">Volume Performance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.isArray(data) ? data
                  .sort((a, b) => Math.abs((b.revenueVariance || 0)) - Math.abs((a.revenueVariance || 0)))
                  .map((row) => (
                    <TableRow key={row.accountId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {row.accountName || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {formatPricingInfo(row.pricingModel || 'Unknown', row.labelsPaidBy || '')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${row.daysLive || 0} days`}
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