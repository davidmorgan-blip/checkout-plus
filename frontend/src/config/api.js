// API Configuration for Checkout+ Dashboard
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export const API_ENDPOINTS = {
  // Upload endpoints
  UPLOAD_STATUS: `${API_BASE_URL}/api/upload/status`,
  UPLOAD_OPPORTUNITIES: `${API_BASE_URL}/api/upload/opportunities`,
  UPLOAD_PERFORMANCE: `${API_BASE_URL}/api/upload/performance`,
  UPLOAD_SEASONALITY: `${API_BASE_URL}/api/upload/seasonality`,

  // Analytics endpoints
  ANALYTICS_OVERVIEW: `${API_BASE_URL}/api/analytics/overview`,
  ANALYTICS_VOLUME: `${API_BASE_URL}/api/analytics/volume`,
  ANALYTICS_MERCHANTS: `${API_BASE_URL}/api/analytics/merchants`,

  // Net Revenue endpoints
  NET_REVENUE: `${API_BASE_URL}/api/net-revenue/net-revenue`,
  NET_REVENUE_EXPORT: `${API_BASE_URL}/api/net-revenue/net-revenue/export`,
  ACV_IMPACTS: `${API_BASE_URL}/api/net-revenue/acv-impacts`
};

export { API_BASE_URL };