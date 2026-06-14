import "server-only";

import { env, features } from "@/lib/env";
import { logger } from "@/lib/observability/logger";

/**
 * Error reporting abstraction. Sentry-ready but **no-op without a DSN**.
 *
 * When SENTRY_DSN is set AND `@sentry/nextjs` is installed, exceptions are
 * forwarded to Sentry; otherwise they are written to the structured logger
 * only. The dependency is optional: the import specifier is resolved from a
 * variable so bundlers don't require the package to be present.
 */

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (e: unknown, ctx?: unknown) => void;
  captureMessage: (m: string, ctx?: unknown) => void;
};

let sentry: SentryLike | null = null;
let initTried = false;

async function getSentry(): Promise<SentryLike | null> {
  if (!features.sentry) return null;
  if (initTried) return sentry;
  initTried = true;
  try {
    // Variable specifier keeps this an optional runtime dependency.
    const pkg = "@sentry/nextjs";
    const mod = (await import(/* webpackIgnore: true */ pkg)) as unknown as SentryLike;
    mod.init({ dsn: env.SENTRY_DSN, tracesSampleRate: 0.1, environment: env.NODE_ENV });
    sentry = mod;
    logger.info("sentry initialized");
  } catch {
    logger.warn("SENTRY_DSN set but @sentry/nextjs unavailable — reporting disabled");
    sentry = null;
  }
  return sentry;
}

export type ReportContext = {
  /** Non-PII tags (workspaceId, route, action name, etc.). */
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

/** Report an exception. Always logs; forwards to Sentry when configured. */
export async function captureException(error: unknown, context?: ReportContext): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message, { ...context?.tags, ...context?.extra });
  const s = await getSentry();
  if (s)
    s.captureException(error, context ? { tags: context.tags, extra: context.extra } : undefined);
}

/** Report a noteworthy message (e.g. security event). */
export async function captureMessage(message: string, context?: ReportContext): Promise<void> {
  logger.warn(message, { ...context?.tags, ...context?.extra });
  const s = await getSentry();
  if (s)
    s.captureMessage(message, context ? { tags: context.tags, extra: context.extra } : undefined);
}
