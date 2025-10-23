const API_BASE_URL = 'http://localhost:5000';

export interface HealthData {
  status: string;
  total_requests: number;
  error_rate: number;
}

export interface EndpointMetric {
  total_requests: number;
  average_latency: number;
  error_rate: number;
}

export interface EndpointMetrics {
  [endpoint: string]: EndpointMetric;
}

export interface RequestLog {
  timestamp: string;
  endpoint: string;
  method: string;
  status_code: number;
  latency: number;
}

export interface DashboardData {
  health: HealthData;
  metrics: EndpointMetrics;
  recent: RequestLog[];
}

// Fetch health data from /health endpoint
export const fetchHealth = async (): Promise<HealthData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching health data:', error);
    throw error;
  }
};

// Fetch metrics data from /metrics endpoint
export const fetchMetrics = async (): Promise<EndpointMetrics> => {
  try {
    const response = await fetch(`${API_BASE_URL}/metrics`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching metrics data:', error);
    throw error;
  }
};

// Fetch recent metrics from /metrics/recent endpoint
export const fetchRecentMetrics = async (): Promise<RequestLog[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/metrics/recent`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching recent metrics data:', error);
    throw error;
  }
};

// Fetch all dashboard data
export const fetchDashboardData = async (): Promise<DashboardData> => {
  try {
    const [health, metrics, recent] = await Promise.all([
      fetchHealth(),
      fetchMetrics(),
      fetchRecentMetrics()
    ]);
    
    return { health, metrics, recent };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};