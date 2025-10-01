import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
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
  Switch,
  Button,
  Collapse
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningIcon from '@mui/icons-material/Warning';
import DownloadIcon from '@mui/icons-material/Download';
import LaunchIcon from '@mui/icons-material/Launch';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import * as XLSX from 'xlsx';

interface AcvImpactData {
  accountId: string;
  opportunityId: string;
  merchantName: string;
  opportunityRecordType: string;
  pricingModel: string;
  labelsPaidBy: string;
  merchantSegment: string;
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
  const [merchantSegmentFilter, setMerchantSegmentFilter] = useState('all');
  const [recordTypeFilter, setRecordTypeFilter] = useState('all');
  const [excludedMerchants, setExcludedMerchants] = useState<Set<string>>(new Set());
  const [hideInsufficientData, setHideInsufficientData] = useState(false);

  // Collapsible summary table states
  const [pricingModelSummaryExpanded, setPricingModelSummaryExpanded] = useState(true);
  const [merchantSegmentSummaryExpanded, setMerchantSegmentSummaryExpanded] = useState(true);
  const [recordTypeSummaryExpanded, setRecordTypeSummaryExpanded] = useState(true);
  const [performanceTierSummaryExpanded, setPerformanceTierSummaryExpanded] = useState(true);

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

      const response = await fetch(`${API_ENDPOINTS.ACV_IMPACTS}?${params}`);
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

  // Automatically exclude/include merchants based on the insufficient data toggle
  useEffect(() => {
    if (hideInsufficientData) {
      // Add merchants with insufficient data to the excluded set
      const insufficientDataMerchants = acvData
        .filter(d => !d.hasSufficientData)
        .map(d => d.accountId);

      setExcludedMerchants(prev => {
        const newExcluded = new Set(prev);
        insufficientDataMerchants.forEach(id => newExcluded.add(id));
        return newExcluded;
      });
    } else {
      // Remove insufficient data merchants from excluded set
      const insufficientDataMerchants = acvData
        .filter(d => !d.hasSufficientData)
        .map(d => d.accountId);

      setExcludedMerchants(prev => {
        const newExcluded = new Set(prev);
        insufficientDataMerchants.forEach(id => newExcluded.delete(id));
        return newExcluded;
      });
    }
  }, [hideInsufficientData, acvData]);

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

