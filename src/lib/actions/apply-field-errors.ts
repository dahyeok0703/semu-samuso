import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ActionError } from "@/lib/actions/safe-action";

/**
 * Pushes server-side field errors from an ActionResult into a react-hook-form
 * instance so they render inline next to the matching inputs.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: ActionError,
  setError: UseFormSetError<T>,
): void {
  if (!error.fieldErrors) return;
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    if (messages && messages.length > 0) {
      setError(field as Path<T>, { type: "server", message: messages[0] });
    }
  }
}
