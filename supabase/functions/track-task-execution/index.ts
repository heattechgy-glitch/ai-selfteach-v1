import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskExecutionRequest {
  task_type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  success: boolean;
  error_log: string | null;
}

interface PerformanceMetrics {
  id: string;
  task_type: string;
  success_rate: number;
  total_executions: number;
  successful_executions: number;
  updated_at: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: TaskExecutionRequest = await req.json();

    // Validate required fields
    if (!body.task_type || typeof body.task_type !== "string") {
      return new Response(
        JSON.stringify({ error: "task_type is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof body.success !== "boolean") {
      return new Response(
        JSON.stringify({ error: "success is required and must be a boolean" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert task execution record
    const { data: executionData, error: executionError } = await supabase
      .from("task_executions")
      .insert({
        task_type: body.task_type,
        input: body.input || {},
        output: body.output,
        success: body.success,
        error_log: body.error_log,
        executed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (executionError) {
      console.error("Error inserting task execution:", executionError);
      return new Response(
        JSON.stringify({ error: "Failed to insert task execution", details: executionError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch existing performance metrics for this task_type
    const { data: existingMetrics, error: fetchError } = await supabase
      .from("performance_metrics")
      .select("*")
      .eq("task_type", body.task_type)
      .single();

    let updatedMetrics: PerformanceMetrics;

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is expected for new task types
      console.error("Error fetching performance metrics:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch performance metrics", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!existingMetrics) {
      // Create new performance metrics record for this task_type
      const totalExecutions = 1;
      const successfulExecutions = body.success ? 1 : 0;
      const successRate = body.success ? 100.0 : 0.0;

      const { data: newMetrics, error: insertMetricsError } = await supabase
        .from("performance_metrics")
        .insert({
          task_type: body.task_type,
          success_rate: successRate,
          total_executions: totalExecutions,
          successful_executions: successfulExecutions,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertMetricsError) {
        console.error("Error inserting performance metrics:", insertMetricsError);
        return new Response(
          JSON.stringify({ error: "Failed to create performance metrics", details: insertMetricsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      updatedMetrics = newMetrics;
    } else {
      // Update existing performance metrics with rolling calculation
      const totalExecutions = (existingMetrics.total_executions || 0) + 1;
      const successfulExecutions = (existingMetrics.successful_executions || 0) + (body.success ? 1 : 0);
      const successRate = (successfulExecutions / totalExecutions) * 100;

      const { data: updated, error: updateError } = await supabase
        .from("performance_metrics")
        .update({
          success_rate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
          total_executions: totalExecutions,
          successful_executions: successfulExecutions,
          updated_at: new Date().toISOString(),
        })
        .eq("task_type", body.task_type)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating performance metrics:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update performance metrics", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      updatedMetrics = updated;
    }

    // Return success response with both execution and metrics data
    return new Response(
      JSON.stringify({
        success: true,
        task_execution: executionData,
        performance_metrics: {
          task_type: updatedMetrics.task_type,
          success_rate: updatedMetrics.success_rate,
          total_executions: updatedMetrics.total_executions,
          successful_executions: updatedMetrics.successful_executions,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});