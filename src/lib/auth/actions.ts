"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { action, ActionException, voidAction } from "@/lib/actions/safe-action";
import {
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updatePasswordSchema,
} from "@/lib/auth/schemas";
import { env } from "@/lib/env";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { clientIpFrom, guard } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

/** Resolve the public origin for building auth redirect links. */
async function getOrigin(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Throttle auth attempts per client IP (credential stuffing / spam guard). */
async function assertAuthRateLimit(scope: string): Promise<void> {
  const ip = clientIpFrom(await headers());
  if (!guard(`auth:${scope}:${ip}`, RATE_LIMITS.auth).ok) {
    throw new ActionException("RATE_LIMITED", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export const signUpAction = action(signupSchema, async (input) => {
  await assertAuthRateLimit("signup");
  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // Consumed by the handle_new_user() trigger to seed workspace + owner.
      data: {
        office_name: input.officeName,
        full_name: input.fullName,
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.message.includes("already registered")) {
      throw new ActionException("CONFLICT", "이미 가입된 이메일입니다.");
    }
    throw new ActionException("INTERNAL", error.message);
  }

  return { email: input.email };
});

export const signInAction = action(loginSchema, async (input) => {
  await assertAuthRateLimit("login");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    throw new ActionException("UNAUTHORIZED", "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  return { redirectTo: input.redirectTo || "/dashboard" };
});

export const requestPasswordResetAction = action(resetPasswordSchema, async (input) => {
  await assertAuthRateLimit("reset");
  const supabase = await createClient();
  const origin = await getOrigin();

  // Always succeeds from the caller's perspective to avoid leaking which
  // emails are registered.
  await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  return { email: input.email };
});

export const updatePasswordAction = action(updatePasswordSchema, async (input) => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new ActionException("UNAUTHORIZED", "세션이 만료되었습니다. 다시 시도해 주세요.");
  }

  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    throw new ActionException("INTERNAL", error.message);
  }

  return { ok: true };
});

export const signOutAction = voidAction(async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
});

/** Sign out then redirect — convenience for menu/button handlers. */
export async function signOutAndRedirect() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
