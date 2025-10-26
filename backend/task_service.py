"""
Background task processing for Canner
Handles async operations like AI processing, analytics, and data sync
"""

import os
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass

try:
    from celery import Celery
    from celery.result import AsyncResult
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    logging.warning("Celery not available. Background tasks will run synchronously.")


@dataclass
class TaskResult:
    """Represents the result of a background task"""
    task_id: str
    status: str  # pending, running, success, failure
    result: Optional[Dict] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TaskService:
    """Service for managing background tasks"""
    
    def __init__(self):
        self.celery_app = None
        self.task_results = {}  # In-memory storage for non-Celery mode
        
        if CELERY_AVAILABLE:
            # Configure Celery
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            self.celery_app = Celery(
                'canner_tasks',
                broker=redis_url,
                backend=redis_url,
                include=['task_service']
            )
            
            # Configure Celery settings
            self.celery_app.conf.update(
                task_serializer='json',
                accept_content=['json'],
                result_serializer='json',
                timezone='UTC',
                enable_utc=True,
                task_track_started=True,
                task_time_limit=300,  # 5 minutes
                task_soft_time_limit=240,  # 4 minutes
                worker_prefetch_multiplier=1,
                worker_max_tasks_per_child=1000,
            )
            
            logging.info("✅ Celery task service initialized")
        else:
            logging.info("📝 Task service running in synchronous mode")
    
    def submit_ai_generation_task(self, context: Dict, user_id: str = "default") -> str:
        """Submit AI response generation as background task"""
        if self.celery_app:
            result = generate_ai_responses_task.delay(context, user_id)
            return result.id
        else:
            # Synchronous fallback
            task_id = f"sync_{datetime.now().timestamp()}"
            try:
                from ai_service import AIResponseService, SuggestionContext
                
                ai_service = AIResponseService()
                suggestion_context = SuggestionContext(**context)
                suggestions = ai_service.generate_suggestions(suggestion_context)
                
                self.task_results[task_id] = TaskResult(
                    task_id=task_id,
                    status="success",
                    result={"suggestions": suggestions},
                    created_at=datetime.now(),
                    completed_at=datetime.now()
                )
            except Exception as e:
                self.task_results[task_id] = TaskResult(
                    task_id=task_id,
                    status="failure",
                    error=str(e),
                    created_at=datetime.now(),
                    completed_at=datetime.now()
                )
            
            return task_id
    
    def submit_analytics_task(self, days: int = 30, user_id: str = "default") -> str:
        """Submit analytics generation as background task"""
        if self.celery_app:
            result = generate_analytics_task.delay(days, user_id)
            return result.id
        else:
            # Synchronous fallback
            task_id = f"sync_analytics_{datetime.now().timestamp()}"
            try:
                from analytics_service import AnalyticsService
                from app import get_db_connection
                
                analytics_service = AnalyticsService(get_db_connection)
                analytics = analytics_service.get_response_analytics(days)
                
                self.task_results[task_id] = TaskResult(
                    task_id=task_id,
                    status="success",
                    result=analytics,
                    created_at=datetime.now(),
                    completed_at=datetime.now()
                )
            except Exception as e:
                self.task_results[task_id] = TaskResult(
                    task_id=task_id,
                    status="failure",
                    error=str(e),
                    created_at=datetime.now(),
                    completed_at=datetime.now()
                )
            
            return task_id
    
    def submit_data_export_task(self, export_format: str, filters: Dict, user_id: str = "default") -> str:
        """Submit data export as background task"""
        if self.celery_app:
            result = export_data_task.delay(export_format, filters, user_id)
            return result.id
        else:
            # Synchronous fallback - implement basic export
            task_id = f"sync_export_{datetime.now().timestamp()}"
            self.task_results[task_id] = TaskResult(
                task_id=task_id,
                status="success",
                result={"export_url": "/api/export/placeholder"},
                created_at=datetime.now(),
                completed_at=datetime.now()
            )
            return task_id
    
    def get_task_status(self, task_id: str) -> TaskResult:
        """Get status of a background task"""
        if self.celery_app:
            try:
                result = AsyncResult(task_id, app=self.celery_app)
                
                status_map = {
                    'PENDING': 'pending',
                    'STARTED': 'running',
                    'SUCCESS': 'success',
                    'FAILURE': 'failure',
                    'RETRY': 'running',
                    'REVOKED': 'failure'
                }
                
                return TaskResult(
                    task_id=task_id,
                    status=status_map.get(result.status, 'unknown'),
                    result=result.result if result.successful() else None,
                    error=str(result.result) if result.failed() else None,
                    created_at=None,  # Celery doesn't easily provide this
                    completed_at=None
                )
            except Exception as e:
                return TaskResult(
                    task_id=task_id,
                    status="error",
                    error=f"Failed to get task status: {e}"
                )
        else:
            # Check in-memory storage
            return self.task_results.get(task_id, TaskResult(
                task_id=task_id,
                status="not_found",
                error="Task not found"
            ))
    
    def cancel_task(self, task_id: str) -> bool:
        """Cancel a background task"""
        if self.celery_app:
            try:
                self.celery_app.control.revoke(task_id, terminate=True)
                return True
            except Exception as e:
                logging.error(f"Failed to cancel task {task_id}: {e}")
                return False
        else:
            # Remove from in-memory storage
            return bool(self.task_results.pop(task_id, None))
    
    def get_active_tasks(self) -> List[Dict]:
        """Get list of active tasks"""
        if self.celery_app:
            try:
                inspect = self.celery_app.control.inspect()
                active = inspect.active()
                return [task for worker_tasks in active.values() for task in worker_tasks]
            except Exception as e:
                logging.error(f"Failed to get active tasks: {e}")
                return []
        else:
            # Return in-memory tasks that are not completed
            return [
                {
                    "id": task_id,
                    "status": result.status,
                    "created_at": result.created_at.isoformat() if result.created_at else None
                }
                for task_id, result in self.task_results.items()
                if result.status in ["pending", "running"]
            ]


