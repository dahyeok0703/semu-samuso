import { z } from "zod";

/**
 * Unified result envelope returned by every server action.
 * Discriminated on `ok` so callers can narrow safely.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export type ActionError = {
  /** Stable, machine-readable code for the client to branch on. */
  code: ActionErrorCode;
  /** Human-readable message safe to show to the user. */
  message: string;
  /** Field-level validation messages, keyed by form field name. */
  fieldErrors?: Record<string, string[] | undefined>;
};

export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

/**
 * Thrown inside an action handler to short-circuit with a typed error.
 * Anything else thrown is treated as an unexpected INTERNAL error.
 */
export class ActionException extends Error {
  constructor(
    public readonly code: ActionErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "ActionException";
  }
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[] | undefined>,
): ActionResult<never> => ({ ok: false, error: { code, message, fieldErrors } });

type Handler<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

/**
 * Wraps a server action handler with:
 *  1. zod input validation (returns a VALIDATION result on failure)
 *  2. a try/catch that maps thrown errors to a uniform ActionResult
 *
 * Usage:
 *   export const createClientAction = action(createClientSchema, async (input) => {
 *     // input is fully typed & validated
 *     return created;
 *   });
 */
export function action<TSchema extends z.ZodTypeAny, TOutput>(
  schema: TSchema,
  handler: Handler<z.infer<TSchema>, TOutput>,
) {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    const parsed = schema.safeParse(rawInput);

    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return fail("VALIDATION", "입력값을 확인해 주세요.", flat.fieldErrors);
    }

    try {
      const data = await handler(parsed.data);
      return ok(data);
    } catch (error) {
      if (error instanceof ActionException) {
        return fail(error.code, error.message, error.fieldErrors);
      }

      // Unexpected: log server-side, return an opaque message to the client.
      console.error("[action] unhandled error:", error);
      return fail("INTERNAL", "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };
}

/**
 * Variant for actions that take no input (e.g. sign-out). Same error mapping.
 */
export function voidAction<TOutput>(handler: () => Promise<TOutput>) {
  return async (): Promise<ActionResult<TOutput>> => {
    try {
      return ok(await handler());
    } catch (error) {
      if (error instanceof ActionException) {
        return fail(error.code, error.message, error.fieldErrors);
      }
      console.error("[action] unhandled error:", error);
      return fail("INTERNAL", "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };
}
