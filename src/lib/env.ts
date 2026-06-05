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

  // Optional: shared secret protecting the daily reminder cron route.
  CRON_SECRET: z.string().optional(),

  // Public site URL — used to build auth redirect/callback links.
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: serverSchema.shape.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: serverSchema.shape.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: serverSchema.shape.NEXT_PUBLIC_SITE_URL,
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
          CRON_SECRET: process.env.CRON_SECRET,
          NODE_ENV: process.env.NODE_ENV,
        }
      : {}),
  };

  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const message = `❌ Invalid environment variables:\n${formatErrors(parsed.error)}\n\nSee .env.example and README.md for the required configuration.`;
    // Throwing here surfaces a clear boot-time error instead of a cryptic runtime failure.
    throw new Error(message);
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
} as const;

/** Supabase Storage bucket holding collected client documents. */
export const DOCUMENTS_BUCKET = "documents";

export type Env = typeof env;
