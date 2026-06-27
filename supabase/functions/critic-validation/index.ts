import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CriticRequest {
  taskOutput: string;
  expectedCriteria: string[];
  taskDescription?: string;
}

interface ValidationResult {
  pass: boolean;
  score: number;
  feedback: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { taskOutput, expectedCriteria, taskDescription } = await req.json() as CriticRequest;

    if (!taskOutput || typeof taskOutput !== "string") {
      throw new Error("taskOutput is required and must be a string");
    }

    if (!expectedCriteria || !Array.isArray(expectedCriteria) || expectedCriteria.length === 0) {
      throw new Error("expectedCriteria is required and must be a non-empty array");
    }

    const criteriaList = expectedCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n");

    const systemPrompt = `You are a strict quality assurance critic for an AI self-teaching system. Your role is to objectively evaluate task outputs against specified criteria.

You must respond with ONLY a valid JSON object in this exact format:
{
  "pass": boolean,
  "score": number (0-100),
  "feedback": string
}

Scoring guidelines:
- 90-100: Exceptional - Exceeds all criteria with excellence
- 80-89: Good - Meets all criteria satisfactorily
- 70-79: Acceptable - Meets most criteria with minor issues
- 60-69: Needs Improvement - Meets some criteria but has notable gaps
- Below 60: Fail - Does not adequately meet the criteria

A "pass" should be true only if score >= 70.

Be thorough but fair. Provide specific, actionable feedback.`;

    const userPrompt = `Evaluate the following task output against the expected criteria.

${taskDescription ? `TASK DESCRIPTION:\n${taskDescription}\n\n` : ""}EXPECTED CRITERIA:\n${criteriaList}

TASK OUTPUT:\n${taskOutput}

Provide your evaluation as a JSON object with pass (boolean), score (0-100), and feedback (string).`;

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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    let validationResult: ValidationResult;
    try {
      const parsed = JSON.parse(content);
      
      if (typeof parsed.pass !== "boolean") {
        throw new Error("Invalid pass field");
      }
      if (typeof parsed.score !== "number" || parsed.score < 0 || parsed.score > 100) {
        throw new Error("Invalid score field");
      }
      if (typeof parsed.feedback !== "string") {
        throw new Error("Invalid feedback field");
      }

      validationResult = {
        pass: parsed.pass,
        score: Math.round(parsed.score),
        feedback: parsed.feedback.trim()
      };
    } catch (parseError) {
      console.error("Failed to parse GPT response:", content);
      throw new Error(`Failed to parse validation response: ${parseError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        validation: validationResult,
        metadata: {
          model: "gpt-4",
          criteriaCount: expectedCriteria.length,
          timestamp: new Date().toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Critic validation error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
        validation: null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});