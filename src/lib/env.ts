import { z } from "zod";

/**
 * Centralised, validated environment access.
 *
 * Principle (see CLAUDE.md): the app must NOT boot with a broken core config.
 * Required vars throw at startup. Optional integrations stay `undefined` and
 * their features are disabled gracefully (see `features` below) rather than
 * crashing — "키 없으면 우아하게 비활성".
 */

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),

  // Server-only secret. Used by admin/maintenance scripts, never sent to the client.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Optional: Claude API for document auto-classification. Missing key →
  // auto-classification disabled, app falls back to manual classification.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Per-workspace daily auto-classification call cap (cost guard).
  AI_DAILY_CLASSIFY_LIMIT: z.coerce.number().int().positive().default(500),

  // Optional: outbound email (reminders). Without it the email channel logs
  // instead of sending (dev/demo). Auth-email SMTP is configured in Supabase
  // separately; these drive the app's own messages.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(), // e.g. "세무사무소 <noreply@office.example>"

  // Optional: Solapi for KakaoTalk 알림톡 / SMS. Missing → those channels are
  // disabled and fall back to email automatically.
  SOLAPI_API_KEY: z.string().optional(),
  SOLAPI_API_SECRET: z.string().optional(),
  SOLAPI_SENDER: z.string().optional(), // registered sender phone number
  SOLAPI_PFID: z.string().optional(), // KakaoTalk channel (plus friend) id
  // 알림톡 template id for the docs-reminder template (registered in Kakao).
  SOLAPI_KAKAO_TEMPLATE_ID: z.string().optional(),

  // Optional: CODEF (은행/카드 거래내역 스크래핑 연동). 키 없으면 비활성.
  CODEF_CLIENT_ID: z.string().optional(),
  CODEF_CLIENT_SECRET: z.string().optional(),
  CODEF_PUBLIC_KEY: z.string().optional(),

  // Optional: Solapi delivery-report webhook secret (서명 검증). 없으면 검증 생략(dev).
  SOLAPI_WEBHOOK_SECRET: z.string().optional(),

  // Optional: shared secret protecting the daily reminder cron route.
  CRON_SECRET: z.string().optional(),

  // Optional: internal superuser emails (comma-separated). Gate cross-workspace
  // margin monitoring on /admin. Empty → nobody sees the internal margin view.
  SUPERUSER_EMAILS: z.string().optional(),

  // Optional: PortOne v2 billing (정기결제, TossPayments PG). Without these the
  // billing UI shows "준비중" and the app stays fully usable (dev/internal).
  PORTONE_API_SECRET: z.string().optional(), // V2 API secret (server-only)
  PORTONE_WEBHOOK_SECRET: z.string().optional(), // Standard Webhooks signing secret
  NEXT_PUBLIC_PORTONE_STORE_ID: z.string().optional(), // store-... (browser SDK)
  NEXT_PUBLIC_PORTONE_CHANNEL_KEY: z.string().optional(), // TossPayments billing channel

  // Public site URL — used to build auth redirect/callback links.
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Optional: Sentry error monitoring. Without a DSN, reporting is a no-op and
  // errors are written to the structured logger only.
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // Optional: disable rate limiting (e.g. for local load tests). Defaults on.
  RATE_LIMIT_DISABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: serverSchema.shape.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: serverSchema.shape.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: serverSchema.shape.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_PORTONE_STORE_ID: serverSchema.shape.NEXT_PUBLIC_PORTONE_STORE_ID,
  NEXT_PUBLIC_PORTONE_CHANNEL_KEY: serverSchema.shape.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
  NEXT_PUBLIC_SENTRY_DSN: serverSchema.shape.NEXT_PUBLIC_SENTRY_DSN,
});

const isServer = typeof window === "undefined";

function formatErrors(error: z.ZodError): string {
  return error.errors.map((e) => `  • ${e.path.join(".") || "(root)"}: ${e.message}`).join("\n");
}

