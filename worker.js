export default {
  async fetch(request, env) {
    const allowedOrigin = "https://rls001.github.io";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Use POST to analyze a bottle photo." }),
        { status: 405, headers: corsHeaders }
      );
    }

    try {
      const body = await request.json();

      if (!body.image) {
        return new Response(
          JSON.stringify({ error: "No image was provided." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const aiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            input: [{
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Analyze this photograph and identify every whiskey or other spirits bottle visible.

Return ONLY valid JSON in this format:
{
  "bottles": [
    {
      "brand": null,
      "expression": null,
      "spiritType": null,
      "producer": null,
      "proof": null,
      "abv": null,
      "bottleSizeML": null,
      "remainingPercent": null,
      "mashBill": null,
      "ageStatement": null,
      "origin": null,
      "confidence": null
    }
  ]
}

Rules:
- Do not invent information.
- Use null when a field cannot be determined reliably.
- proof, abv, bottleSizeML and remainingPercent must be numbers or null.
- confidence must be a number from 0 to 100.
- Estimate remainingPercent from the visible liquid level when possible.
- Identify multiple bottles separately.
- Do not identify glasses, boxes or other objects as bottles.`
                },
                {
                  type: "input_image",
                  image_url: body.image,
                  detail: "high"
                }
              ]
            }]
          })
        }
      );

      const data = await aiResponse.json();

      if (!aiResponse.ok) {
        return new Response(
          JSON.stringify({
            error: "OpenAI analysis failed.",
            details: data
          }),
          { status: aiResponse.status, headers: corsHeaders }
        );
      }

      let text = data.output_text;

      if (!text && data.output) {
        for (const item of data.output) {
          if (item.content) {
            for (const content of item.content) {
              if (content.type === "output_text" && content.text) {
                text = content.text;
              }
            }
          }
        }
      }

      if (!text) {
        throw new Error("No analysis was returned.");
      }

      text = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      const result = JSON.parse(text);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Bottle analysis failed.",
          details: error.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  }
};
