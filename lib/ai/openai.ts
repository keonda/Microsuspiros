export async function runOpenAiJson(prompt: string) {
  if (!process.env.OPENAI_API_KEY) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You return only strict JSON. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error("OpenAI request failed");
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}