  const formatCurrencyCompact = (value: number): string => {
    const absValue = Math.abs(value);
    let formatted: string;

    if (absValue >= 1000000) {
      formatted = `$${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      formatted = `$${(absValue / 1000).toFixed(1)}K`;
    } else {
      formatted = `$${absValue.toFixed(0)}`;
    }

    return value < 0 ? `(${formatted})` : formatted;
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getVarianceColor = (variancePercent: number): 'success' | 'warning' | 'error' | 'default' => {
    if (variancePercent > 110) return 'success';
    if (variancePercent >= 90) return 'default';
    if (variancePercent >= 70) return 'warning';
    return 'error';
  };

  const getVarianceIcon = (variancePercent: number) => {
    if (variancePercent > 100) return <TrendingUpIcon fontSize="small" />;
    if (variancePercent < 100) return <TrendingDownIcon fontSize="small" />;
    return null;
  };

  // Export functions
  const exportMerchantDataToCsv = () => {
    // Use the filtered data that's currently displayed
    const dataToExport = filteredData;

    // Create CSV headers
    const headers = [
      'Merchant Name',
      'Performance Tier',
      'Pricing Model',
      'Labels Paid By',
      'Days Live',
      'Original Net ACV',
      'Original Ending ACV',
      'Projected Ending ACV',
      'Projected Net ACV',
      'ACV Variance ($)',
      '% of Original',
      'Has Sufficient Data'
    ];

    // Create CSV rows
    const csvRows = [
      headers.join(','),
      ...dataToExport.map(row => {
        const tier = getVarianceTier(row.acvVariancePercent);
        let tierDisplay = '';
        switch (tier) {
          case 'exceeding100': tierDisplay = '>100%'; break;
          case 'meeting80': tierDisplay = '80-100%'; break;
          case 'below50': tierDisplay = '50-80%'; break;
          case 'below30': tierDisplay = '30-50%'; break;
          case 'significantlyBelow30': tierDisplay = '<30%'; break;
          default: tierDisplay = 'N/A';
        }

        return [
          `"${row.merchantName}"`,
          tierDisplay,
          row.pricingModel,
          `"${row.labelsPaidBy}"`,
          row.daysLive,
          row.originalNetAcv,
          row.originalEndingAcv,
          row.projectedEndingAcv,
          row.projectedNetAcv,
          row.acvVariance,
          (row.acvVariancePercent / 100).toFixed(4),
          row.hasSufficientData ? 'Yes' : 'No'
        ].join(',');
      })
    ];

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `acv-impacts-merchant-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSummaryTableToXlsx = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // === SHEET 1: Pricing Model & Labels Summary ===
    const pricingModelSummaryData = [];

    // Add header row
    pricingModelSummaryData.push([
      'Category',
      'Labels Paid By',
      'Pricing Model',
      'Merchant Count',
      'Original Net ACV',
      'Projected Net ACV',
      'ACV Variance ($)',
      '% of Original'
    ]);

    // Add sufficient data section header
    if (stratifiedStats.groupStats.filter(group => group.dataType === 'sufficient').length > 0) {
      pricingModelSummaryData.push(['SUFFICIENT DATA MERCHANTS (Updated Projections)', '', '', '', '', '', '', '']);

      // Add sufficient data groups
      stratifiedStats.groupStats
        .filter(group => group.dataType === 'sufficient')
        .forEach(group => {
          const variancePercent = group.totalOriginalNetAcv !== 0
            ? (group.totalProjectedNetAcv / group.totalOriginalNetAcv) * 100
            : 0;

          pricingModelSummaryData.push([
            'Group',
            group.labelsPaidBy,
            group.pricingModel,
            group.merchantCount,
            group.totalOriginalNetAcv,
            group.totalProjectedNetAcv,
            group.totalAcvVariance,
            (variancePercent / 100).toFixed(4)
          ]);
        });

      // Add sufficient data subtotal
      const sufficientVariancePercent = stratifiedStats.sufficientTotals.totalOriginalNetAcv !== 0
        ? (stratifiedStats.sufficientTotals.totalProjectedNetAcv / stratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100
        : 0;

      pricingModelSummaryData.push([
        'SUFFICIENT DATA SUBTOTAL',
        '',
        '',
        stratifiedStats.sufficientTotals.merchantCount,
        stratifiedStats.sufficientTotals.totalOriginalNetAcv,
        stratifiedStats.sufficientTotals.totalProjectedNetAcv,
        stratifiedStats.sufficientTotals.totalAcvVariance,
        (sufficientVariancePercent / 100).toFixed(4)
      ]);
    }

    // Add insufficient data section header
    if (stratifiedStats.groupStats.filter(group => group.dataType === 'insufficient').length > 0) {
      pricingModelSummaryData.push(['INSUFFICIENT DATA MERCHANTS (Original Projections)', '', '', '', '', '', '', '']);

      // Add insufficient data groups
      stratifiedStats.groupStats
        .filter(group => group.dataType === 'insufficient')
        .forEach(group => {
          const variancePercent = group.totalOriginalNetAcv !== 0
            ? (group.totalProjectedNetAcv / group.totalOriginalNetAcv) * 100
            : 0;

          pricingModelSummaryData.push([
            'Group',
            group.labelsPaidBy,
            group.pricingModel,
            group.merchantCount,
            group.totalOriginalNetAcv,
            group.totalProjectedNetAcv,
            group.totalAcvVariance,
            (variancePercent / 100).toFixed(4)
          ]);
        });

      // Add insufficient data subtotal
      const insufficientVariancePercent = stratifiedStats.insufficientTotals.totalOriginalNetAcv !== 0
        ? (stratifiedStats.insufficientTotals.totalProjectedNetAcv / stratifiedStats.insufficientTotals.totalOriginalNetAcv) * 100
        : 0;

      pricingModelSummaryData.push([
        'INSUFFICIENT DATA SUBTOTAL',
        '',
        '',
        stratifiedStats.insufficientTotals.merchantCount,
        stratifiedStats.insufficientTotals.totalOriginalNetAcv,
        stratifiedStats.insufficientTotals.totalProjectedNetAcv,
        stratifiedStats.insufficientTotals.totalAcvVariance,
        (insufficientVariancePercent / 100).toFixed(4)
      ]);
    }

    // Add grand total if we have data
    if (displaySummary && (stratifiedStats.sufficientTotals.merchantCount > 0 || stratifiedStats.insufficientTotals.merchantCount > 0)) {
      const grandTotalVariancePercent = displaySummary.totalOriginalNetAcv !== 0
        ? (displaySummary.totalProjectedNetAcv / displaySummary.totalOriginalNetAcv) * 100
        : 0;

      pricingModelSummaryData.push([
        'GRAND TOTAL',
        '',
        '',
        displaySummary.totalMerchants,
        displaySummary.totalOriginalNetAcv,
        displaySummary.totalProjectedNetAcv,
        displaySummary.totalAcvVariance,
        (grandTotalVariancePercent / 100).toFixed(4)
      ]);
    }

    // Create first worksheet
    const ws1 = XLSX.utils.aoa_to_sheet(pricingModelSummaryData);
    const colWidths1 = [
      { wch: 35 }, // Category
      { wch: 15 }, // Labels Paid By
      { wch: 15 }, // Pricing Model
      { wch: 12 }, // Merchant Count
      { wch: 15 }, // Original Net ACV
      { wch: 15 }, // Projected Net ACV
      { wch: 15 }, // ACV Variance ($)
      { wch: 12 }  // % of Original
    ];
    ws1['!cols'] = colWidths1;
    XLSX.utils.book_append_sheet(wb, ws1, 'Pricing Model Summary');

    // === SHEET 2: Performance Tier Summary ===
    const performanceTierSummaryData = [];

    // Add header row
    performanceTierSummaryData.push([
      'Performance Tier',
      'Merchant Count',
      'Original Net ACV',
      'Projected Net ACV',
      'ACV Variance ($)',
      '% of Original'
    ]);

    // Add tier data (only for merchants with sufficient data)
    if (varianceStratifiedStats.tierStats.length > 0) {
      const sufficientDataTiers = varianceStratifiedStats.tierStats.filter(tier => tier.tier !== 'insufficientData');

      sufficientDataTiers.forEach(tier => {
        const variancePercent = tier.totalOriginalNetAcv !== 0
          ? (tier.totalProjectedNetAcv / tier.totalOriginalNetAcv) * 100
          : 0;

        performanceTierSummaryData.push([
          tier.tierDisplay,
          tier.merchantCount,
          tier.totalOriginalNetAcv,
          tier.totalProjectedNetAcv,
          tier.totalAcvVariance,
          (variancePercent / 100).toFixed(4)
        ]);
      });

      // Add subtotal for sufficient data
      const sufficientTotalVariancePercent = varianceStratifiedStats.sufficientTotals.totalOriginalNetAcv !== 0
        ? (varianceStratifiedStats.sufficientTotals.totalProjectedNetAcv / varianceStratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100
        : 0;

      performanceTierSummaryData.push([
        'SUBTOTAL (Sufficient Data)',
        varianceStratifiedStats.sufficientTotals.merchantCount,
        varianceStratifiedStats.sufficientTotals.totalOriginalNetAcv,
        varianceStratifiedStats.sufficientTotals.totalProjectedNetAcv,
        varianceStratifiedStats.sufficientTotals.totalAcvVariance,
        (sufficientTotalVariancePercent / 100).toFixed(4)
      ]);

      // Add insufficient data row if any exist
      if (varianceStratifiedStats.insufficientTotals.merchantCount > 0) {
        const insufficientTotalVariancePercent = varianceStratifiedStats.insufficientTotals.totalOriginalNetAcv !== 0
          ? (varianceStratifiedStats.insufficientTotals.totalProjectedNetAcv / varianceStratifiedStats.insufficientTotals.totalOriginalNetAcv) * 100
          : 0;

        performanceTierSummaryData.push([
          'Insufficient Data',
          varianceStratifiedStats.insufficientTotals.merchantCount,
          varianceStratifiedStats.insufficientTotals.totalOriginalNetAcv,
          varianceStratifiedStats.insufficientTotals.totalProjectedNetAcv,
          varianceStratifiedStats.insufficientTotals.totalAcvVariance,
          (insufficientTotalVariancePercent / 100).toFixed(4)
        ]);
      }

      // Add grand total
      const grandTotalVariancePercent = varianceStratifiedStats.totalOriginalNetAcv !== 0
        ? (varianceStratifiedStats.totalProjectedNetAcv / varianceStratifiedStats.totalOriginalNetAcv) * 100
        : 0;

      performanceTierSummaryData.push([
        'TOTAL',
        varianceStratifiedStats.totalMerchants,
        varianceStratifiedStats.totalOriginalNetAcv,
        varianceStratifiedStats.totalProjectedNetAcv,
        varianceStratifiedStats.totalAcvVariance,
        (grandTotalVariancePercent / 100).toFixed(4)
      ]);
    } else {
      performanceTierSummaryData.push(['No data available for current filters', '', '', '', '', '']);
    }

    // Create second worksheet
    const ws2 = XLSX.utils.aoa_to_sheet(performanceTierSummaryData);
    const colWidths2 = [
      { wch: 25 }, // Performance Tier
      { wch: 12 }, // Merchant Count
      { wch: 15 }, // Original Net ACV
      { wch: 15 }, // Projected Net ACV
      { wch: 15 }, // ACV Variance ($)
      { wch: 12 }  // % of Original
    ];
    ws2['!cols'] = colWidths2;
    XLSX.utils.book_append_sheet(wb, ws2, 'Performance Tier Summary');

    // Write and download file
    XLSX.writeFile(wb, `acv-variance-summary-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getVarianceTier = (variancePercent: number): string => {
    if (variancePercent > 100) return 'exceeding100';
    if (variancePercent >= 80) return 'meeting80';
    if (variancePercent >= 50) return 'below50';
    if (variancePercent >= 30) return 'below30';
    return 'significantlyBelow30';
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


      // Apply days live filter
      if (daysLiveFilter !== 'all') {
        const daysLiveThreshold = parseInt(daysLiveFilter);
        if (item.daysLive < daysLiveThreshold) {
          return false;
        }
      }

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

      // Apply merchant segment filter
      if (merchantSegmentFilter !== 'all' && (item.merchantSegment || 'Unknown') !== merchantSegmentFilter) {
        return false;
      }

      // Apply record type filter
      if (recordTypeFilter !== 'all') {
        const recordType = item.opportunityRecordType === 'New Business' ? 'New Business' : 'Existing';
        if (recordType !== recordTypeFilter) {
          return false;
        }
      }

      return true;
    });

    const totalOriginalNetAcv = filteredAndIncludedData.reduce((sum, item) => sum + item.originalNetAcv, 0);
    const totalProjectedNetAcv = filteredAndIncludedData.reduce((sum, item) => sum + item.projectedNetAcv, 0);
    const totalOriginalEndingAcv = filteredAndIncludedData.reduce((sum, item) => sum + item.originalEndingAcv, 0);
    const totalProjectedEndingAcv = filteredAndIncludedData.reduce((sum, item) => sum + item.projectedEndingAcv, 0);
    const totalAcvVariance = totalProjectedNetAcv - totalOriginalNetAcv;
    const avgAcvVariance = filteredAndIncludedData.length > 0 ? totalAcvVariance / filteredAndIncludedData.length : 0;

    const varianceCounts = {
      exceeding100: filteredAndIncludedData.filter(m => m.acvVariancePercent > 100).length,
      meeting80: filteredAndIncludedData.filter(m => m.acvVariancePercent >= 80 && m.acvVariancePercent <= 100).length,
      below50: filteredAndIncludedData.filter(m => m.acvVariancePercent >= 50 && m.acvVariancePercent < 80).length,
      below30: filteredAndIncludedData.filter(m => m.acvVariancePercent >= 30 && m.acvVariancePercent < 50).length,
      significantlyBelow30: filteredAndIncludedData.filter(m => m.acvVariancePercent < 30).length
    };

    return {
      totalMerchants: filteredAndIncludedData.length,
      totalOriginalNetAcv,
      totalProjectedNetAcv,
      totalOriginalEndingAcv,
      totalProjectedEndingAcv,
      totalAcvVariance,
      avgAcvVariance,
      varianceCounts
    };
  }, [acvData, excludedMerchants, varianceFilter, pricingModelFilter, labelsPaidByFilter, merchantSegmentFilter, recordTypeFilter, hideInsufficientData, daysLiveFilter, summary]);

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

    // Merchant segment filter
    if (merchantSegmentFilter !== 'all' && (item.merchantSegment || 'Unknown') !== merchantSegmentFilter) {
      return false;
    }

    // Record type filter
    if (recordTypeFilter !== 'all') {
      const recordType = item.opportunityRecordType === 'New Business' ? 'New Business' : 'Existing';
      if (recordType !== recordTypeFilter) {
        return false;
      }
    }

    // Days live filter
    if (daysLiveFilter !== 'all') {
      const daysLiveThreshold = parseInt(daysLiveFilter);
      if (item.daysLive < daysLiveThreshold) {
        return false;
      }
    }

    return true;
  });

  const merchantOptions = acvData.map(item => item.merchantName).sort();

  // Get unique pricing models and counts
  const pricingModelCounts = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    let dataToCount = acvData;
    // Apply days live filter
    if (daysLiveFilter !== 'all') {
      const daysLiveThreshold = parseInt(daysLiveFilter);
      dataToCount = dataToCount.filter(item => item.daysLive >= daysLiveThreshold);
    }
    // Exclude merchants that are excluded
    dataToCount = dataToCount.filter(item => !excludedMerchants.has(item.accountId));

    dataToCount.forEach(item => {
      counts[item.pricingModel] = (counts[item.pricingModel] || 0) + 1;
    });
    return counts;
  }, [acvData, hideInsufficientData, daysLiveFilter, excludedMerchants]);

  // Get unique labels paid by and counts
  const labelsPaidByCounts = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    let dataToCount = acvData;
    // Apply days live filter
    if (daysLiveFilter !== 'all') {
      const daysLiveThreshold = parseInt(daysLiveFilter);
      dataToCount = dataToCount.filter(item => item.daysLive >= daysLiveThreshold);
    }
    // Exclude merchants that are excluded
    dataToCount = dataToCount.filter(item => !excludedMerchants.has(item.accountId));

    dataToCount.forEach(item => {
      counts[item.labelsPaidBy] = (counts[item.labelsPaidBy] || 0) + 1;
    });
    return counts;
  }, [acvData, hideInsufficientData, daysLiveFilter, excludedMerchants]);

  // Get unique merchant segments and counts
  const merchantSegmentCounts = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    let dataToCount = acvData;
    // Apply days live filter
    if (daysLiveFilter !== 'all') {
      const daysLiveThreshold = parseInt(daysLiveFilter);
      dataToCount = dataToCount.filter(item => item.daysLive >= daysLiveThreshold);
    }
    // Exclude merchants that are excluded
    dataToCount = dataToCount.filter(item => !excludedMerchants.has(item.accountId));

    dataToCount.forEach(item => {
      const segment = item.merchantSegment || 'Unknown';
      counts[segment] = (counts[segment] || 0) + 1;
    });
    return counts;
  }, [acvData, hideInsufficientData, daysLiveFilter, excludedMerchants]);

  // Get unique record types and counts
  const recordTypeCounts = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    let dataToCount = acvData;
    // Apply days live filter
    if (daysLiveFilter !== 'all') {
      const daysLiveThreshold = parseInt(daysLiveFilter);
      dataToCount = dataToCount.filter(item => item.daysLive >= daysLiveThreshold);
    }
    // Exclude merchants that are excluded
    dataToCount = dataToCount.filter(item => !excludedMerchants.has(item.accountId));

    dataToCount.forEach(item => {
      const recordType = item.opportunityRecordType === 'New Business' ? 'New Business' : 'Existing';
      counts[recordType] = (counts[recordType] || 0) + 1;
    });
    return counts;
  }, [acvData, hideInsufficientData, daysLiveFilter, excludedMerchants]);

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
      // Merchant segment filter
      if (merchantSegmentFilter !== 'all' && (item.merchantSegment || 'Unknown') !== merchantSegmentFilter) {
        return false;
      }
      // Record type filter
      if (recordTypeFilter !== 'all') {
        const recordType = item.opportunityRecordType === 'New Business' ? 'New Business' : 'Existing';
        if (recordType !== recordTypeFilter) {
          return false;
        }
      }
      // Days live filter
      if (daysLiveFilter !== 'all') {
        const daysLiveThreshold = parseInt(daysLiveFilter);
        if (item.daysLive < daysLiveThreshold) {
          return false;
        }
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
        variancePercent: totalOriginalNetAcv !== 0 ? (totalProjectedNetAcv / totalOriginalNetAcv) * 100 : 0,
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
        variancePercent: totalOriginalNetAcv !== 0 ? (totalProjectedNetAcv / totalOriginalNetAcv) * 100 : 0,
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
  }, [acvData, excludedMerchants, varianceFilter, pricingModelFilter, labelsPaidByFilter, merchantSegmentFilter, recordTypeFilter, hideInsufficientData, daysLiveFilter]);

  // Calculate variance magnitude stratified statistics
  const varianceStratifiedStats = React.useMemo(() => {
    // Filter data based on current filters (but not excludedMerchants yet)
    // Note: We don't apply hideInsufficientData filter here since we want to show insufficient data as a separate tier
    const filteredForStats = acvData.filter(item => {
      // Pricing model filter
      if (pricingModelFilter !== 'all' && item.pricingModel !== pricingModelFilter) {
        return false;
      }
      // Labels paid by filter
      if (labelsPaidByFilter !== 'all' && item.labelsPaidBy !== labelsPaidByFilter) {
        return false;
      }
      // Merchant segment filter
      if (merchantSegmentFilter !== 'all' && (item.merchantSegment || 'Unknown') !== merchantSegmentFilter) {
        return false;
      }
      // Record type filter
      if (recordTypeFilter !== 'all') {
        const recordType = item.opportunityRecordType === 'New Business' ? 'New Business' : 'Existing';
        if (recordType !== recordTypeFilter) {
          return false;
        }
      }
      // Days live filter
      if (daysLiveFilter !== 'all') {
        const daysLiveThreshold = parseInt(daysLiveFilter);
        if (item.daysLive < daysLiveThreshold) {
          return false;
        }
      }
      return true;
    });

    // Further filter to exclude merchants
    const includedData = filteredForStats.filter(item => !excludedMerchants.has(item.accountId));

    // Group by variance tier, separating insufficient data
    const varianceGroups: { [key: string]: AcvImpactData[] } = {
      exceeding100: [],
      meeting80: [],
      below50: [],
      below30: [],
      significantlyBelow30: [],
      insufficientData: []
    };

    includedData.forEach(item => {
      if (!item.hasSufficientData) {
        // Separate insufficient data merchants regardless of their variance
        varianceGroups.insufficientData.push(item);
      } else {
        // Only calculate variance tier for merchants with sufficient data
        const tier = getVarianceTier(item.acvVariancePercent);
        varianceGroups[tier].push(item);
      }
    });

    // Calculate stats for each variance tier
    const varianceTierStats = Object.entries(varianceGroups).map(([tier, items]) => {
      const totalOriginalNetAcv = items.reduce((sum, item) => sum + item.originalNetAcv, 0);
      const totalProjectedNetAcv = items.reduce((sum, item) => sum + item.projectedNetAcv, 0);
      const totalAcvVariance = totalProjectedNetAcv - totalOriginalNetAcv;
      const avgAcvVariance = items.length > 0 ? totalAcvVariance / items.length : 0;

      // Get tier display info
      let tierDisplay = '';
      let tierColor: 'success' | 'primary' | 'warning' | 'error' | 'secondary' | 'info' = 'primary';
      switch (tier) {
        case 'exceeding100':
          tierDisplay = '>100%';
          tierColor = 'success';
          break;
        case 'meeting80':
          tierDisplay = '80-100%';
          tierColor = 'primary';
          break;
        case 'below50':
          tierDisplay = '50-80%';
          tierColor = 'warning';
          break;
        case 'below30':
          tierDisplay = '30-50%';
          tierColor = 'error';
          break;
        case 'significantlyBelow30':
          tierDisplay = '<30%';
          tierColor = 'error';
          break;
        case 'insufficientData':
          tierDisplay = 'Insufficient Data';
          tierColor = 'secondary';
          break;
      }

      return {
        tier,
        tierDisplay,
        tierColor,
        merchantCount: items.length,
        totalOriginalNetAcv,
        totalProjectedNetAcv,
        totalAcvVariance,
        avgAcvVariance,
        variancePercent: totalOriginalNetAcv !== 0 ? (totalProjectedNetAcv / totalOriginalNetAcv) * 100 : 0
      };
    }).filter(group => group.merchantCount > 0); // Only include non-empty groups

    // Calculate subtotals for sufficient vs insufficient data
    const sufficientDataItems = includedData.filter(item => item.hasSufficientData);
    const insufficientDataItems = includedData.filter(item => !item.hasSufficientData);

    const sufficientTotals = {
      merchantCount: sufficientDataItems.length,
      totalOriginalNetAcv: sufficientDataItems.reduce((sum, item) => sum + item.originalNetAcv, 0),
      totalProjectedNetAcv: sufficientDataItems.reduce((sum, item) => sum + item.projectedNetAcv, 0),
      totalAcvVariance: sufficientDataItems.reduce((sum, item) => sum + item.projectedNetAcv, 0) - sufficientDataItems.reduce((sum, item) => sum + item.originalNetAcv, 0)
    };

    const insufficientTotals = {
      merchantCount: insufficientDataItems.length,
      totalOriginalNetAcv: insufficientDataItems.reduce((sum, item) => sum + item.originalNetAcv, 0),
      totalProjectedNetAcv: insufficientDataItems.reduce((sum, item) => sum + item.projectedNetAcv, 0),
      totalAcvVariance: insufficientDataItems.reduce((sum, item) => sum + item.projectedNetAcv, 0) - insufficientDataItems.reduce((sum, item) => sum + item.originalNetAcv, 0)
    };

    return {
      tierStats: varianceTierStats,
      sufficientTotals,
      insufficientTotals,
      totalMerchants: includedData.length,
      totalOriginalNetAcv: includedData.reduce((sum, item) => sum + item.originalNetAcv, 0),
      totalProjectedNetAcv: includedData.reduce((sum, item) => sum + item.projectedNetAcv, 0),
      totalAcvVariance: includedData.reduce((sum, item) => sum + item.projectedNetAcv, 0) - includedData.reduce((sum, item) => sum + item.originalNetAcv, 0)
    };
  }, [acvData, excludedMerchants, pricingModelFilter, labelsPaidByFilter, merchantSegmentFilter, recordTypeFilter, daysLiveFilter]);

  // Calculate merchant segment statistics
  const merchantSegmentStats = React.useMemo(() => {
    if (!acvData || acvData.length === 0) return { segmentStats: [], sufficientTotals: null, insufficientTotals: null };

    // Filter data based on current filters
    const includedData = acvData.filter(item => {
      if (excludedMerchants.has(item.accountId)) return false;
      if (pricingModelFilter !== 'all' && item.pricingModel !== pricingModelFilter) return false;
      if (labelsPaidByFilter !== 'all' && item.labelsPaidBy !== labelsPaidByFilter) return false;
      if (merchantSegmentFilter !== 'all' && (item.merchantSegment || 'Unknown') !== merchantSegmentFilter) return false;
      // Record type filter
      if (recordTypeFilter !== 'all') {
        const recordType = item.opportunityRecordType === 'New Business' ? 'New Business' : 'Existing';
        if (recordType !== recordTypeFilter) {
          return false;
        }
      }
      if (daysLiveFilter !== 'all') {
        const threshold = parseInt(daysLiveFilter);
        if (item.daysLive < threshold) return false;
      }
      return true;
    });

    // Group by merchant segment and sufficient data status
    const segmentGroups: { [key: string]: AcvImpactData[] } = {};
    includedData.forEach(item => {
      const segment = item.merchantSegment || 'Unknown';
      const key = `${segment}|${item.hasSufficientData ? 'sufficient' : 'insufficient'}`;
      if (!segmentGroups[key]) {
        segmentGroups[key] = [];
      }
      segmentGroups[key].push(item);
    });

    // Calculate stats for each merchant segment group
    const segmentStats = Object.entries(segmentGroups).map(([key, items]) => {
      const [merchantSegment, dataType] = key.split('|');
      const totalOriginalNetAcv = items.reduce((sum, item) => sum + item.originalNetAcv, 0);
      const totalProjectedNetAcv = items.reduce((sum, item) => sum + item.projectedNetAcv, 0);
      const totalAcvVariance = totalProjectedNetAcv - totalOriginalNetAcv;
      const avgAcvVariance = items.length > 0 ? totalAcvVariance / items.length : 0;

      return {
        merchantSegment,
        dataType: dataType as 'sufficient' | 'insufficient',
        merchantCount: items.length,
        totalOriginalNetAcv,
        totalProjectedNetAcv,
        totalAcvVariance,
        avgAcvVariance,
        variancePercent: totalOriginalNetAcv !== 0 ? (totalProjectedNetAcv / totalOriginalNetAcv) * 100 : 0
      };
    }).filter(group => group.merchantCount > 0).sort((a, b) => {
      // Define custom sort order for merchant segments
      const segmentOrder = ['Strategic Enterprise', 'Enterprise', 'Mid-Market', 'SMB'];

      // Sort by segment first, then by data type (sufficient first)
      if (a.merchantSegment !== b.merchantSegment) {
        const aIndex = segmentOrder.indexOf(a.merchantSegment);
        const bIndex = segmentOrder.indexOf(b.merchantSegment);

        // If segment not found in order, put it at the end
        const aOrder = aIndex === -1 ? 999 : aIndex;
        const bOrder = bIndex === -1 ? 999 : bIndex;

        return aOrder - bOrder;
      }
      return a.dataType === 'sufficient' ? -1 : 1;
    });

    // Calculate subtotals for sufficient vs insufficient data
    const sufficientDataItems = includedData.filter(item => item.hasSufficientData);
    const insufficientDataItems = includedData.filter(item => !item.hasSufficientData);

    const sufficientTotals = {
      merchantCount: sufficientDataItems.length,
      totalOriginalNetAcv: sufficientDataItems.reduce((sum, item) => sum + item.originalNetAcv, 0),
      totalProjectedNetAcv: sufficientDataItems.reduce((sum, item) => sum + item.projectedNetAcv, 0),
      totalAcvVariance: sufficientDataItems.reduce((sum, item) => sum + item.projectedNetAcv, 0) - sufficientDataItems.reduce((sum, item) => sum + item.originalNetAcv, 0)
    };

    const insufficientTotals = {
      merchantCount: insufficientDataItems.length,
      totalOriginalNetAcv: insufficientDataItems.reduce((sum, item) => sum + item.originalNetAcv, 0),
      totalProjectedNetAcv: insufficientDataItems.reduce((sum, item) => sum + item.projectedNetAcv, 0),
      totalAcvVariance: insufficientDataItems.reduce((sum, item) => sum + item.projectedNetAcv, 0) - insufficientDataItems.reduce((sum, item) => sum + item.originalNetAcv, 0)
    };

    return {
      segmentStats,
      sufficientTotals,
      insufficientTotals
    };
  }, [acvData, excludedMerchants, pricingModelFilter, labelsPaidByFilter, merchantSegmentFilter, recordTypeFilter, daysLiveFilter]);

  // Calculate opportunity record type statistics
  const opportunityRecordTypeStats = React.useMemo(() => {
    if (!acvData || acvData.length === 0) return { recordTypeStats: [], sufficientTotals: null, insufficientTotals: null };

    // Filter data based on current filters
    const includedData = acvData.filter(item => {
      if (excludedMerchants.has(item.accountId)) return false;
      if (pricingModelFilter !== 'all' && item.pricingModel !== pricingModelFilter) return false;
      if (labelsPaidByFilter !== 'all' && item.labelsPaidBy !== labelsPaidByFilter) return false;
      if (merchantSegmentFilter !== 'all' && (item.merchantSegment || 'Unknown') !== merchantSegmentFilter) return false;
      // Record type filter
      if (recordTypeFilter !== 'all') {
        const recordType = item.opportunityRecordType === 'New Business' ? 'New Business' : 'Existing';
        if (recordType !== recordTypeFilter) {
          return false;
        }
      }
      if (daysLiveFilter !== 'all') {
        const threshold = parseInt(daysLiveFilter);
        if (item.daysLive < threshold) return false;
      }
      return true;
    });

    // Group by opportunity record type category and sufficient data status
    const recordTypeGroups: { [key: string]: AcvImpactData[] } = {};
    includedData.forEach(item => {
      // Categorize: "New Business" vs "Existing" (everything else)
      const recordTypeCategory = item.opportunityRecordType === 'New Business' ? 'New Business' : 'Existing';
      const key = `${recordTypeCategory}|${item.hasSufficientData ? 'sufficient' : 'insufficient'}`;
      if (!recordTypeGroups[key]) {
        recordTypeGroups[key] = [];
      }
      recordTypeGroups[key].push(item);
    });

    // Calculate stats for each record type group
    const recordTypeStats = Object.entries(recordTypeGroups).map(([key, items]) => {
      const [recordTypeCategory, dataType] = key.split('|');
      const totalOriginalNetAcv = items.reduce((sum, item) => sum + item.originalNetAcv, 0);
      const totalProjectedNetAcv = items.reduce((sum, item) => sum + item.projectedNetAcv, 0);
      const totalAcvVariance = totalProjectedNetAcv - totalOriginalNetAcv;
      const avgAcvVariance = items.length > 0 ? totalAcvVariance / items.length : 0;

      return {
        recordTypeCategory,
        dataType: dataType as 'sufficient' | 'insufficient',
        merchantCount: items.length,
        totalOriginalNetAcv,
        totalProjectedNetAcv,
        totalAcvVariance,
        avgAcvVariance,
        variancePercent: totalOriginalNetAcv !== 0 ? (totalProjectedNetAcv / totalOriginalNetAcv) * 100 : 0
      };
    }).filter(group => group.merchantCount > 0).sort((a, b) => {
      // Sort by record type category first (New Business first), then by data type (sufficient first)
      if (a.recordTypeCategory !== b.recordTypeCategory) {
        return a.recordTypeCategory === 'New Business' ? -1 : 1;
      }
      return a.dataType === 'sufficient' ? -1 : 1;
    });

    // Calculate totals for sufficient and insufficient data separately
    const sufficientData = includedData.filter(item => item.hasSufficientData);
    const insufficientData = includedData.filter(item => !item.hasSufficientData);

    const sufficientTotals = sufficientData.length > 0 ? {
      merchantCount: sufficientData.length,
      totalOriginalNetAcv: sufficientData.reduce((sum, item) => sum + item.originalNetAcv, 0),
      totalProjectedNetAcv: sufficientData.reduce((sum, item) => sum + item.projectedNetAcv, 0),
      totalAcvVariance: sufficientData.reduce((sum, item) => sum + item.projectedNetAcv, 0) - sufficientData.reduce((sum, item) => sum + item.originalNetAcv, 0)
    } : null;

    const insufficientTotals = insufficientData.length > 0 ? {
      merchantCount: insufficientData.length,
      totalOriginalNetAcv: insufficientData.reduce((sum, item) => sum + item.originalNetAcv, 0),
      totalProjectedNetAcv: insufficientData.reduce((sum, item) => sum + item.projectedNetAcv, 0),
      totalAcvVariance: insufficientData.reduce((sum, item) => sum + item.projectedNetAcv, 0) - insufficientData.reduce((sum, item) => sum + item.originalNetAcv, 0)
    } : null;

    return {
      recordTypeStats,
      sufficientTotals,
      insufficientTotals
    };
  }, [acvData, excludedMerchants, pricingModelFilter, labelsPaidByFilter, merchantSegmentFilter, recordTypeFilter, daysLiveFilter]);

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

  const displaySummary = adjustedSummary;

  if (!displaySummary) {
    return <Box sx={{ p: 3 }}>Loading...</Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachMoneyIcon />
          ACV Impacts Analysis
          <Tooltip title="Shows the impact of projected revenue performance on Net ACV values">
            <IconButton size="small">
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={exportMerchantDataToCsv}
            disabled={filteredData.length === 0}
          >
            Export Merchant Data (CSV)
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={exportSummaryTableToXlsx}
            disabled={stratifiedStats.groupStats.length === 0}
          >
            Export Summary (XLSX)
          </Button>
        </Box>
      </Box>

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
            <Typography variant="caption" color="text.secondary">
              {formatCurrencyCompact(displaySummary.totalMerchants > 0 ? displaySummary.totalOriginalEndingAcv / displaySummary.totalMerchants : 0)} per merchant
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {formatCurrencyCompact(displaySummary.totalMerchants > 0 ? displaySummary.totalProjectedEndingAcv / displaySummary.totalMerchants : 0)} per merchant
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
            label={`All (${displaySummary.totalMerchants})`}
            onClick={() => setVarianceFilter('all')}
            color={varianceFilter === 'all' ? 'primary' : 'default'}
            variant={varianceFilter === 'all' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`>100% (${displaySummary.varianceCounts.exceeding100})`}
            onClick={() => setVarianceFilter('exceeding100')}
            color={varianceFilter === 'exceeding100' ? 'success' : 'default'}
            variant={varianceFilter === 'exceeding100' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`80-100% (${displaySummary.varianceCounts.meeting80})`}
            onClick={() => setVarianceFilter('meeting80')}
            color={varianceFilter === 'meeting80' ? 'primary' : 'default'}
            variant={varianceFilter === 'meeting80' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`50-80% (${displaySummary.varianceCounts.below50})`}
            onClick={() => setVarianceFilter('below50')}
            color={varianceFilter === 'below50' ? 'warning' : 'default'}
            variant={varianceFilter === 'below50' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`30-50% (${displaySummary.varianceCounts.below30})`}
            onClick={() => setVarianceFilter('below30')}
            color={varianceFilter === 'below30' ? 'error' : 'default'}
            variant={varianceFilter === 'below30' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`<30% (${displaySummary.varianceCounts.significantlyBelow30})`}
            onClick={() => setVarianceFilter('significantlyBelow30')}
            color={varianceFilter === 'significantlyBelow30' ? 'error' : 'default'}
            variant={varianceFilter === 'significantlyBelow30' ? 'filled' : 'outlined'}
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

      {/* Merchant Segment Filter Chips */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Merchant Segment
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`All (${Object.values(merchantSegmentCounts).reduce((a, b) => a + b, 0)})`}
            onClick={() => setMerchantSegmentFilter('all')}
            color={merchantSegmentFilter === 'all' ? 'primary' : 'default'}
            variant={merchantSegmentFilter === 'all' ? 'filled' : 'outlined'}
          />
          {/* Sort merchant segments in the specific order */}
          {['Strategic Enterprise', 'Enterprise', 'Mid-Market', 'SMB'].map(segment => (
            merchantSegmentCounts[segment] ? (
              <Chip
                key={segment}
                label={`${segment} (${merchantSegmentCounts[segment]})`}
                onClick={() => setMerchantSegmentFilter(segment)}
                color={merchantSegmentFilter === segment ? 'primary' : 'default'}
                variant={merchantSegmentFilter === segment ? 'filled' : 'outlined'}
              />
            ) : null
          ))}
          {/* Add any other segments that aren't in the main order */}
          {Object.entries(merchantSegmentCounts)
            .filter(([segment]) => !['Strategic Enterprise', 'Enterprise', 'Mid-Market', 'SMB'].includes(segment))
            .map(([segment, count]) => (
              <Chip
                key={segment}
                label={`${segment} (${count})`}
                onClick={() => setMerchantSegmentFilter(segment)}
                color={merchantSegmentFilter === segment ? 'primary' : 'default'}
                variant={merchantSegmentFilter === segment ? 'filled' : 'outlined'}
              />
            ))}
        </Box>
      </Box>

      {/* Record Type Filter Chips */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Opportunity Record Type
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`All (${Object.values(recordTypeCounts).reduce((a, b) => a + b, 0)})`}
            onClick={() => setRecordTypeFilter('all')}
            color={recordTypeFilter === 'all' ? 'primary' : 'default'}
            variant={recordTypeFilter === 'all' ? 'filled' : 'outlined'}
          />
          {['New Business', 'Existing'].map(recordType => (
            recordTypeCounts[recordType] ? (
              <Chip
                key={recordType}
                label={`${recordType} (${recordTypeCounts[recordType]})`}
                onClick={() => setRecordTypeFilter(recordType)}
                color={recordTypeFilter === recordType ? 'primary' : 'default'}
                variant={recordTypeFilter === recordType ? 'filled' : 'outlined'}
              />
            ) : null
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
            <MenuItem value="30-60">30-60 Days Live</MenuItem>
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
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              ACV Variance Summary by Pricing Model & Labels Paid By
            </Typography>
            <IconButton
              onClick={() => setPricingModelSummaryExpanded(!pricingModelSummaryExpanded)}
              size="small"
            >
              {pricingModelSummaryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Subtotals showing ACV variance distribution across different merchant segments
          </Typography>
          <Collapse in={pricingModelSummaryExpanded}>
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
                  <TableCell align="right"><strong>% of Original</strong></TableCell>
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
                              {group.variancePercent.toFixed(1)}%
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
                                 (stratifiedStats.sufficientTotals.totalProjectedNetAcv / stratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100 >= 0 ?
                                 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {stratifiedStats.sufficientTotals.totalOriginalNetAcv !== 0 ?
                            `${(((stratifiedStats.sufficientTotals.totalProjectedNetAcv / stratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
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
                            `${(((stratifiedStats.insufficientTotals.totalProjectedNetAcv / stratifiedStats.insufficientTotals.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
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
                               (displaySummary.totalProjectedNetAcv / displaySummary.totalOriginalNetAcv) * 100 >= 0 ?
                               'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {displaySummary.totalOriginalNetAcv !== 0 ?
                          `${(((displaySummary.totalProjectedNetAcv / displaySummary.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
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
          </Collapse>
        </CardContent>
      </Card>

      {/* Merchant Segment Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              ACV Variance Summary by Merchant Segment
            </Typography>
            <IconButton
              onClick={() => setMerchantSegmentSummaryExpanded(!merchantSegmentSummaryExpanded)}
              size="small"
            >
              {merchantSegmentSummaryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Merchant distribution and ACV impact across merchant segments
          </Typography>
          <Collapse in={merchantSegmentSummaryExpanded}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Merchant Segment</strong></TableCell>
                  <TableCell align="right"><strong>Merchants</strong></TableCell>
                  <TableCell align="right"><strong>Original Net ACV</strong></TableCell>
                  <TableCell align="right"><strong>Projected Net ACV</strong></TableCell>
                  <TableCell align="right"><strong>ACV Variance</strong></TableCell>
                  <TableCell align="right"><strong>% of Original</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Sufficient Data Groups */}
                {merchantSegmentStats.segmentStats.filter(group => group.dataType === 'sufficient').length > 0 && (
                  <>
                    <TableRow sx={{ backgroundColor: 'success.light', '& td': { fontWeight: 'bold', color: 'success.dark' } }}>
                      <TableCell colSpan={6} align="left">
                        <Typography variant="subtitle2" fontWeight="bold">
                          SUFFICIENT DATA MERCHANTS (Updated Projections)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {merchantSegmentStats.segmentStats
                      .filter(group => group.dataType === 'sufficient')
                      .map((group, index) => (
                        <TableRow
                          key={`${group.merchantSegment}-sufficient`}
                          sx={{
                            backgroundColor: index % 2 === 0 ? 'action.hover' : 'inherit',
                            '&:hover': { backgroundColor: 'action.selected' }
                          }}
                        >
                          <TableCell>
                            <Chip
                              label={group.merchantSegment}
                              size="small"
                              color={group.merchantSegment === 'Enterprise' ? 'primary' :
                                     group.merchantSegment === 'Strategic Enterprise' ? 'secondary' :
                                     group.merchantSegment === 'Mid-Market' ? 'info' : 'default'}
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
                              {group.variancePercent.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    {/* Sufficient Data Subtotal */}
                    {merchantSegmentStats.sufficientTotals && (
                      <TableRow sx={{ backgroundColor: 'success.light', '& td': { fontWeight: 'bold' } }}>
                        <TableCell><strong>SUFFICIENT DATA SUBTOTAL</strong></TableCell>
                        <TableCell align="right">{merchantSegmentStats.sufficientTotals.merchantCount}</TableCell>
                        <TableCell align="right">{formatCurrency(merchantSegmentStats.sufficientTotals.totalOriginalNetAcv)}</TableCell>
                        <TableCell align="right">{formatCurrency(merchantSegmentStats.sufficientTotals.totalProjectedNetAcv)}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                            {merchantSegmentStats.sufficientTotals.totalAcvVariance >= 0 ? (
                              <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                            ) : (
                              <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                            )}
                            <Typography
                              variant="body2"
                              color={merchantSegmentStats.sufficientTotals.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                              fontWeight="bold"
                            >
                              {formatCurrency(merchantSegmentStats.sufficientTotals.totalAcvVariance)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={merchantSegmentStats.sufficientTotals.totalOriginalNetAcv !== 0 &&
                                   (merchantSegmentStats.sufficientTotals.totalProjectedNetAcv / merchantSegmentStats.sufficientTotals.totalOriginalNetAcv) * 100 >= 0 ?
                                   'success.main' : 'error.main'}
                            fontWeight="bold"
                          >
                            {merchantSegmentStats.sufficientTotals.totalOriginalNetAcv !== 0 ?
                              `${((merchantSegmentStats.sufficientTotals.totalProjectedNetAcv / merchantSegmentStats.sufficientTotals.totalOriginalNetAcv) * 100).toFixed(1)}%` :
                              'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}

                {/* Insufficient Data Groups */}
                {merchantSegmentStats.segmentStats.filter(group => group.dataType === 'insufficient').length > 0 && (
                  <>
                    <TableRow sx={{ backgroundColor: 'grey.300', '& td': { fontWeight: 'bold', color: 'grey.800' } }}>
                      <TableCell colSpan={6} align="left">
                        <Typography variant="subtitle2" fontWeight="bold">
                          INSUFFICIENT DATA MERCHANTS (Original Projections)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {merchantSegmentStats.segmentStats
                      .filter(group => group.dataType === 'insufficient')
                      .map((group, index) => (
                        <TableRow
                          key={`${group.merchantSegment}-insufficient`}
                          sx={{
                            backgroundColor: index % 2 === 0 ? 'grey.200' : 'inherit',
                            '&:hover': { backgroundColor: 'action.selected' }
                          }}
                        >
                          <TableCell>
                            <Chip
                              label={group.merchantSegment}
                              size="small"
                              color="default"
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
                    {merchantSegmentStats.insufficientTotals && (
                      <TableRow sx={{ backgroundColor: 'grey.300', '& td': { fontWeight: 'bold' } }}>
                        <TableCell><strong>INSUFFICIENT DATA SUBTOTAL</strong></TableCell>
                        <TableCell align="right">{merchantSegmentStats.insufficientTotals.merchantCount}</TableCell>
                        <TableCell align="right">{formatCurrency(merchantSegmentStats.insufficientTotals.totalOriginalNetAcv)}</TableCell>
                        <TableCell align="right">{formatCurrency(merchantSegmentStats.insufficientTotals.totalProjectedNetAcv)}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" fontWeight="bold">
                            {formatCurrency(merchantSegmentStats.insufficientTotals.totalAcvVariance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" fontWeight="bold">
                            {merchantSegmentStats.insufficientTotals.totalOriginalNetAcv !== 0 ?
                              `${((merchantSegmentStats.insufficientTotals.totalProjectedNetAcv / merchantSegmentStats.insufficientTotals.totalOriginalNetAcv) * 100).toFixed(1)}%` :
                              'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}

                {/* Grand Total Row */}
                {(merchantSegmentStats.sufficientTotals || merchantSegmentStats.insufficientTotals) && displaySummary && (
                  <TableRow sx={{ backgroundColor: 'primary.light', '& td': { fontWeight: 'bold' } }}>
                    <TableCell><strong>GRAND TOTAL</strong></TableCell>
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
                               (displaySummary.totalProjectedNetAcv / displaySummary.totalOriginalNetAcv) * 100 >= 0 ?
                               'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {displaySummary.totalOriginalNetAcv !== 0 ?
                          `${(((displaySummary.totalProjectedNetAcv / displaySummary.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
                          'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {/* No Data Row */}
                {merchantSegmentStats.segmentStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available for current filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          </Collapse>
        </CardContent>
      </Card>

      {/* Opportunity Record Type Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              ACV Variance Summary by Opportunity Record Type
            </Typography>
            <IconButton
              onClick={() => setRecordTypeSummaryExpanded(!recordTypeSummaryExpanded)}
              size="small"
            >
              {recordTypeSummaryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            ACV impact comparison between New Business and Existing opportunities (Renewal, Mid-Term Change, etc.)
          </Typography>
          <Collapse in={recordTypeSummaryExpanded}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Record Type</strong></TableCell>
                  <TableCell align="right"><strong>Merchants</strong></TableCell>
                  <TableCell align="right"><strong>Original Net ACV</strong></TableCell>
                  <TableCell align="right"><strong>Projected Net ACV</strong></TableCell>
                  <TableCell align="right"><strong>ACV Variance</strong></TableCell>
                  <TableCell align="right"><strong>% of Original</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Sufficient Data Groups */}
                {opportunityRecordTypeStats.recordTypeStats.filter(group => group.dataType === 'sufficient').length > 0 && (
                  <>
                    <TableRow sx={{ backgroundColor: 'success.light', '& td': { fontWeight: 'bold', color: 'success.dark' } }}>
                      <TableCell colSpan={6} align="left">
                        <Typography variant="subtitle2" fontWeight="bold">
                          SUFFICIENT DATA MERCHANTS (Updated Projections)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {opportunityRecordTypeStats.recordTypeStats
                      .filter(group => group.dataType === 'sufficient')
                      .map((group, index) => (
                        <TableRow
                          key={`${group.recordTypeCategory}-sufficient`}
                          sx={{
                            backgroundColor: index % 2 === 0 ? 'action.hover' : 'inherit',
                            '&:hover': { backgroundColor: 'action.selected' }
                          }}
                        >
                          <TableCell>
                            <Chip
                              label={group.recordTypeCategory}
                              size="small"
                              color={group.recordTypeCategory === 'New Business' ? 'primary' : 'secondary'}
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
                              color={group.variancePercent >= 100 ? 'success.main' : 'error.main'}
                              fontWeight="medium"
                            >
                              {group.variancePercent.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    {/* Sufficient Data Subtotal */}
                    {opportunityRecordTypeStats.sufficientTotals && (
                      <TableRow sx={{ backgroundColor: 'success.light', '& td': { fontWeight: 'bold' } }}>
                        <TableCell><strong>SUFFICIENT DATA SUBTOTAL</strong></TableCell>
                        <TableCell align="right">{opportunityRecordTypeStats.sufficientTotals.merchantCount}</TableCell>
                        <TableCell align="right">{formatCurrency(opportunityRecordTypeStats.sufficientTotals.totalOriginalNetAcv)}</TableCell>
                        <TableCell align="right">{formatCurrency(opportunityRecordTypeStats.sufficientTotals.totalProjectedNetAcv)}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                            {opportunityRecordTypeStats.sufficientTotals.totalAcvVariance >= 0 ? (
                              <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                            ) : (
                              <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                            )}
                            <Typography
                              variant="body2"
                              color={opportunityRecordTypeStats.sufficientTotals.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                              fontWeight="bold"
                            >
                              {formatCurrency(opportunityRecordTypeStats.sufficientTotals.totalAcvVariance)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={opportunityRecordTypeStats.sufficientTotals.totalOriginalNetAcv !== 0 &&
                                   (opportunityRecordTypeStats.sufficientTotals.totalProjectedNetAcv / opportunityRecordTypeStats.sufficientTotals.totalOriginalNetAcv) * 100 >= 100 ?
                                   'success.main' : 'error.main'}
                            fontWeight="bold"
                          >
                            {opportunityRecordTypeStats.sufficientTotals.totalOriginalNetAcv !== 0 ?
                              `${((opportunityRecordTypeStats.sufficientTotals.totalProjectedNetAcv / opportunityRecordTypeStats.sufficientTotals.totalOriginalNetAcv) * 100).toFixed(1)}%` :
                              'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}

                {/* Insufficient Data Groups */}
                {opportunityRecordTypeStats.recordTypeStats.filter(group => group.dataType === 'insufficient').length > 0 && (
                  <>
                    <TableRow sx={{ backgroundColor: 'grey.300', '& td': { fontWeight: 'bold', color: 'grey.800' } }}>
                      <TableCell colSpan={6} align="left">
                        <Typography variant="subtitle2" fontWeight="bold">
                          INSUFFICIENT DATA MERCHANTS (Original Projections)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {opportunityRecordTypeStats.recordTypeStats
                      .filter(group => group.dataType === 'insufficient')
                      .map((group, index) => (
                        <TableRow
                          key={`${group.recordTypeCategory}-insufficient`}
                          sx={{
                            backgroundColor: index % 2 === 0 ? 'grey.200' : 'inherit',
                            '&:hover': { backgroundColor: 'action.selected' }
                          }}
                        >
                          <TableCell>
                            <Chip
                              label={group.recordTypeCategory}
                              size="small"
                              color="default"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">{group.merchantCount}</TableCell>
                          <TableCell align="right">{formatCurrency(group.totalOriginalNetAcv)}</TableCell>
                          <TableCell align="right">{formatCurrency(group.totalProjectedNetAcv)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary" fontWeight="medium">
                              {formatCurrency(group.totalAcvVariance)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary" fontWeight="medium">
                              {group.variancePercent.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    {/* Insufficient Data Subtotal */}
                    {opportunityRecordTypeStats.insufficientTotals && (
                      <TableRow sx={{ backgroundColor: 'grey.300', '& td': { fontWeight: 'bold' } }}>
                        <TableCell><strong>INSUFFICIENT DATA SUBTOTAL</strong></TableCell>
                        <TableCell align="right">{opportunityRecordTypeStats.insufficientTotals.merchantCount}</TableCell>
                        <TableCell align="right">{formatCurrency(opportunityRecordTypeStats.insufficientTotals.totalOriginalNetAcv)}</TableCell>
                        <TableCell align="right">{formatCurrency(opportunityRecordTypeStats.insufficientTotals.totalProjectedNetAcv)}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" fontWeight="bold">
                            {formatCurrency(opportunityRecordTypeStats.insufficientTotals.totalAcvVariance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" fontWeight="bold">
                            {opportunityRecordTypeStats.insufficientTotals.totalOriginalNetAcv !== 0 ?
                              `${((opportunityRecordTypeStats.insufficientTotals.totalProjectedNetAcv / opportunityRecordTypeStats.insufficientTotals.totalOriginalNetAcv) * 100).toFixed(1)}%` :
                              'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}

                {/* Grand Total Row */}
                {(opportunityRecordTypeStats.sufficientTotals || opportunityRecordTypeStats.insufficientTotals) && displaySummary && (
                  <TableRow sx={{ backgroundColor: 'primary.light', '& td': { fontWeight: 'bold' } }}>
                    <TableCell><strong>GRAND TOTAL</strong></TableCell>
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
                               (displaySummary.totalProjectedNetAcv / displaySummary.totalOriginalNetAcv) * 100 >= 100 ?
                               'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {displaySummary.totalOriginalNetAcv !== 0 ?
                          `${((displaySummary.totalProjectedNetAcv / displaySummary.totalOriginalNetAcv) * 100).toFixed(1)}%` :
                          'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {/* No Data Row */}
                {opportunityRecordTypeStats.recordTypeStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available for current filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          </Collapse>
        </CardContent>
      </Card>

      {/* Variance Magnitude Stratified Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              ACV Variance Summary by Performance Tier
            </Typography>
            <IconButton
              onClick={() => setPerformanceTierSummaryExpanded(!performanceTierSummaryExpanded)}
              size="small"
            >
              {performanceTierSummaryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Merchant distribution and ACV impact across performance variance tiers
          </Typography>
          <Collapse in={performanceTierSummaryExpanded}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Performance Tier</strong></TableCell>
                  <TableCell align="right"><strong>Merchants</strong></TableCell>
                  <TableCell align="right"><strong>Original Net ACV</strong></TableCell>
                  <TableCell align="right"><strong>Projected Net ACV</strong></TableCell>
                  <TableCell align="right"><strong>ACV Variance</strong></TableCell>
                  <TableCell align="right"><strong>% of Original</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Variance Tier Rows (only for merchants with sufficient data) */}
                {varianceStratifiedStats.tierStats.filter(tier => tier.tier !== 'insufficientData').map((tier, index) => (
                  <TableRow
                    key={tier.tier}
                    sx={{
                      backgroundColor: index % 2 === 0 ? 'action.hover' : 'inherit',
                      '&:hover': { backgroundColor: 'action.selected' }
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={tier.tierDisplay}
                        size="small"
                        color={tier.tierColor}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">{tier.merchantCount}</TableCell>
                    <TableCell align="right">{formatCurrency(tier.totalOriginalNetAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(tier.totalProjectedNetAcv)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {tier.totalAcvVariance >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                        <Typography
                          variant="body2"
                          color={tier.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                          fontWeight="medium"
                        >
                          {formatCurrency(tier.totalAcvVariance)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={tier.variancePercent >= 100 ? 'success.main' : 'error.main'}
                        fontWeight="medium"
                      >
                        {tier.variancePercent.toFixed(1)}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Subtotal Row for Sufficient Data */}
                {varianceStratifiedStats.sufficientTotals.merchantCount > 0 && (
                  <TableRow sx={{ backgroundColor: 'grey.100', '& td': { fontWeight: 'bold', borderTop: '2px solid', borderColor: 'divider' } }}>
                    <TableCell><strong>SUBTOTAL (Sufficient Data)</strong></TableCell>
                    <TableCell align="right">{varianceStratifiedStats.sufficientTotals.merchantCount}</TableCell>
                    <TableCell align="right">{formatCurrency(varianceStratifiedStats.sufficientTotals.totalOriginalNetAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(varianceStratifiedStats.sufficientTotals.totalProjectedNetAcv)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {varianceStratifiedStats.sufficientTotals.totalAcvVariance >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                        <Typography
                          variant="body2"
                          color={varianceStratifiedStats.sufficientTotals.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {formatCurrency(varianceStratifiedStats.sufficientTotals.totalAcvVariance)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={varianceStratifiedStats.sufficientTotals.totalOriginalNetAcv !== 0 &&
                               (varianceStratifiedStats.sufficientTotals.totalProjectedNetAcv / varianceStratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100 >= 100 ?
                               'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {varianceStratifiedStats.sufficientTotals.totalOriginalNetAcv !== 0 ?
                          `${(((varianceStratifiedStats.sufficientTotals.totalProjectedNetAcv / varianceStratifiedStats.sufficientTotals.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
                          'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {/* Insufficient Data Row */}
                {varianceStratifiedStats.insufficientTotals.merchantCount > 0 && (
                  <TableRow>
                    <TableCell>
                      <Chip
                        label="Insufficient Data"
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">{varianceStratifiedStats.insufficientTotals.merchantCount}</TableCell>
                    <TableCell align="right">{formatCurrency(varianceStratifiedStats.insufficientTotals.totalOriginalNetAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(varianceStratifiedStats.insufficientTotals.totalProjectedNetAcv)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {varianceStratifiedStats.insufficientTotals.totalAcvVariance >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                        <Typography
                          variant="body2"
                          color={varianceStratifiedStats.insufficientTotals.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                          fontWeight="medium"
                        >
                          {formatCurrency(varianceStratifiedStats.insufficientTotals.totalAcvVariance)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={varianceStratifiedStats.insufficientTotals.totalOriginalNetAcv !== 0 &&
                               (varianceStratifiedStats.insufficientTotals.totalProjectedNetAcv / varianceStratifiedStats.insufficientTotals.totalOriginalNetAcv) * 100 >= 100 ?
                               'success.main' : 'error.main'}
                        fontWeight="medium"
                      >
                        {varianceStratifiedStats.insufficientTotals.totalOriginalNetAcv !== 0 ?
                          `${(((varianceStratifiedStats.insufficientTotals.totalProjectedNetAcv / varianceStratifiedStats.insufficientTotals.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
                          'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {/* Grand Total Row */}
                {varianceStratifiedStats.tierStats.length > 0 && (
                  <TableRow sx={{ backgroundColor: 'primary.light', '& td': { fontWeight: 'bold', borderTop: '2px solid', borderColor: 'primary.main' } }}>
                    <TableCell><strong>TOTAL</strong></TableCell>
                    <TableCell align="right">{varianceStratifiedStats.totalMerchants}</TableCell>
                    <TableCell align="right">{formatCurrency(varianceStratifiedStats.totalOriginalNetAcv)}</TableCell>
                    <TableCell align="right">{formatCurrency(varianceStratifiedStats.totalProjectedNetAcv)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {varianceStratifiedStats.totalAcvVariance >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                        <Typography
                          variant="body2"
                          color={varianceStratifiedStats.totalAcvVariance >= 0 ? 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {formatCurrency(varianceStratifiedStats.totalAcvVariance)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={varianceStratifiedStats.totalOriginalNetAcv !== 0 &&
                               (varianceStratifiedStats.totalProjectedNetAcv / varianceStratifiedStats.totalOriginalNetAcv) * 100 >= 100 ?
                               'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {varianceStratifiedStats.totalOriginalNetAcv !== 0 ?
                          `${(((varianceStratifiedStats.totalProjectedNetAcv / varianceStratifiedStats.totalOriginalNetAcv) * 100)).toFixed(1)}%` :
                          'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {/* No Data Row */}
                {varianceStratifiedStats.tierStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available for current filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          </Collapse>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Merchant ACV Impacts ({filteredData.length} merchants{excludedMerchants.size > 0 && `, ${excludedMerchants.size} excluded`})
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
                  <TableCell align="right">Original Ending ACV</TableCell>
                  <TableCell align="right">Projected Ending ACV</TableCell>
                  <TableCell align="right">Original Net ACV</TableCell>
                  <TableCell align="right">Projected Net ACV</TableCell>
                  <TableCell align="right">ACV Variance</TableCell>
                  <TableCell align="center">% of Original</TableCell>
                  <TableCell align="center">Performance Tier</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Total Row */}
                {(() => {
                  const nonExcludedData = filteredData.filter(row => !excludedMerchants.has(row.accountId));
                  const totals = nonExcludedData.reduce((acc, row) => ({
                    merchantCount: acc.merchantCount + 1,
                    totalDaysLive: acc.totalDaysLive + row.daysLive,
                    totalOriginalEndingAcv: acc.totalOriginalEndingAcv + row.originalEndingAcv,
                    totalProjectedEndingAcv: acc.totalProjectedEndingAcv + row.projectedEndingAcv,
                    totalOriginalNetAcv: acc.totalOriginalNetAcv + row.originalNetAcv,
                    totalProjectedNetAcv: acc.totalProjectedNetAcv + row.projectedNetAcv,
                    totalAcvVariance: acc.totalAcvVariance + row.acvVariance
                  }), {
                    merchantCount: 0,
                    totalDaysLive: 0,
                    totalOriginalEndingAcv: 0,
                    totalProjectedEndingAcv: 0,
                    totalOriginalNetAcv: 0,
                    totalProjectedNetAcv: 0,
                    totalAcvVariance: 0
                  });

                  const avgDaysLive = totals.merchantCount > 0 ? Math.round(totals.totalDaysLive / totals.merchantCount) : 0;
                  const variancePercent = totals.totalOriginalNetAcv !== 0 ?
                    ((totals.totalProjectedNetAcv / totals.totalOriginalNetAcv) * 100) : 0;

                  return totals.merchantCount > 0 ? (
                    <TableRow
                      sx={{
                        backgroundColor: 'grey.100',
                        '& .MuiTableCell-root': { fontWeight: 'bold' }
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Typography variant="caption" fontWeight="bold" color="text.primary">
                          TOTAL
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {totals.merchantCount} merchants
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {avgDaysLive} avg
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {formatCurrency(totals.totalOriginalEndingAcv)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {formatCurrency(totals.totalProjectedEndingAcv)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {formatCurrency(totals.totalOriginalNetAcv)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="text.primary">
                          {formatCurrency(totals.totalProjectedNetAcv)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          {totals.totalAcvVariance >= 0 ? (
                            <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                          ) : (
                            <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                          )}
                          <Typography
                            variant="body2"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {totals.totalAcvVariance >= 0 ? '+' : ''}{formatCurrency(totals.totalAcvVariance)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          color="text.primary"
                          fontWeight="bold"
                        >
                          {variancePercent.toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          color="text.primary"
                          fontWeight="bold"
                        >
                          {totals.merchantCount} merchants
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null;
                })()}

                {filteredData.map((row) => (
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
                      {renderMerchantWithLinks(
                        row.merchantName,
                        row.accountId,
                        row.opportunityId,
                        `${row.merchantSegment || 'Unknown'} • ${row.pricingModel} • ${row.labelsPaidBy === 'Loop' ? 'LPL' : 'MPL'}`
                      )}
                    </TableCell>
                    <TableCell align="right">{row.daysLive}</TableCell>
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
                        />
                        {row.pricingModel !== 'Flat' && row.daysLive > 28 && !row.hasSufficientData ? (
                          <Tooltip title="Rev Share merchant live >4 weeks but insufficient performance data - may have stopped using service">
                            <WarningIcon color="error" fontSize="small" />
                          </Tooltip>
                        ) : !row.hasSufficientData && Math.abs(row.acvVariancePercent - 100) < 0.1 && (
                          <Tooltip title="Variance is 100% due to insufficient performance data - using original projected values">
                            <WarningIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={(() => {
                          if (!row.hasSufficientData) {
                            return 'Insufficient Data';
                          }
                          const tier = getVarianceTier(row.acvVariancePercent);
                          switch (tier) {
                            case 'exceeding100': return '>100%';
                            case 'meeting80': return '80-100%';
                            case 'below50': return '50-80%';
                            case 'below30': return '30-50%';
                            case 'significantlyBelow30': return '<30%';
                            default: return 'N/A';
                          }
                        })()}
                        size="small"
                        color={(() => {
                          if (!row.hasSufficientData) {
                            return 'secondary';
                          }
                          const tier = getVarianceTier(row.acvVariancePercent);
                          switch (tier) {
                            case 'exceeding100': return 'success';
                            case 'meeting80': return 'primary';
                            case 'below50': return 'warning';
                            case 'below30': return 'error';
                            case 'significantlyBelow30': return 'error';
                            default: return 'default';
                          }
                        })()}
                        variant="outlined"
                      />
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