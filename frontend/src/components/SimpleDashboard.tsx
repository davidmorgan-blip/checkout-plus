import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Alert,
  Paper,
  LinearProgress,
  Chip,
  CircularProgress,
  Link,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PerformanceOverview from './PerformanceOverview';
import VolumeAnalysis from './VolumeAnalysis';
import NetRevenueAnalysis from './NetRevenueAnalysis';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface UploadStatus {
  opportunities: number;
  opportunitiesLastUpdated?: string | null;
  performanceRecords: number;
  performanceWeeks: number;
  performanceLastUpdated?: string | null;
  seasonalityCurves: number;
  seasonalityVerticals: number;
  seasonalityLastUpdated?: string | null;
}

interface OpportunitiesBreakdown {
  totalOpportunities: number;
  opportunitiesWithActuals: number;
  opportunitiesWithoutActuals: number;
}

interface FileUploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  success: boolean;
  error: string | null;
}

export default function SimpleDashboard() {
  const [tabValue, setTabValue] = useState(0); // Start with Net Revenue tab (will fallback to Data Upload if disabled)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    opportunities: 0,
    performanceRecords: 0,
    performanceWeeks: 0,
    seasonalityCurves: 0,
    seasonalityVerticals: 0,
  });

  const [opportunitiesBreakdown, setOpportunitiesBreakdown] = useState<OpportunitiesBreakdown>({
    totalOpportunities: 0,
    opportunitiesWithActuals: 0,
    opportunitiesWithoutActuals: 0,
  });

  const [opportunitiesUpload, setOpportunitiesUpload] = useState<FileUploadState>({
    file: null,
    uploading: false,
    progress: 0,
    success: false,
    error: null,
  });

  const [performanceUpload, setPerformanceUpload] = useState<FileUploadState>({
    file: null,
    uploading: false,
    progress: 0,
    success: false,
    error: null,
  });

  const [seasonalityUpload, setSeasonalityUpload] = useState<FileUploadState>({
    file: null,
    uploading: false,
    progress: 0,
    success: false,
    error: null,
  });

  const fetchUploadStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/upload/status');
      const result = await response.json();
      if (result.success) {
        setUploadStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch upload status:', error);
    }
  };

  const fetchOpportunitiesBreakdown = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/analytics/overview');
      const result = await response.json();
      if (result.success && result.data.metrics) {
        setOpportunitiesBreakdown({
          totalOpportunities: result.data.metrics.totalOpportunities || 0,
          opportunitiesWithActuals: result.data.metrics.opportunitiesWithActuals || 0,
          opportunitiesWithoutActuals: result.data.metrics.opportunitiesWithoutActuals || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch opportunities breakdown:', error);
    }
  };

  useEffect(() => {
    fetchUploadStatus();
  }, []);

  // Check if all data is loaded
  const dataLoaded = uploadStatus.opportunities > 0 &&
                     uploadStatus.performanceRecords > 0 &&
                     uploadStatus.seasonalityCurves > 0;

  // Set default tab based on data loaded status
  useEffect(() => {
    if (!dataLoaded && tabValue !== 3) {
      // If no data and we're not on Data Upload tab, switch to Data Upload
      setTabValue(3);
    } else if (dataLoaded && tabValue === 3) {
      // When data becomes available and we're on Data Upload tab, switch to Net Revenue
      setTabValue(0);
    }
  }, [dataLoaded, tabValue]);

  // Fetch opportunities breakdown when data is loaded
  useEffect(() => {
    if (dataLoaded) {
      fetchOpportunitiesBreakdown();
    }
  }, [dataLoaded]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const uploadFile = async (file: File, endpoint: string, setUploadState: React.Dispatch<React.SetStateAction<FileUploadState>>) => {
    setUploadState(prev => ({
      ...prev,
      uploading: true,
      progress: 0,
      error: null,
      success: false,
    }));

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch(`http://localhost:3001/api/upload/${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadState(prev => ({
          ...prev,
          uploading: false,
          progress: 100,
          success: true,
        }));
        await fetchUploadStatus(); // Refresh the status
      } else {
        setUploadState(prev => ({
          ...prev,
          uploading: false,
          error: result.error || 'Upload failed',
        }));
      }
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: 'Network error during upload',
      }));
    }
  };

  const handleFileDrop = useCallback((acceptedFiles: File[], endpoint: string, setUploadState: React.Dispatch<React.SetStateAction<FileUploadState>>) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'text/csv') {
      setUploadState(prev => ({
        ...prev,
        file,
        error: null,
      }));
      uploadFile(file, endpoint, setUploadState);
    } else {
      setUploadState(prev => ({
        ...prev,
        error: 'Please select a valid CSV file',
      }));
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const DropZone = ({
    title,
    description,
    uploadState,
    onDrop,
    recordCount
  }: {
    title: string;
    description: React.ReactNode;
    uploadState: FileUploadState;
    onDrop: (e: React.DragEvent) => void;
    recordCount: number;
  }) => {
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const fakeDropEvent = {
          preventDefault: () => {},
          dataTransfer: { files: Array.from(files) }
        } as any;
        onDrop(fakeDropEvent);
      }
    };

    return (
      <Paper
        sx={{
          p: 3,
          border: '2px dashed',
          borderColor: uploadState.success ? 'success.main' : uploadState.error ? 'error.main' : 'grey.400',
          backgroundColor: uploadState.success ? 'success.light' : uploadState.error ? 'error.light' : 'grey.50',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'primary.light',
            opacity: 0.8,
          },
        }}
        onDrop={onDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id={`file-input-${title.replace(/\s+/g, '-').toLowerCase()}`}
        />
        <label htmlFor={`file-input-${title.replace(/\s+/g, '-').toLowerCase()}`} style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
          <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
            {uploadState.success ? (
              <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
            ) : uploadState.uploading ? (
              <CircularProgress sx={{ mb: 2 }} />
            ) : (
              <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
            )}

            <Typography variant="h6" gutterBottom>
              {title}
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              {description}
            </Typography>

            {uploadState.file && (
              <Chip
                label={uploadState.file.name}
                color="primary"
                variant="outlined"
                sx={{ mb: 1 }}
              />
            )}

            {uploadState.uploading && (
              <Box sx={{ width: '100%', mb: 2 }}>
                <LinearProgress variant="indeterminate" />
                <Typography variant="caption" color="textSecondary">
                  Uploading...
                </Typography>
              </Box>
            )}

            {uploadState.success && (
              <Alert severity="success" sx={{ mt: 1 }}>
                Successfully uploaded! {recordCount} records loaded.
              </Alert>
            )}

            {uploadState.error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {uploadState.error}
              </Alert>
            )}

            {!uploadState.file && !uploadState.uploading && (
              <Typography variant="caption" color="textSecondary">
                Drag & drop CSV file here or click to browse
              </Typography>
            )}
          </Box>
        </label>
      </Paper>
    );
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ backgroundColor: '#1976d2' }}>
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Checkout+ Business Performance Dashboard
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {dataLoaded ? `${uploadStatus.opportunities} merchants` : 'No data loaded'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2 }}>
        {/* Quick Stats Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Opportunities
                  </Typography>
                  <Typography variant="h4">
                    {opportunitiesBreakdown.totalOpportunities || uploadStatus.opportunities}
                  </Typography>
                  {opportunitiesBreakdown.totalOpportunities > 0 && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                      {opportunitiesBreakdown.opportunitiesWithActuals} with actuals • {opportunitiesBreakdown.opportunitiesWithoutActuals} pending launch
                    </Typography>
                  )}
                  {uploadStatus.opportunitiesLastUpdated && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                      Updated on {new Date(uploadStatus.opportunitiesLastUpdated).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
                <TrendingUpIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Performance Records
                  </Typography>
                  <Typography variant="h4">
                    {uploadStatus.performanceRecords}
                  </Typography>
                  {uploadStatus.performanceWeeks > 0 && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                      {uploadStatus.performanceWeeks} distinct weeks of data
                    </Typography>
                  )}
                  {uploadStatus.performanceLastUpdated && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                      Updated on {new Date(uploadStatus.performanceLastUpdated).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
                <AnalyticsIcon color="secondary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Seasonality Curves
                  </Typography>
                  <Typography variant="h6">
                    {uploadStatus.seasonalityCurves > 0 && uploadStatus.seasonalityLastUpdated
                      ? `Updated on ${new Date(uploadStatus.seasonalityLastUpdated).toLocaleDateString()}`
                      : 'Not available'}
                  </Typography>
                  {uploadStatus.seasonalityVerticals > 0 && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                      {uploadStatus.seasonalityVerticals} verticals represented*
                    </Typography>
                  )}
                  {uploadStatus.seasonalityVerticals > 0 && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.25, display: 'block', fontSize: '0.65rem', fontStyle: 'italic' }}>
                      *Only Swimwear uses specific curve; all others use "Total ex. Swimwear"
                    </Typography>
                  )}
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
                    Data Status
                  </Typography>
                  <Typography variant="h6" color={dataLoaded ? 'success.main' : 'warning.main'}>
                    {dataLoaded ? 'Ready' : 'Incomplete'}
                  </Typography>
                </Box>
                {dataLoaded ? (
                  <DashboardIcon color="success" sx={{ fontSize: 40 }} />
                ) : (
                  <WarningIcon color="warning" sx={{ fontSize: 40 }} />
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Main Content Tabs */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="dashboard tabs">
              <Tab
                icon={<AttachMoneyIcon />}
                label="Net Revenue"
                id="dashboard-tab-0"
                aria-controls="dashboard-tabpanel-0"
                disabled={!dataLoaded}
              />
              <Tab
                icon={<ShowChartIcon />}
                label="Volume"
                id="dashboard-tab-1"
                aria-controls="dashboard-tabpanel-1"
                disabled={!dataLoaded}
              />
              <Tab
                icon={<TrendingUpIcon />}
                label="Adoption Rate"
                id="dashboard-tab-2"
                aria-controls="dashboard-tabpanel-2"
                disabled={!dataLoaded}
              />
              <Tab
                icon={<UploadFileIcon />}
                label="Data Upload"
                id="dashboard-tab-3"
                aria-controls="dashboard-tabpanel-3"
              />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <NetRevenueAnalysis />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <VolumeAnalysis />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <PerformanceOverview />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Typography variant="h5" gutterBottom>
              CSV Data Upload
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              Upload your CSV files to populate the dashboard with Checkout+ performance data.
              Drag and drop files or click to browse.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              <Box sx={{ flex: 1 }}>
                <DropZone
                  title="Salesforce Opportunities"
                  description={
                    <>
                      Upload opportunities CSV with merchant deal projections and contract details. {' '}
                      <Link
                        href="https://loopreturn.lightning.force.com/lightning/r/Report/00OV5000002d6KXMAY/view?queryScope=userFolders"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="primary"
                      >
                        View source report
                      </Link>
                    </>
                  }
                  uploadState={opportunitiesUpload}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files);
                    handleFileDrop(files, 'opportunities', setOpportunitiesUpload);
                  }}
                  recordCount={uploadStatus.opportunities}
                />
              </Box>

              <Box sx={{ flex: 1 }}>
                <DropZone
                  title="Performance Actuals"
                  description={
                    <>
                      Upload weekly performance data with actual adoption rates and order volumes. {' '}
                      <Link
                        href="https://app.hex.tech/loopreturns/hex/CO-Dashboard-Performance-Actuals-0319Ae9zBCUBtH9lrqFN5L/draft/logic"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="primary"
                      >
                        View source dashboard
                      </Link>
                    </>
                  }
                  uploadState={performanceUpload}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files);
                    handleFileDrop(files, 'performance', setPerformanceUpload);
                  }}
                  recordCount={uploadStatus.performanceRecords}
                />
              </Box>

              <Box sx={{ flex: 1 }}>
                <DropZone
                  title="Order Seasonality"
                  description={
                    <>
                      Upload seasonality curves showing expected order distribution by week and vertical. {' '}
                      <Link
                        href="https://docs.google.com/spreadsheets/d/1nc9vrCpDVG2_oIhQ6qpw2ofnMIFnwtPcCvmSMlNhXfI/edit?gid=0#gid=0"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="primary"
                      >
                        View source spreadsheet
                      </Link>
                    </>
                  }
                  uploadState={seasonalityUpload}
                  onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files);
                    handleFileDrop(files, 'seasonality', setSeasonalityUpload);
                  }}
                  recordCount={uploadStatus.seasonalityCurves}
                />
              </Box>
            </Box>

            {dataLoaded && (
              <Alert severity="success" sx={{ mt: 3 }}>
                All CSV files have been successfully uploaded! You can now access the Performance and Volume analysis tabs.
              </Alert>
            )}
          </TabPanel>
        </Card>
      </Container>
    </Box>
  );
}