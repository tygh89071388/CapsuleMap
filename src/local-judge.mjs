const DEFAULT_DOCS = [
  "docs/ai/PROJECT-CAPSULE.md",
  "docs/ai/MODULE-INDEX.md",
];

function heuristicJudge(task) {
  const text = task.toLowerCase();
  const requiredDocs = [...DEFAULT_DOCS];
  let taskType = "general";
  let needsCapsule = false;
  const reasons = [];

  if (/(handoff|resume|continue|接手|繼續|膠囊|capsule|交接)/i.test(task)) {
    taskType = "handoff";
    needsCapsule = true;
    reasons.push("handoff keywords detected");
  }

  if (/(fix|bug|change|edit|refactor|test|修|改|重構|測試)/i.test(task)) {
    taskType = taskType === "handoff" ? "handoff-code-change" : "code-change";
    requiredDocs.push("docs/ai/IMPACT-MAP.json", "docs/ai/TEST-MAP.json");
    reasons.push("code-change or test keywords detected");
  }

  if (/(architecture|design|module|api|架構|設計|模組|介面)/i.test(task)) {
    taskType = taskType === "general" ? "architecture" : taskType;
    requiredDocs.push("docs/ai/ARCHITECTURE-LANGUAGE.md");
    reasons.push("architecture keywords detected");
  }

  return {
    source: "heuristic",
    taskType,
    needsCapsule,
    requiredDocs: [...new Set(requiredDocs)],
    confidence: reasons.length ? 0.72 : 0.45,
    reason: reasons.join("; ") || "no strong keyword, use basic handoff reads",
  };
}

async function ollamaJudge(task, model) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        prompt: `Classify this coding-agent task. Return compact JSON with taskType, needsCapsule, requiredDocs, confidence, reason.

Task: ${task}`,
      }),
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const payload = await response.json();
    const text = payload.response ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Ollama response did not contain JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      source: "ollama",
      taskType: parsed.taskType ?? "general",
      needsCapsule: Boolean(parsed.needsCapsule),
      requiredDocs: Array.isArray(parsed.requiredDocs) ? parsed.requiredDocs : DEFAULT_DOCS,
      confidence: Number(parsed.confidence ?? 0.6),
      reason: String(parsed.reason ?? "ollama triage"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function judgeTask(task, env = process.env) {
  const fallback = heuristicJudge(task);
  if (env.CAPSULEMAP_LOCAL_JUDGE !== "ollama") return fallback;

  const model = env.CAPSULEMAP_OLLAMA_MODEL || "gemma4:e2b";
  try {
    return await ollamaJudge(task, model);
  } catch (error) {
    return {
      ...fallback,
      source: "heuristic",
      reason: `${fallback.reason}; ollama unavailable: ${error.message}`,
    };
  }
}
