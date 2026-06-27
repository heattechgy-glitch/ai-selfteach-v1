import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

const getWeeksAgo = (weeksBack) => {
  const date = new Date();
  date.setDate(date.getDate() - weeksBack * 7);
  return date;
};

const groupMetricsByWeek = (metrics) => {
  const grouped = {};
  
  metrics.forEach((metric) => {
    const weekKey = getWeekNumber(metric.recorded_at || metric.createdAt || metric.date);
    
    if (!grouped[weekKey]) {
      grouped[weekKey] = {
        week: weekKey,
        metrics: [],
        averageScore: 0,
        totalSessions: 0,
        completionRate: 0,
        improvementRate: 0,
      };
    }
    
    grouped[weekKey].metrics.push(metric);
  });
  
  Object.keys(grouped).forEach((weekKey) => {
    const weekData = grouped[weekKey];
    const metricsCount = weekData.metrics.length;
    
    if (metricsCount > 0) {
      weekData.averageScore = weekData.metrics.reduce((sum, m) => sum + (m.score || 0), 0) / metricsCount;
      weekData.totalSessions = weekData.metrics.reduce((sum, m) => sum + (m.sessions || 1), 0);
      weekData.completionRate = weekData.metrics.reduce((sum, m) => sum + (m.completion_rate || m.completionRate || 0), 0) / metricsCount;
      weekData.improvementRate = weekData.metrics.reduce((sum, m) => sum + (m.improvement_rate || m.improvementRate || 0), 0) / metricsCount;
    }
  });
  
  return grouped;
};

const formatTrendData = (groupedMetrics, weekCount = 8) => {
  const trendData = [];
  const now = new Date();
  
  for (let i = weekCount - 1; i >= 0; i--) {
    const weekDate = getWeeksAgo(i);
    const weekKey = getWeekNumber(weekDate);
    const weekData = groupedMetrics[weekKey];
    
    trendData.push({
      week: weekKey,
      weekLabel: `Week ${weekCount - i}`,
      date: weekDate.toISOString().split('T')[0],
      averageScore: weekData?.averageScore || 0,
      totalSessions: weekData?.totalSessions || 0,
      completionRate: weekData?.completionRate || 0,
      improvementRate: weekData?.improvementRate || 0,
      hasData: !!weekData,
    });
  }
  
  return trendData;
};

const formatImprovementTargets = (plans) => {
  return plans.map((plan) => ({
    id: plan.id || plan._id,
    title: plan.title || plan.name,
    description: plan.description,
    targetMetric: plan.target_metric || plan.targetMetric,
    currentValue: plan.current_value || plan.currentValue || 0,
    targetValue: plan.target_value || plan.targetValue || 100,
    progress: calculateProgress(plan),
    priority: plan.priority || 'medium',
    status: plan.status || 'active',
    dueDate: plan.due_date || plan.dueDate,
    createdAt: plan.created_at || plan.createdAt,
    updatedAt: plan.updated_at || plan.updatedAt,
    milestones: plan.milestones || [],
    category: plan.category || 'general',
  }));
};

const calculateProgress = (plan) => {
  const current = plan.current_value || plan.currentValue || 0;
  const target = plan.target_value || plan.targetValue || 100;
  const baseline = plan.baseline_value || plan.baselineValue || 0;
  
  if (target === baseline) return 100;
  
  const progress = ((current - baseline) / (target - baseline)) * 100;
  return Math.min(Math.max(progress, 0), 100);
};

export const useImprovementData = (options = {}) => {
  const { weekCount = 8, autoFetch = true, userId = null } = options;
  
  const [improvementTargets, setImprovementTargets] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchImprovementPlans = useCallback(async () => {
    const endpoint = userId 
      ? `${API_BASE_URL}/improvement-plans?userId=${userId}`
      : `${API_BASE_URL}/improvement-plans`;
    
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch improvement plans: ${response.status}`);
    }
    
    const data = await response.json();
    return data.plans || data.data || data || [];
  }, [userId]);

  const fetchPerformanceMetrics = useCallback(async () => {
    const startDate = getWeeksAgo(weekCount).toISOString();
    const endDate = new Date().toISOString();
    
    const params = new URLSearchParams({
      startDate,
      endDate,
      ...(userId && { userId }),
    });
    
    const response = await fetch(`${API_BASE_URL}/performance-metrics?${params}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch performance metrics: ${response.status}`);
    }
    
    const data = await response.json();
    return data.metrics || data.data || data || [];
  }, [weekCount, userId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [plans, metrics] = await Promise.all([
        fetchImprovementPlans(),
        fetchPerformanceMetrics(),
      ]);
      
      const formattedTargets = formatImprovementTargets(plans);
      setImprovementTargets(formattedTargets);
      
      const groupedMetrics = groupMetricsByWeek(metrics);
      const formattedTrends = formatTrendData(groupedMetrics, weekCount);
      setTrendData(formattedTrends);
      
      setLastFetched(new Date());
    } catch (err) {
      console.error('Error fetching improvement data:', err);
      setError(err.message || 'Failed to fetch improvement data');
      setImprovementTargets([]);
      setTrendData(formatTrendData({}, weekCount));
    } finally {
      setLoading(false);
    }
  }, [fetchImprovementPlans, fetchPerformanceMetrics, weekCount]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  const updateTarget = useCallback(async (targetId, updates) => {
    try {
      const response = await fetch(`${API_BASE_URL}/improvement-plans/${targetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update improvement target');
      }
      
      const updatedPlan = await response.json();
      
      setImprovementTargets((prev) =>
        prev.map((target) =>
          target.id === targetId
            ? { ...target, ...formatImprovementTargets([updatedPlan.data || updatedPlan])[0] }
            : target
        )
      );
      
      return updatedPlan;
    } catch (err) {
      console.error('Error updating target:', err);
      throw err;
    }
  }, []);

  const createTarget = useCallback(async (newTarget) => {
    try {
      const response = await fetch(`${API_BASE_URL}/improvement-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
        body: JSON.stringify(newTarget),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create improvement target');
      }
      
      const createdPlan = await response.json();
      const formattedTarget = formatImprovementTargets([createdPlan.data || createdPlan])[0];
      
      setImprovementTargets((prev) => [...prev, formattedTarget]);
      
      return formattedTarget;
    } catch (err) {
      console.error('Error creating target:', err);
      throw err;
    }
  }, []);

  const deleteTarget = useCallback(async (targetId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/improvement-plans/${targetId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete improvement target');
      }
      
      setImprovementTargets((prev) => prev.filter((target) => target.id !== targetId));
      
      return true;
    } catch (err) {
      console.error('Error deleting target:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  const summary = {
    totalTargets: improvementTargets.length,
    activeTargets: improvementTargets.filter((t) => t.status === 'active').length,
    completedTargets: improvementTargets.filter((t) => t.status === 'completed').length,
    averageProgress: improvementTargets.length > 0
      ? improvementTargets.reduce((sum, t) => sum + t.progress, 0) / improvementTargets.length
      : 0,
    weeklyGrowth: trendData.length >= 2
      ? trendData[trendData.length - 1].averageScore - trendData[trendData.length - 2].averageScore
      : 0,
  };

  return {
    improvementTargets,
    trendData,
    loading,
    error,
    lastFetched,
    summary,
    refetch,
    updateTarget,
    createTarget,
    deleteTarget,
  };
};

export default useImprovementData;
