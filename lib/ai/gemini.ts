export async function runGeminiJson(prompt: string) {
  if (!process.env.GEMINI_API_KEY) return null;
  const model = process.env.AI_MODEL || "gemini-1.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json" },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) throw new Error("Gemini request failed");
  const data = await response.json();
  return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
}
