"""
Analytics service for tracking and learning from task completion patterns
"""
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional
from taskman.server.services.storage import StorageManager

class AnalyticsService:
    """Service for analytics and learning"""
    
    def __init__(self, storage: StorageManager):
        self.storage = storage
    
    def get_project_statistics(self, project_id: str) -> Dict:
        """Get statistics for a project"""
        tasks = self.storage.list_tasks(project_id=project_id)
        
        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t.status.value == 'completed'])
        
        total_estimated = sum(t.estimated_minutes for t in tasks)
        total_actual = sum(t.actual_minutes or 0 for t in tasks if t.actual_minutes)
        
        completion_rate = completed_tasks / total_tasks if total_tasks > 0 else 0.0
        
        # Calculate average accuracy for completed tasks
        completed_with_actuals = [
            t for t in tasks 
            if t.status.value == 'completed' and t.actual_minutes
        ]
        
        if completed_with_actuals:
            accuracy_ratios = [
                t.actual_minutes / t.estimated_minutes 
                for t in completed_with_actuals
            ]
            avg_accuracy = sum(accuracy_ratios) / len(accuracy_ratios)
        else:
            avg_accuracy = 1.0
        
        return {
            'project_id': project_id,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'total_estimated_minutes': total_estimated,
            'total_actual_minutes': int(total_actual),
            'completion_rate': completion_rate,
            'average_accuracy_ratio': avg_accuracy
        }
    
    def get_weekly_report(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """Generate weekly progress report"""
        if start_date is None:
            # Default to current week (Monday to Sunday)
            today = date.today()
            start_date = today - timedelta(days=today.weekday())
        
        if end_date is None:
            end_date = start_date + timedelta(days=6)
        
        # Get all schedules for the week
        schedules = self.storage.list_schedules(start_date, end_date)
        
        # Calculate daily completion rates
        daily_rates = {}
        total_completed = 0
        total_minutes = 0
        
        for schedule in schedules:
            schedule_date = schedule.date.strftime('%A')
            daily_rates[schedule_date] = schedule.summary.completion_rate
            total_completed += schedule.summary.tasks_completed
            total_minutes += schedule.summary.total_completed_minutes
        
        # Get top projects
        projects = self.storage.list_projects(status='active')
        project_stats = [
            self.get_project_statistics(p.id) 
            for p in projects
        ]
        project_stats.sort(
            key=lambda x: x['total_actual_minutes'], 
            reverse=True
        )
        
        # Get estimation accuracy
        accuracy = self.storage.get_estimation_factors()
        
        # Generate insights
        insights = self._generate_insights(daily_rates, accuracy)
        
        return {
            'week_start': start_date,
            'week_end': end_date,
            'total_tasks_completed': total_completed,
            'total_minutes_worked': total_minutes,
            'daily_completion_rates': daily_rates,
            'top_projects': project_stats[:5],
            'estimation_accuracy': accuracy,
            'insights': insights
        }
    
    def _generate_insights(
        self,
        daily_rates: Dict[str, float],
        accuracy: float
    ) -> List[str]:
        """Generate actionable insights from data"""
        insights = []
        
        # Check for low completion days
        low_days = [
            day for day, rate in daily_rates.items() 
            if rate < 0.5
        ]
        if low_days:
            insights.append(
                f"⚠️  Low completion on {', '.join(low_days)}. "
                "Consider reducing task load on these days."
            )
        
        # Check estimation accuracy
        if accuracy > 1.5:
            insights.append(
                f"📊 Tasks taking {accuracy:.0%} longer than estimated. "
                "Try increasing time estimates or breaking tasks into smaller pieces."
            )
        elif accuracy < 0.7:
            insights.append(
                f"📊 Tasks completing {(1-accuracy):.0%} faster than estimated. "
                "You may be overestimating. Trust your abilities more!"
            )
        
        # Check for consistent high performance
        high_days = [
            day for day, rate in daily_rates.items() 
            if rate >= 0.8
        ]
        if len(high_days) >= 4:
            insights.append(
                f"🎉 Excellent performance on {len(high_days)} days! "
                "Keep up the great work!"
            )
        
        return insights
    
    def get_burnout_risk_assessment(self) -> Dict:
        """Assess burnout risk based on recent patterns"""
        # Get last 7 days of schedules
        end_date = date.today()
        start_date = end_date - timedelta(days=6)
        
        schedules = self.storage.list_schedules(start_date, end_date)
        
        if len(schedules) < 5:
            return {
                'risk_level': 'unknown',
                'message': 'Not enough data to assess burnout risk',
                'indicators': [],
                'suggestions': []
            }
        
        indicators = []
        
        # Check schedule density
        high_density_days = sum(
            1 for s in schedules 
            if s.summary.total_scheduled_minutes > 10 * 60  # >10 hours
        )
        if high_density_days >= 5:
            indicators.append('high_schedule_density')
        
        # Check completion rate
        avg_completion = sum(
            s.summary.completion_rate for s in schedules
        ) / len(schedules)
        if avg_completion < 0.5:
            indicators.append('low_completion_rate')
        
        # Check estimation drift
        accuracy = self.storage.get_estimation_factors()
        if accuracy > 1.8:
            indicators.append('high_estimation_drift')
        
        # Check weekend work
        weekend_work = any(
            s.date.weekday() in [5, 6] and s.summary.tasks_completed > 0
            for s in schedules
        )
        if weekend_work:
            indicators.append('weekend_work')
        
        # Calculate risk level
        risk_score = len(indicators)
        
        if risk_score >= 3:
            risk_level = 'high'
            message = '⚠️  High Burnout Risk Detected'
            suggestions = [
                '🌟 Reduce daily task count by 30%',
                '☕ Schedule more breaks (aim for 30+ min/day)',
                '📦 Defer non-urgent tasks to next week',
                '🎯 Focus on completing existing tasks before adding new ones',
                '🏖️  Consider taking a day off to recharge'
            ]
        elif risk_score >= 2:
            risk_level = 'medium'
            message = 'ℹ️  Possible Overload'
            suggestions = [
                'Consider reducing task load slightly',
                'Ensure breaks are included in schedule',
                'Review priorities and defer low-priority items'
            ]
        else:
            risk_level = 'low'
            message = '✅ No significant burnout risk detected'
            suggestions = [
                'Keep maintaining healthy work patterns',
                'Continue taking regular breaks'
            ]
        
        return {
            'risk_level': risk_level,
            'message': message,
            'indicators': indicators,
            'suggestions': suggestions,
            'metrics': {
                'high_density_days': high_density_days,
                'avg_completion_rate': avg_completion,
                'estimation_accuracy': accuracy,
                'weekend_work': weekend_work
            }
        }
    
    def get_tag_analytics(self) -> List[Dict]:
        """Get analytics grouped by tags"""
        conn = self.storage._get_conn()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                tag_key,
                tag_value,
                COUNT(*) as usage_count,
                SUM(actual_minutes) as total_minutes,
                AVG(actual_minutes) as avg_minutes,
                AVG(accuracy_ratio) as avg_accuracy
            FROM task_completions
            WHERE tags IS NOT NULL
            GROUP BY tag_key, tag_value
            ORDER BY usage_count DESC
            LIMIT 50
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'tag_key': row[0],
                'tag_value': row[1],
                'usage_count': row[2],
                'total_minutes': row[3] or 0,
                'avg_minutes': row[4] or 0,
                'avg_accuracy': row[5] or 1.0
            }
            for row in results
        ]
    
    def get_productivity_trends(self, days: int = 30) -> Dict:
        """Get productivity trends over time"""
        end_date = date.today()
        start_date = end_date - timedelta(days=days-1)
        
        schedules = self.storage.list_schedules(start_date, end_date)
        
        if not schedules:
            return {
                'trend': 'unknown',
                'daily_completion': [],
                'daily_minutes': [],
                'average_completion': 0.0,
                'average_daily_minutes': 0.0
            }
        
        daily_completion = [
            (s.date.isoformat(), s.summary.completion_rate)
            for s in schedules
        ]
        
        daily_minutes = [
            (s.date.isoformat(), s.summary.total_completed_minutes)
            for s in schedules
        ]
        
        avg_completion = sum(
            s.summary.completion_rate for s in schedules
        ) / len(schedules)
        
        avg_minutes = sum(
            s.summary.total_completed_minutes for s in schedules
        ) / len(schedules)
        
        # Calculate trend (simple linear regression slope)
        if len(schedules) >= 7:
            recent_avg = sum(
                s.summary.completion_rate for s in schedules[-7:]
            ) / 7
            early_avg = sum(
                s.summary.completion_rate for s in schedules[:7]
            ) / 7
            
            if recent_avg > early_avg + 0.1:
                trend = 'improving'
            elif recent_avg < early_avg - 0.1:
                trend = 'declining'
            else:
                trend = 'stable'
        else:
            trend = 'insufficient_data'
        
        return {
            'trend': trend,
            'daily_completion': daily_completion,
            'daily_minutes': daily_minutes,
            'average_completion': avg_completion,
            'average_daily_minutes': avg_minutes
        }