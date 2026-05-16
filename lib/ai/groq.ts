export async function runGroqJson(prompt: string) {
  if (!process.env.GROQ_API_KEY) return null;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "llama-3.1-8b-instant",
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
