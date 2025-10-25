"""
Advanced analytics service for Canner
Tracks usage patterns, performance metrics, and user behavior
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict


@dataclass
class UsageMetric:
    """Represents a usage metric data point"""
    metric_name: str
    value: float
    timestamp: datetime
    metadata: Dict = None


class AnalyticsService:
    """Service for tracking and analyzing response usage patterns"""
    
    def __init__(self, db_connection_func):
        self.get_db_connection = db_connection_func
    
    def track_response_usage(self, response_id: str, action: str, platform: str = None, user_agent: str = None):
        """Track when a response is used"""
        conn = self.get_db_connection()
        
        try:
            # Create usage tracking table if it doesn't exist
            if self._is_postgres():
                create_table_query = """
                    CREATE TABLE IF NOT EXISTS response_usage (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        response_id UUID REFERENCES responses(id) ON DELETE CASCADE,
                        action VARCHAR(50) NOT NULL,
                        platform VARCHAR(50),
                        user_agent TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """
            else:
                create_table_query = """
                    CREATE TABLE IF NOT EXISTS response_usage (
                        id TEXT PRIMARY KEY,
                        response_id TEXT,
                        action TEXT NOT NULL,
                        platform TEXT,
                        user_agent TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """
            
            self._execute_query(conn, create_table_query)
            
            # Insert usage record
            if self._is_postgres():
                insert_query = """
                    INSERT INTO response_usage (response_id, action, platform, user_agent)
                    VALUES (%s, %s, %s, %s)
                """
            else:
                import uuid
                usage_id = str(uuid.uuid4())
                insert_query = """
                    INSERT INTO response_usage (id, response_id, action, platform, user_agent)
                    VALUES (?, ?, ?, ?, ?)
                """
                
            params = (response_id, action, platform, user_agent)
            if not self._is_postgres():
                params = (usage_id,) + params
                
            self._execute_query(conn, insert_query, params)
            
        except Exception as e:
            logging.error(f"Failed to track usage: {e}")
        finally:
            conn.close()
    
    def get_response_analytics(self, days: int = 30) -> Dict:
        """Get comprehensive analytics for responses"""
        conn = self.get_db_connection()
        
        try:
            analytics = {
                "period_days": days,
                "generated_at": datetime.now().isoformat(),
                "overview": self._get_overview_stats(conn, days),
                "top_responses": self._get_top_responses(conn, days),
                "platform_breakdown": self._get_platform_breakdown(conn, days),
                "usage_trends": self._get_usage_trends(conn, days),
                "tag_analytics": self._get_tag_analytics(conn, days)
            }
            
            return analytics
            
        except Exception as e:
            logging.error(f"Analytics generation failed: {e}")
            return {"error": str(e)}
        finally:
            conn.close()
    
    def _get_overview_stats(self, conn, days: int) -> Dict:
        """Get high-level overview statistics"""
        if self._is_postgres():
            query = """
                SELECT 
                    COUNT(DISTINCT r.id) as total_responses,
                    COUNT(DISTINCT ru.id) as total_usage_events,
                    COUNT(DISTINCT CASE WHEN r.created_at >= NOW() - INTERVAL '%s days' THEN r.id END) as new_responses,
                    COUNT(DISTINCT CASE WHEN ru.created_at >= NOW() - INTERVAL '%s days' THEN ru.id END) as recent_usage,
                    AVG(LENGTH(r.content)) as avg_content_length,
                    COUNT(DISTINCT ru.platform) as platforms_used
                FROM responses r
                LEFT JOIN response_usage ru ON r.id = ru.response_id
            """
            params = (days, days)
        else:
            query = """
                SELECT 
                    COUNT(DISTINCT r.id) as total_responses,
                    COUNT(DISTINCT ru.id) as total_usage_events,
                    AVG(LENGTH(r.content)) as avg_content_length
                FROM responses r
                LEFT JOIN response_usage ru ON r.id = ru.response_id
            """
            params = ()
        
        result = self._execute_query(conn, query, params)
        return dict(result[0]) if result else {}
    
    def _get_top_responses(self, conn, days: int, limit: int = 10) -> List[Dict]:
        """Get most frequently used responses"""
        if self._is_postgres():
            query = """
                SELECT 
                    r.id, r.title, r.content, r.tags,
                    COUNT(ru.id) as usage_count,
                    COUNT(DISTINCT ru.platform) as platforms_used,
                    MAX(ru.created_at) as last_used
                FROM responses r
                LEFT JOIN response_usage ru ON r.id = ru.response_id
                WHERE ru.created_at >= NOW() - INTERVAL '%s days' OR ru.created_at IS NULL
                GROUP BY r.id, r.title, r.content, r.tags
                ORDER BY usage_count DESC, r.created_at DESC
                LIMIT %s
            """
            params = (days, limit)
        else:
            query = """
                SELECT 
                    r.id, r.title, r.content, r.tags,
                    COUNT(ru.id) as usage_count
                FROM responses r
                LEFT JOIN response_usage ru ON r.id = ru.response_id
                GROUP BY r.id, r.title, r.content, r.tags
                ORDER BY usage_count DESC, r.created_at DESC
                LIMIT ?
            """
            params = (limit,)
        
        results = self._execute_query(conn, query, params)
        return [dict(row) for row in results] if results else []
    
    def _get_platform_breakdown(self, conn, days: int) -> List[Dict]:
        """Get usage breakdown by platform"""
        if self._is_postgres():
            query = """
                SELECT 
                    COALESCE(platform, 'unknown') as platform,
                    COUNT(*) as usage_count,
                    COUNT(DISTINCT response_id) as unique_responses
                FROM response_usage
                WHERE created_at >= NOW() - INTERVAL '%s days'
                GROUP BY platform
                ORDER BY usage_count DESC
            """
            params = (days,)
        else:
            query = """
                SELECT 
                    COALESCE(platform, 'unknown') as platform,
                    COUNT(*) as usage_count,
                    COUNT(DISTINCT response_id) as unique_responses
                FROM response_usage
                GROUP BY platform
                ORDER BY usage_count DESC
            """
            params = ()
        
        results = self._execute_query(conn, query, params)
        return [dict(row) for row in results] if results else []
    
    def _get_usage_trends(self, conn, days: int) -> List[Dict]:
        """Get daily usage trends"""
        if self._is_postgres():
            query = """
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as usage_count,
                    COUNT(DISTINCT response_id) as unique_responses,
                    COUNT(DISTINCT platform) as platforms_used
                FROM response_usage
                WHERE created_at >= NOW() - INTERVAL '%s days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            """
            params = (days,)
        else:
            query = """
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as usage_count,
                    COUNT(DISTINCT response_id) as unique_responses
                FROM response_usage
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT ?
            """
            params = (days,)
        
        results = self._execute_query(conn, query, params)
        return [dict(row) for row in results] if results else []
    
    def _get_tag_analytics(self, conn, days: int) -> List[Dict]:
        """Get analytics for response tags"""
        if self._is_postgres():
            query = """
                SELECT 
                    tag,
                    COUNT(*) as response_count,
                    SUM(usage_stats.usage_count) as total_usage
                FROM (
                    SELECT 
                        r.id,
                        jsonb_array_elements_text(r.tags) as tag,
                        COUNT(ru.id) as usage_count
                    FROM responses r
                    LEFT JOIN response_usage ru ON r.id = ru.response_id
                    WHERE ru.created_at >= NOW() - INTERVAL '%s days' OR ru.created_at IS NULL
                    GROUP BY r.id, tag
                ) usage_stats
                GROUP BY tag
                ORDER BY total_usage DESC, response_count DESC
                LIMIT 20
            """
            params = (days,)
        else:
            # Simplified version for SQLite
            query = """
                SELECT 
                    'tag_analysis' as tag,
                    COUNT(*) as response_count,
                    0 as total_usage
                FROM responses
                LIMIT 1
            """
            params = ()
        
        results = self._execute_query(conn, query, params)
        return [dict(row) for row in results] if results else []
    
    def export_analytics_data(self, format: str = "json", days: int = 30) -> str:
        """Export analytics data in specified format"""
        analytics = self.get_response_analytics(days)
        
        if format.lower() == "json":
            return json.dumps(analytics, indent=2, default=str)
        elif format.lower() == "csv":
            return self._convert_to_csv(analytics)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _convert_to_csv(self, analytics: Dict) -> str:
        """Convert analytics data to CSV format"""
        import csv
        import io
        
        output = io.StringIO()
        
        # Write overview stats
        writer = csv.writer(output)
        writer.writerow(["Metric", "Value"])
        
        for key, value in analytics.get("overview", {}).items():
            writer.writerow([key, value])
        
        writer.writerow([])  # Empty row
        writer.writerow(["Top Responses"])
        writer.writerow(["Title", "Usage Count", "Platforms Used"])
        
        for response in analytics.get("top_responses", []):
            writer.writerow([
                response.get("title", ""),
                response.get("usage_count", 0),
                response.get("platforms_used", 0)
            ])
        
        return output.getvalue()
    
    def _is_postgres(self) -> bool:
        """Check if using PostgreSQL"""
        import os
        db_url = os.getenv("DATABASE_URL", "")
        return db_url.startswith("postgresql://") or db_url.startswith("postgres://")
    
    def _execute_query(self, conn, query: str, params: tuple = ()):
        """Execute query with proper cursor handling"""
        if self._is_postgres():
            import psycopg2.extras
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cursor.execute(query, params)
            if query.strip().upper().startswith("SELECT"):
                return cursor.fetchall()
            return None
        else:
            cursor = conn.execute(query, params)
            if query.strip().upper().startswith("SELECT"):
                return cursor.fetchall()
            conn.commit()
            return None


class PerformanceMonitor:
    """Monitor API performance and response times"""
    
    def __init__(self):
        self.metrics = defaultdict(list)
    
    def record_request_time(self, endpoint: str, duration: float, status_code: int):
        """Record API request performance"""
        self.metrics[endpoint].append({
            "duration": duration,
            "status_code": status_code,
            "timestamp": datetime.now()
        })
        
        # Keep only last 1000 requests per endpoint
        if len(self.metrics[endpoint]) > 1000:
            self.metrics[endpoint] = self.metrics[endpoint][-1000:]
    
    def get_performance_stats(self, endpoint: str = None) -> Dict:
        """Get performance statistics"""
        if endpoint:
            return self._calculate_stats(self.metrics.get(endpoint, []))
        
        return {
            ep: self._calculate_stats(metrics) 
            for ep, metrics in self.metrics.items()
        }
    
    def _calculate_stats(self, metrics: List[Dict]) -> Dict:
        """Calculate statistics for a list of metrics"""
        if not metrics:
            return {}
        
        durations = [m["duration"] for m in metrics]
        status_codes = [m["status_code"] for m in metrics]
        
        return {
            "total_requests": len(metrics),
            "avg_duration": sum(durations) / len(durations),
            "min_duration": min(durations),
            "max_duration": max(durations),
            "success_rate": len([s for s in status_codes if 200 <= s < 300]) / len(status_codes),
            "error_rate": len([s for s in status_codes if s >= 400]) / len(status_codes)
        }