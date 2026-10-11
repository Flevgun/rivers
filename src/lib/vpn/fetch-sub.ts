import { createServerFn } from "@tanstack/react-start";

function publicUrl(raw: string) {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("только http или https");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") {
    throw new Error("локальный адрес нельзя");
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|100\.64\.)/.test(host)) throw new Error("локальный адрес нельзя");
  const block = host.match(/^172\.(\d+)\./);
  if (block && Number(block[1]) >= 16 && Number(block[1]) <= 31) throw new Error("локальный адрес нельзя");
  return url.toString();
}

export const fetchSubscription = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => ({ url: publicUrl(input.url) }))
  .handler(async ({ data }) => {
    const response = await fetch(data.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "Rivers/1.0" },
    });
    if (!response.ok) return { ok: false as const, error: `панель ответила ${response.status}` };
    const text = await response.text();
    if (text.length > 400_000) return { ok: false as const, error: "ответ слишком большой" };
    return { ok: true as const, text };
  });
