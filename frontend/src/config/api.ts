const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  
  const replitDomain = process.env.REACT_APP_REPLIT_DEV_DOMAIN;
  if (replitDomain) {
    return `https://${replitDomain}:3001`;
  }
  
  return 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  ANALYTICS_OVERVIEW: `${API_BASE_URL}/api/analytics/overview`,
  ANALYTICS_MERCHANTS: `${API_BASE_URL}/api/analytics/merchants`,
  ANALYTICS_VOLUME: `${API_BASE_URL}/api/analytics/volume`,
  ACV_IMPACTS: `${API_BASE_URL}/api/analytics/acv-impacts`,
  NET_REVENUE: `${API_BASE_URL}/api/net-revenue/net-revenue`,
  NET_REVENUE_EXPORT: `${API_BASE_URL}/api/net-revenue/net-revenue/export`,
  UPLOAD_STATUS: `${API_BASE_URL}/api/upload/status`,
  UPLOAD_OPPORTUNITIES: `${API_BASE_URL}/api/upload/opportunities`,
  UPLOAD_PERFORMANCE: `${API_BASE_URL}/api/upload/performance`,
  UPLOAD_SEASONALITY: `${API_BASE_URL}/api/upload/seasonality`,
};
