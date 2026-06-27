import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useKnowledgeLibrary = () => {
  const [recentLessons, setRecentLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentLessons = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_library')
        .select('problem_hash, solution, task_type, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching knowledge library entries:', error);
        setRecentLessons([]);
      } else {
        setRecentLessons(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching knowledge library:', err);
      setRecentLessons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentLessons();
  }, [fetchRecentLessons]);

  return {
    recentLessons,
    loading,
    refetch: fetchRecentLessons
  };
};

export default useKnowledgeLibrary;
