import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeakArea {
  task_type: string;
  success_rate: number;
  failure_count: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query to get task types with success rate below 70%
    // Aggregates by task_type, calculates success_rate and failure_count
    const { data, error } = await supabase
      .rpc("get_weak_areas");

    if (error) {
      // If RPC doesn't exist, fall back to raw query approach
      const { data: metricsData, error: metricsError } = await supabase
        .from("performance_metrics")
        .select("task_type, success, failure_count");

      if (metricsError) {
        throw metricsError;
      }

      // Aggregate metrics by task_type
      const taskTypeMap = new Map<string, { total: number; successes: number; failures: number }>();

      for (const metric of metricsData || []) {
        const existing = taskTypeMap.get(metric.task_type) || { total: 0, successes: 0, failures: 0 };
        existing.total += 1;
        if (metric.success) {
          existing.successes += 1;
        } else {
          existing.failures += metric.failure_count || 1;
        }
        taskTypeMap.set(metric.task_type, existing);
      }

      // Calculate success rates and filter weak areas
      const weakAreas: WeakArea[] = [];

      for (const [task_type, stats] of taskTypeMap.entries()) {
        const success_rate = stats.total > 0 ? (stats.successes / stats.total) * 100 : 0;
        
        if (success_rate < 70) {
          weakAreas.push({
            task_type,
            success_rate: Math.round(success_rate * 100) / 100,
            failure_count: stats.failures,
          });
        }
      }

      // Sort by failure_count descending
      weakAreas.sort((a, b) => b.failure_count - a.failure_count);

      return new Response(
        JSON.stringify({
          success: true,
          data: weakAreas,
          count: weakAreas.length,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // If RPC exists and returned data
    const weakAreas: WeakArea[] = (data || [])
      .filter((item: any) => item.success_rate < 70)
      .map((item: any) => ({
        task_type: item.task_type,
        success_rate: Math.round(item.success_rate * 100) / 100,
        failure_count: item.failure_count,
      }))
      .sort((a: WeakArea, b: WeakArea) => b.failure_count - a.failure_count);

    return new Response(
      JSON.stringify({
        success: true,
        data: weakAreas,
        count: weakAreas.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        data: [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});