import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const usePlatformMetrics = () => {
  const [skillScores, setSkillScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const transformMetricsToSkillScores = (metrics) => {
    if (!metrics || metrics.length === 0) return [];

    const groupedByTaskType = metrics.reduce((acc, metric) => {
      const taskType = metric.task_type;
      if (!acc[taskType]) {
        acc[taskType] = {
          totalSuccess: 0,
          totalAttempts: 0,
        };
      }
      acc[taskType].totalSuccess += metric.success_count || 0;
      acc[taskType].totalAttempts += metric.attempt_count || 1;
      return acc;
    }, {});

    return Object.entries(groupedByTaskType).map(([task_type, data]) => ({
      task_type,
      success_rate: data.totalAttempts > 0 
        ? Math.round((data.totalSuccess / data.totalAttempts) * 100) / 100 
        : 0,
    }));
  };

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('performance_metrics')
        .select('*');

      if (fetchError) {
        throw fetchError;
      }

      const transformedScores = transformMetricsToSkillScores(data);
      setSkillScores(transformedScores);
    } catch (err) {
      setError(err.message || 'Failed to fetch performance metrics');
      console.error('Error fetching performance metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    const subscription = supabase
      .channel('performance_metrics_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'performance_metrics',
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          fetchMetrics();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to performance_metrics changes');
        }
        if (status === 'CHANNEL_ERROR') {
          setError('Failed to establish real-time connection');
        }
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchMetrics]);

  return {
    skillScores,
    loading,
    error,
    refetch: fetchMetrics,
  };
};

export default usePlatformMetrics;