function parseEnv() {
  // On the client, `process.env` only contains inlined NEXT_PUBLIC_* vars.
  const schema = isServer ? serverSchema : clientSchema;
  const source = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_PORTONE_STORE_ID: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
    NEXT_PUBLIC_PORTONE_CHANNEL_KEY: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    ...(isServer
      ? {
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          AI_DAILY_CLASSIFY_LIMIT: process.env.AI_DAILY_CLASSIFY_LIMIT,
          SMTP_HOST: process.env.SMTP_HOST,
          SMTP_PORT: process.env.SMTP_PORT,
          SMTP_USER: process.env.SMTP_USER,
          SMTP_PASS: process.env.SMTP_PASS,
          SMTP_FROM: process.env.SMTP_FROM,
          SOLAPI_API_KEY: process.env.SOLAPI_API_KEY,
          SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET,
          SOLAPI_SENDER: process.env.SOLAPI_SENDER,
          SOLAPI_PFID: process.env.SOLAPI_PFID,
          SOLAPI_KAKAO_TEMPLATE_ID: process.env.SOLAPI_KAKAO_TEMPLATE_ID,
          CODEF_CLIENT_ID: process.env.CODEF_CLIENT_ID,
          CODEF_CLIENT_SECRET: process.env.CODEF_CLIENT_SECRET,
          CODEF_PUBLIC_KEY: process.env.CODEF_PUBLIC_KEY,
          SOLAPI_WEBHOOK_SECRET: process.env.SOLAPI_WEBHOOK_SECRET,
          CRON_SECRET: process.env.CRON_SECRET,
          SUPERUSER_EMAILS: process.env.SUPERUSER_EMAILS,
          SENTRY_DSN: process.env.SENTRY_DSN,
          RATE_LIMIT_DISABLED: process.env.RATE_LIMIT_DISABLED,
          PORTONE_API_SECRET: process.env.PORTONE_API_SECRET,
          PORTONE_WEBHOOK_SECRET: process.env.PORTONE_WEBHOOK_SECRET,
          NODE_ENV: process.env.NODE_ENV,
        }
      : {}),
  };

  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const message = `Invalid environment variables:\n${formatErrors(parsed.error)}\n\nSee .env.example and README.md for the required configuration.`;

    // Production: fail fast — never boot with a broken config.
    if (process.env.NODE_ENV === "production") {
      throw new Error(`❌ ${message}`);
    }

    // Dev / preview (incl. StackBlitz WebContainer): don't crash the server.
    // Boot with safe demo placeholders so the public app renders; Supabase-backed
    // features simply won't work until real keys are provided. This keeps
    // "open in StackBlitz from a GitHub link" working without any setup.
    console.warn(`⚠️ ${message}\n→ 개발 모드: 데모 placeholder 로 부팅합니다(인증/DB 기능 비활성).`);
    return schema.parse({
      ...source,
      NEXT_PUBLIC_SUPABASE_URL:
        source.NEXT_PUBLIC_SUPABASE_URL || "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        source.NEXT_PUBLIC_SUPABASE_ANON_KEY || "stackblitz-demo-anon-key",
    });
  }

  return parsed.data;
}

export const env = parseEnv() as z.infer<typeof serverSchema>;

/**
 * Feature flags derived from configuration. External integrations are gated
 * here so the rest of the app can check `features.X` instead of poking at env.
 */
export const features = {
  /** Service-role operations (admin scripts, privileged maintenance jobs). */
  serviceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  /** Claude API document auto-classification. Off → manual classification only. */
  aiClassification: Boolean(env.ANTHROPIC_API_KEY),
  /** Real outbound email. Off → email channel logs instead of sending. */
  email: Boolean(env.SMTP_HOST && env.SMTP_FROM),
  /** Solapi SMS available (Kakao/SMS adapters). Off → fall back to email. */
  solapi: Boolean(env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && env.SOLAPI_SENDER),
  /** KakaoTalk 알림톡 available (needs Solapi + channel id + template id). */
  kakao: Boolean(
    env.SOLAPI_API_KEY &&
    env.SOLAPI_API_SECRET &&
    env.SOLAPI_SENDER &&
    env.SOLAPI_PFID &&
    env.SOLAPI_KAKAO_TEMPLATE_ID,
  ),
  /**
   * PortOne billing available. Needs the server API secret + the browser SDK
   * identifiers. Off → billing UI shows "준비중", subscriptions disabled, but the
   * core app stays fully usable (graceful degradation).
   */
  billing: Boolean(
    env.PORTONE_API_SECRET &&
    env.NEXT_PUBLIC_PORTONE_STORE_ID &&
    env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
  ),
  /** Webhook signature verification possible (PortOne webhook secret present). */
  billingWebhook: Boolean(env.PORTONE_WEBHOOK_SECRET),
  /** Sentry error monitoring active (server DSN present). Off → no-op + logs. */
  sentry: Boolean(env.SENTRY_DSN),
  /** CODEF scraping available globally (env). Workspace settings can also enable. */
  codef: Boolean(env.CODEF_CLIENT_ID && env.CODEF_CLIENT_SECRET),
} as const;

/**
 * Defence-in-depth: ensure no server secret is accidentally exposed to the
 * browser via a `NEXT_PUBLIC_` name. Public vars must be non-sensitive
 * (publishable keys, URLs). Runs on the server at boot.
 */
if (isServer) {
  const PUBLIC_SECRET_HINTS = /(SECRET|SERVICE_ROLE|PASS|PRIVATE|TOKEN|API_KEY)$/;
  const leaked = Object.keys(process.env).filter(
    (k) => k.startsWith("NEXT_PUBLIC_") && PUBLIC_SECRET_HINTS.test(k),
  );
  if (leaked.length > 0) {
    throw new Error(
      `❌ 보안: NEXT_PUBLIC_ 접두사로 노출된 비밀 의심 변수: ${leaked.join(", ")}\n` +
        `비밀 값은 절대 NEXT_PUBLIC_ 로 노출하지 마세요(서버 전용 변수로 옮기세요).`,
    );
  }
}

/** Internal superusers (cross-workspace margin monitor). Parsed once. */
export const SUPERUSER_EMAILS: string[] = (env.SUPERUSER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Whether `email` is an internal superuser. */
export function isSuperuser(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPERUSER_EMAILS.includes(email.toLowerCase());
}

/** Supabase Storage bucket holding collected client documents. */
export const DOCUMENTS_BUCKET = "documents";

export type Env = typeof env;
