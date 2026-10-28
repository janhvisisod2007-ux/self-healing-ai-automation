async function callLLM(prompt) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(process.env.GROQ_API_KEY || "").trim()}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json();
  if (!data.choices) throw new Error(JSON.stringify(data).slice(0, 200));
  return data.choices[0].message.content;
}

async function diagnose(state) {
  const step = state.steps[state.failedStep].name;
  const prompt = `
You are a workflow repair agent.
Failed step: ${step}
Error: ${state.error}
Payload: ${JSON.stringify(state.payload)}

Return ONLY JSON with keys:
root_cause (one short sentence explaining WHY it failed, naming the actual field or value involved, e.g. "Upstream sent phone_no instead of phone"),
fixed_payload (full corrected payload object, or null if the fix needs data that does not exist),
confidence (0 to 1),
risky (false if you only renamed a key, or converted a value's type without changing its meaning, e.g. "500 rupees" to 500; true if you changed the meaning of a value or guessed any data),
explanation (one line).
Never invent missing data like emails or phone numbers.`;

  try {
    const text = await callLLM(prompt);
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.log("LLM ERROR:", e.message);
    return fallbackRules(state); // API fail hui to bhi demo chalega
  }
}

function fallbackRules(state) {
  const p = { ...state.payload };
  if (p.phone_no && !p.phone) {
    p.phone = p.phone_no; delete p.phone_no;
    return { root_cause: "Field name mismatch", fixed_payload: p, confidence: 0.9, risky: false, explanation: "Renamed phone_no to phone" };
  }
  if (typeof p.amount === "string") {
    p.amount = parseFloat(p.amount);
    return { root_cause: "Wrong data type", fixed_payload: p, confidence: 0.85, risky: false, explanation: "Converted amount to number" };
  }
  return { root_cause: "Required data missing", fixed_payload: null, confidence: 0.3, risky: true, explanation: "Cannot be fixed automatically" };
}

module.exports = { diagnose };