import { EndpointData, EndpointsTable } from "@/components/EndpointsTable";
import { LatencyChart } from "@/components/LatencyChart";
import { MetricCard } from "@/components/MetricCard";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { RequestsChart } from "@/components/RequestsChart";
import { ThemeSelector } from "@/components/ThemeSelector";
import { fetchDashboardData } from "@/services/api";
import { Activity, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const Index = () => {
  const [data, setData] = useState<{
    endpoints: EndpointData[];
    requestTrends: Array<{ time: string; requests: number; errors: number }>;
    latencyData: Array<{ endpoint: string; latency: number }>;
    health: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const dashboardData = await fetchDashboardData();
      
      // Transform metrics data for endpoints table
      const endpoints: EndpointData[] = Object.entries(dashboardData.metrics).map(([endpointKey, metrics], index) => {
        const [method, path] = endpointKey.split(' ');
        return {
          id: index.toString(),
          endpoint: path || endpointKey,
          method: method || 'GET',
          requests: metrics.total_requests,
          avgLatency: metrics.average_latency,
          errorRate: metrics.error_rate,
        };
      });
      
      // Transform recent data for request trends chart
      const recentData = dashboardData.recent.slice(-12);
      const requestTrends = recentData.map(log => ({
        time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        requests: log.status_code < 400 ? 1 : 0,
        errors: log.status_code >= 400 ? 1 : 0,
      }));
      
      // Transform data for latency chart
      const latencyData = endpoints
        .slice(0, 6)
        .map(endpoint => ({
          endpoint: endpoint.endpoint.split('/').pop() || endpoint.endpoint,
          latency: endpoint.avgLatency,
        }));
      
      setData({
        endpoints,
        requestTrends,
        latencyData,
        health: dashboardData.health
      });
    } catch (err) {
      setError('Failed to fetch data from the backend. Please ensure the server is running on http://localhost:5000');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchData();
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-card rounded-lg border border-destructive">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">No data available</p>
      </div>
    );
  }

  const totalRequests = data.endpoints.reduce((sum, e) => sum + e.requests, 0);
  const avgLatency = data.endpoints.length > 0 
    ? Math.round(data.endpoints.reduce((sum, e) => sum + e.avgLatency, 0) / data.endpoints.length)
    : 0;
  const avgErrorRate = data.endpoints.length > 0
    ? (data.endpoints.reduce((sum, e) => sum + e.errorRate, 0) / data.endpoints.length).toFixed(2)
    : "0.00";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Canner API Monitoring Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time performance metrics and analytics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSelector />
              <RefreshIndicator interval={30} onRefresh={refreshData} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Metrics Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <MetricCard
            title="Total Requests"
            value={totalRequests.toLocaleString()}
            icon={Activity}
            variant="default"
          />
          <MetricCard
            title="Avg Response Time"
            value={`${avgLatency}ms`}
            icon={Clock}
            variant="success"
          />
          <MetricCard
            title="Error Rate"
            value={`${avgErrorRate}%`}
            icon={AlertTriangle}
            variant={parseFloat(avgErrorRate) > 5 ? "destructive" : "warning"}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <RequestsChart data={data.requestTrends} />
          <LatencyChart data={data.latencyData} />
        </div>

        {/* Endpoints Table */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">API Endpoints</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Performance breakdown by endpoint
            </p>
          </div>
          <EndpointsTable data={data.endpoints} />
        </div>
      </main>
    </div>
  );
};

export default Index;