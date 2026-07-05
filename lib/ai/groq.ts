export async function runGroqJson(prompt: string) {
  if (!process.env.GROQ_API_KEY) return null;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You return only strict JSON. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error("Groq request failed");
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

export async function runGroqVisionJson(prompt: string, imageDataUrl: string) {
  if (!process.env.GROQ_API_KEY) return null;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You return only strict JSON. No markdown." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 512,
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Groq vision request failed${details ? `: ${details.slice(0, 180)}` : ""}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}
