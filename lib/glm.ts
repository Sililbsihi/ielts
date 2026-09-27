/**
 * 智谱 GLM API 封装（glm-4-flash 免费）：
 * 释义生成 / 写作批改 / 四标准打分 共用。
 */
const ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MODEL = "glm-4-flash";

export function glmConfigured(): boolean {
  return Boolean(process.env.GLM_API_KEY);
}

export async function glmChat(messages: { role: string; content: string }[], temperature = 0.3): Promise<string> {
  const key = process.env.GLM_API_KEY;
  if (!key) throw new Error("缺少 GLM_API_KEY");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 55000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages, temperature }),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`GLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/** 从模型回复里稳健提取 JSON（兼容 ```json 包裹 / 前后废话） */
export function extractJson<T>(raw: string): T | null {
  const text = raw.replace(/```json/gi, "```").split("```").find((s) => s.trim().startsWith("[") || s.trim().startsWith("{"));
  const candidate = text ?? raw;
  const start = candidate.search(/[\[{]/);
  if (start === -1) return null;
  const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
