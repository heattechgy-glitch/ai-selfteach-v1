import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskExecution {
  id: string;
  task_type: string;
  input: string;
  expected_output: string;
  actual_output: string;
  error_message: string | null;
  created_at: string;
}

interface ReasoningExample {
  input: string;
  reasoning_steps: string[];
  expected_output: string;
  improved_prompt: string;
}

interface ImprovementPlan {
  weak_area: string;
  task_type: string;
  error_patterns: string[];
  reasoning_examples: ReasoningExample[];
  analysis_summary: string;
  created_at: string;
}

async function analyzeWithGPT4(
  openaiApiKey: string,
  taskType: string,
  failedExecutions: TaskExecution[]
): Promise<{
  error_patterns: string[];
  reasoning_examples: ReasoningExample[];
  analysis_summary: string;
}> {
  const executionSummaries = failedExecutions.map((exec, idx) => ({
    index: idx + 1,
    input: exec.input?.substring(0, 500) || "N/A",
    expected: exec.expected_output?.substring(0, 300) || "N/A",
    actual: exec.actual_output?.substring(0, 300) || "N/A",
    error: exec.error_message || "No explicit error",
  }));

  const systemPrompt = `You are an expert AI trainer specializing in analyzing task execution failures and creating targeted improvement strategies.

Your task is to:
1. Analyze the provided failed task executions for the task type: "${taskType}"
2. Identify common error patterns and root causes
3. Generate 5 targeted reasoning examples with improved prompts that address the identified weaknesses

Respond with a JSON object containing:
- error_patterns: Array of 3-5 identified error patterns (strings)
- reasoning_examples: Array of exactly 5 objects, each containing:
  - input: A sample input similar to the failed cases
  - reasoning_steps: Array of 3-5 step-by-step reasoning steps to solve correctly
  - expected_output: The correct expected output
  - improved_prompt: An improved prompt that would help the AI handle this type of task better
- analysis_summary: A 2-3 sentence summary of the main issues and recommended improvements

Focus on creating examples that directly address the identified weaknesses and provide clear reasoning chains.`;

  const userPrompt = `Analyze these failed task executions for task type "${taskType}":

${JSON.stringify(executionSummaries, null, 2)}

Generate improvement strategies and reasoning examples to address these failures.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No content in GPT-4 response");
  }

  try {
    const parsed = JSON.parse(content);
    return {
      error_patterns: parsed.error_patterns || [],
      reasoning_examples: parsed.reasoning_examples || [],
      analysis_summary: parsed.analysis_summary || "Analysis completed",
    };
  } catch (parseError) {
    throw new Error(`Failed to parse GPT-4 response: ${parseError.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!openaiApiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { weak_area, task_type } = await req.json();

    if (!weak_area || !task_type) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: weak_area and task_type are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Fetching failed executions for task_type: ${task_type}, weak_area: ${weak_area}`);

    const { data: failedExecutions, error: fetchError } = await supabase
      .from("task_executions")
      .select("*")
      .eq("task_type", task_type)
      .eq("success", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (fetchError) {
      throw new Error(`Failed to fetch task executions: ${fetchError.message}`);
    }

    if (!failedExecutions || failedExecutions.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No failed executions found for the specified task type",
          weak_area,
          task_type,
          improvement_plan: null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${failedExecutions.length} failed executions. Analyzing with GPT-4...`);

    const analysis = await analyzeWithGPT4(
      openaiApiKey,
      task_type,
      failedExecutions as TaskExecution[]
    );

    const improvementPlan: ImprovementPlan = {
      weak_area,
      task_type,
      error_patterns: analysis.error_patterns,
      reasoning_examples: analysis.reasoning_examples,
      analysis_summary: analysis.analysis_summary,
      created_at: new Date().toISOString(),
    };

    console.log("Storing improvement plan in database...");

    const { data: insertedPlan, error: insertError } = await supabase
      .from("improvement_plans")
      .insert({
        weak_area: improvementPlan.weak_area,
        task_type: improvementPlan.task_type,
        error_patterns: improvementPlan.error_patterns,
        reasoning_examples: improvementPlan.reasoning_examples,
        analysis_summary: improvementPlan.analysis_summary,
        status: "active",
        failed_execution_count: failedExecutions.length,
        metadata: {
          analyzed_execution_ids: failedExecutions.map((e) => e.id),
          gpt_model: "gpt-4",
          generated_at: improvementPlan.created_at,
        },
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to store improvement plan: ${insertError.message}`);
    }

    console.log(`Successfully created improvement plan with ID: ${insertedPlan.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Improvement plan generated successfully",
        improvement_plan: insertedPlan,
        analyzed_executions_count: failedExecutions.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating improvement prompts:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "An unexpected error occurred",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});