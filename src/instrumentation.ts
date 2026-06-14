/**
 * Next.js instrumentation. `onRequestError` is invoked by Next for uncaught
 * server errors (route handlers, server components, server actions) and forwards
 * them to our reporting layer (Sentry when configured, structured logs always).
 */

export async function register(): Promise<void> {
  // Reserved for future startup wiring (e.g. eager Sentry init). No-op for now.
}

export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routeType?: string },
): Promise<void> {
  // Only meaningful on the server runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { captureException } = await import("@/lib/observability/report");
    await captureException(error, {
      tags: {
        path: request?.path ?? "unknown",
        method: request?.method ?? "unknown",
        routeType: context?.routeType ?? "unknown",
      },
    });
  }
}
