/**
 * Minimal structured logger. Emits single-line JSON on the server (easy to ship
 * to a log aggregator) and readable console output in the browser. No PII should
 * be passed in `meta`; pass ids, not raw personal data.
 */

type Level = "debug" | "info" | "warn" | "error";

const isServer = typeof window === "undefined";
const isProd = process.env.NODE_ENV === "production";

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (level === "debug" && isProd) return; // drop debug in prod

  if (isServer) {
    const line = JSON.stringify({
      level,
      message,
      time: new Date().toISOString(),
      ...(meta ?? {}),
    });
    (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
    return;
  }

  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[${level}] ${message}`, meta ?? "");
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
};
