import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerformanceMetric {
  task_type: string;
  current_period: {
    total_tasks: number;
    successful_tasks: number;
    average_score: number;
    average_completion_time_ms: number;
  };
  previous_period: {
    total_tasks: number;
    successful_tasks: number;
    average_score: number;
    average_completion_time_ms: number;
  };
  change: {
    score_delta: number;
    success_rate_delta: number;
    completion_time_delta: number;
    status: "improvement" | "regression" | "stable";
  };
}

interface EvaluationSummary {
  evaluation_id: string;
  timestamp: string;
  period: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  metrics: PerformanceMetric[];
  regressions: PerformanceMetric[];
  improvements: PerformanceMetric[];
  below_threshold: PerformanceMetric[];
  weaknesses_identified: any[];
  improvement_prompts_generated: any[];
  overall_health: "healthy" | "needs_attention" | "critical";
}

const PERFORMANCE_THRESHOLD = 0.7;
const REGRESSION_THRESHOLD = -0.1;
const IMPROVEMENT_THRESHOLD = 0.1;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const currentPeriodEnd = now.toISOString();
    const currentPeriodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const previousPeriodEnd = currentPeriodStart;
    const previousPeriodStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const { data: currentPeriodData, error: currentError } = await supabase
      .from("task_executions")
      .select("task_type, score, success, completion_time_ms")
      .gte("created_at", currentPeriodStart)
      .lte("created_at", currentPeriodEnd);

    if (currentError) {
      throw new Error(`Failed to fetch current period data: ${currentError.message}`);
    }

    const { data: previousPeriodData, error: previousError } = await supabase
      .from("task_executions")
      .select("task_type, score, success, completion_time_ms")
      .gte("created_at", previousPeriodStart)
      .lte("created_at", previousPeriodEnd);

    if (previousError) {
      throw new Error(`Failed to fetch previous period data: ${previousError.message}`);
    }

    const calculateMetrics = (data: any[]) => {
      const byTaskType: Record<string, any[]> = {};
      
      for (const record of data || []) {
        if (!byTaskType[record.task_type]) {
          byTaskType[record.task_type] = [];
        }
        byTaskType[record.task_type].push(record);
      }

      const metrics: Record<string, any> = {};
      
      for (const [taskType, records] of Object.entries(byTaskType)) {
        const totalTasks = records.length;
        const successfulTasks = records.filter((r) => r.success).length;
        const averageScore = records.reduce((sum, r) => sum + (r.score || 0), 0) / totalTasks || 0;
        const averageCompletionTime = records.reduce((sum, r) => sum + (r.completion_time_ms || 0), 0) / totalTasks || 0;

        metrics[taskType] = {
          total_tasks: totalTasks,
          successful_tasks: successfulTasks,
          average_score: averageScore,
          average_completion_time_ms: averageCompletionTime,
          success_rate: totalTasks > 0 ? successfulTasks / totalTasks : 0,
        };
      }

      return metrics;
    };

    const currentMetrics = calculateMetrics(currentPeriodData || []);
    const previousMetrics = calculateMetrics(previousPeriodData || []);

    const allTaskTypes = new Set([
      ...Object.keys(currentMetrics),
      ...Object.keys(previousMetrics),
    ]);

    const performanceMetrics: PerformanceMetric[] = [];
    const regressions: PerformanceMetric[] = [];
    const improvements: PerformanceMetric[] = [];
    const belowThreshold: PerformanceMetric[] = [];

    for (const taskType of allTaskTypes) {
      const current = currentMetrics[taskType] || {
        total_tasks: 0,
        successful_tasks: 0,
        average_score: 0,
        average_completion_time_ms: 0,
        success_rate: 0,
      };

      const previous = previousMetrics[taskType] || {
        total_tasks: 0,
        successful_tasks: 0,
        average_score: 0,
        average_completion_time_ms: 0,
        success_rate: 0,
      };

      const scoreDelta = current.average_score - previous.average_score;
      const successRateDelta = current.success_rate - previous.success_rate;
      const completionTimeDelta = previous.average_completion_time_ms > 0
        ? (current.average_completion_time_ms - previous.average_completion_time_ms) / previous.average_completion_time_ms
        : 0;

      let status: "improvement" | "regression" | "stable" = "stable";
      if (scoreDelta >= IMPROVEMENT_THRESHOLD || successRateDelta >= IMPROVEMENT_THRESHOLD) {
        status = "improvement";
      } else if (scoreDelta <= REGRESSION_THRESHOLD || successRateDelta <= REGRESSION_THRESHOLD) {
        status = "regression";
      }

      const metric: PerformanceMetric = {
        task_type: taskType,
        current_period: {
          total_tasks: current.total_tasks,
          successful_tasks: current.successful_tasks,
          average_score: current.average_score,
          average_completion_time_ms: current.average_completion_time_ms,
        },
        previous_period: {
          total_tasks: previous.total_tasks,
          successful_tasks: previous.successful_tasks,
          average_score: previous.average_score,
          average_completion_time_ms: previous.average_completion_time_ms,
        },
        change: {
          score_delta: scoreDelta,
          success_rate_delta: successRateDelta,
          completion_time_delta: completionTimeDelta,
          status,
        },
      };

      performanceMetrics.push(metric);

      if (status === "regression") {
        regressions.push(metric);
      } else if (status === "improvement") {
        improvements.push(metric);
      }

      if (current.average_score < PERFORMANCE_THRESHOLD || current.success_rate < PERFORMANCE_THRESHOLD) {
        belowThreshold.push(metric);
      }
    }

    let weaknessesIdentified: any[] = [];
    let improvementPromptsGenerated: any[] = [];

    if (belowThreshold.length > 0) {
      try {
        const weaknessResponse = await fetch(`${supabaseUrl}/functions/v1/identify-weaknesses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            metrics: belowThreshold,
            period: {
              start: currentPeriodStart,
              end: currentPeriodEnd,
            },
          }),
        });

        if (weaknessResponse.ok) {
          const weaknessData = await weaknessResponse.json();
          weaknessesIdentified = weaknessData.weaknesses || [];
        } else {
          console.error("Failed to call identify-weaknesses:", await weaknessResponse.text());
        }
      } catch (error) {
        console.error("Error calling identify-weaknesses:", error);
      }

      try {
        const promptsResponse = await fetch(`${supabaseUrl}/functions/v1/generate-improvement-prompts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            weaknesses: weaknessesIdentified,
            metrics: belowThreshold,
            regressions: regressions,
          }),
        });

        if (promptsResponse.ok) {
          const promptsData = await promptsResponse.json();
          improvementPromptsGenerated = promptsData.prompts || [];
        } else {
          console.error("Failed to call generate-improvement-prompts:", await promptsResponse.text());
        }
      } catch (error) {
        console.error("Error calling generate-improvement-prompts:", error);
      }
    }

    let overallHealth: "healthy" | "needs_attention" | "critical" = "healthy";
    const totalTaskTypes = performanceMetrics.length;
    const regressionRatio = totalTaskTypes > 0 ? regressions.length / totalTaskTypes : 0;
    const belowThresholdRatio = totalTaskTypes > 0 ? belowThreshold.length / totalTaskTypes : 0;

    if (regressionRatio > 0.5 || belowThresholdRatio > 0.5) {
      overallHealth = "critical";
    } else if (regressionRatio > 0.2 || belowThresholdRatio > 0.2) {
      overallHealth = "needs_attention";
    }

    const evaluationId = crypto.randomUUID();

    const evaluationSummary: EvaluationSummary = {
      evaluation_id: evaluationId,
      timestamp: now.toISOString(),
      period: {
        current: { start: currentPeriodStart, end: currentPeriodEnd },
        previous: { start: previousPeriodStart, end: previousPeriodEnd },
      },
      metrics: performanceMetrics,
      regressions,
      improvements,
      below_threshold: belowThreshold,
      weaknesses_identified: weaknessesIdentified,
      improvement_prompts_generated: improvementPromptsGenerated,
      overall_health: overallHealth,
    };

    const { error: insertError } = await supabase
      .from("evaluation_summaries")
      .insert({
        id: evaluationId,
        created_at: now.toISOString(),
        period_start: currentPeriodStart,
        period_end: currentPeriodEnd,
        metrics: performanceMetrics,
        regressions_count: regressions.length,
        improvements_count: improvements.length,
        below_threshold_count: belowThreshold.length,
        weaknesses: weaknessesIdentified,
        improvement_prompts: improvementPromptsGenerated,
        overall_health: overallHealth,
      });

    if (insertError) {
      console.error("Failed to save evaluation summary:", insertError);
    }

    return new Response(
      JSON.stringify(evaluationSummary),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Nightly evaluation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});