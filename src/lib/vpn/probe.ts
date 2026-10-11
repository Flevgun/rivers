import { createServerFn } from "@tanstack/react-start";

function target(host: string, port: number) {
  const name = host.trim().replace(/^\[|\]$/g, "").toLowerCase();
  if (!name || name.length > 253 || /[\s/]/.test(name)) throw new Error("не тот адрес");
  if (name === "localhost" || name.endsWith(".local")) throw new Error("локальный адрес нельзя");
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|100\.64\.)/.test(name)) throw new Error("локальный адрес нельзя");
  const block = name.match(/^172\.(\d+)\./);
  if (block && Number(block[1]) >= 16 && Number(block[1]) <= 31) throw new Error("локальный адрес нельзя");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("не тот порт");
  return { host: name, port };
}

export const probeServer = createServerFn({ method: "POST" })
  .validator((input: { host: string; port: number }) => target(input.host, input.port))
  .handler(async ({ data }) => {
    const net = await import("node:net");
    const started = Date.now();
    const ms = await new Promise<number>((resolve, reject) => {
      const socket = net.connect({ host: data.host, port: data.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("нет ответа"));
      }, 5000);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.end();
        resolve(Date.now() - started);
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    }).catch(() => null);
    if (ms == null) return { ok: false as const, error: "нет ответа" };
    return { ok: true as const, ms };
  });