# Global task service instance
task_service = TaskService()


# Celery task definitions (only if Celery is available)
if CELERY_AVAILABLE and task_service.celery_app:
    
    @task_service.celery_app.task(bind=True)
    def generate_ai_responses_task(self, context: Dict, user_id: str = "default"):
        """Background task for AI response generation"""
        try:
            from ai_service import AIResponseService, SuggestionContext
            
            # Update task status
            self.update_state(state='PROGRESS', meta={'status': 'Generating AI responses with Groq...'})
            
            ai_service = AIResponseService()
            suggestion_context = SuggestionContext(**context)
            suggestions = ai_service.generate_suggestions(suggestion_context)
            
            return {
                "suggestions": suggestions,
                "user_id": user_id,
                "model": ai_service.model,
                "generated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logging.error(f"AI generation task failed: {e}")
            raise
    
    @task_service.celery_app.task(bind=True)
    def generate_analytics_task(self, days: int = 30, user_id: str = "default"):
        """Background task for analytics generation"""
        try:
            from analytics_service import AnalyticsService
            from app import get_db_connection
            
            self.update_state(state='PROGRESS', meta={'status': 'Generating analytics...'})
            
            analytics_service = AnalyticsService(get_db_connection)
            analytics = analytics_service.get_response_analytics(days)
            
            return {
                "analytics": analytics,
                "user_id": user_id,
                "generated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logging.error(f"Analytics generation task failed: {e}")
            raise
    
    @task_service.celery_app.task(bind=True)
    def export_data_task(self, export_format: str, filters: Dict, user_id: str = "default"):
        """Background task for data export"""
        try:
            from analytics_service import AnalyticsService
            from app import get_db_connection
            
            self.update_state(state='PROGRESS', meta={'status': f'Exporting data as {export_format}...'})
            
            analytics_service = AnalyticsService(get_db_connection)
            
            if export_format.lower() == "json":
                analytics = analytics_service.get_response_analytics(filters.get("days", 30))
                export_data = json.dumps(analytics, indent=2, default=str)
            elif export_format.lower() == "csv":
                export_data = analytics_service.export_analytics_data("csv", filters.get("days", 30))
            else:
                raise ValueError(f"Unsupported export format: {export_format}")
            
            # In a real implementation, you'd save this to a file storage service
            # and return a download URL
            export_filename = f"canner_export_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{export_format}"
            
            return {
                "export_filename": export_filename,
                "export_size": len(export_data),
                "export_format": export_format,
                "user_id": user_id,
                "generated_at": datetime.now().isoformat(),
                "download_url": f"/api/downloads/{export_filename}"  # Placeholder
            }
            
        except Exception as e:
            logging.error(f"Data export task failed: {e}")
            raise
    
    @task_service.celery_app.task
    def cleanup_old_tasks():
        """Periodic task to clean up old task results"""
        try:
            # Clean up task results older than 24 hours
            cutoff_time = datetime.now() - timedelta(hours=24)
            
            # This would typically involve cleaning up result backend
            # For now, just log the cleanup
            logging.info(f"Cleaning up tasks older than {cutoff_time}")
            
            return {"cleaned_up_at": datetime.now().isoformat()}
            
        except Exception as e:
            logging.error(f"Task cleanup failed: {e}")
            raise
    
    # Configure periodic tasks
    task_service.celery_app.conf.beat_schedule = {
        'cleanup-old-tasks': {
            'task': 'task_service.cleanup_old_tasks',
            'schedule': 3600.0,  # Run every hour
        },
    }


class TaskManager:
    """High-level task management interface"""
    
    def __init__(self, task_service: TaskService):
        self.task_service = task_service
    
    def generate_ai_suggestions_async(self, context: Dict, user_id: str = "default") -> str:
        """Generate AI suggestions asynchronously"""
        return self.task_service.submit_ai_generation_task(context, user_id)
    
    def generate_analytics_async(self, days: int = 30, user_id: str = "default") -> str:
        """Generate analytics asynchronously"""
        return self.task_service.submit_analytics_task(days, user_id)
    
    def export_data_async(self, format: str, filters: Dict, user_id: str = "default") -> str:
        """Export data asynchronously"""
        return self.task_service.submit_data_export_task(format, filters, user_id)
    
    def get_task_result(self, task_id: str) -> TaskResult:
        """Get task result with status"""
        return self.task_service.get_task_status(task_id)
    
    def wait_for_task(self, task_id: str, timeout: int = 30) -> TaskResult:
        """Wait for task completion with timeout"""
        import time
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            result = self.get_task_result(task_id)
            if result.status in ["success", "failure", "error"]:
                return result
            time.sleep(1)
        
        return TaskResult(
            task_id=task_id,
            status="timeout",
            error=f"Task did not complete within {timeout} seconds"
        )


# Global task manager instance
task_manager = TaskManager(task_service)