import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string" || message.length > 4000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are AlertHer, a personal-safety AI. Analyze a message the user received or wrote. Detect threats, harassment, stalking, coercion, or risky situations. Respond ONLY via the classify_threat tool.",
          },
          { role: "user", content: message },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_threat",
              description: "Classify the safety threat level of a message.",
              parameters: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  category: {
                    type: "string",
                    enum: ["safe", "harassment", "threat", "stalking", "coercion", "emergency", "other"],
                  },
                  summary: { type: "string", description: "1-2 sentence explanation." },
                  recommended_action: { type: "string", description: "Concrete next step for the user." },
                  trigger_sos: { type: "boolean", description: "True if immediate SOS is recommended." },
                },
                required: ["severity", "category", "summary", "recommended_action", "trigger_sos"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_threat" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : null;
    if (!args) throw new Error("No analysis returned");

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-threat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});