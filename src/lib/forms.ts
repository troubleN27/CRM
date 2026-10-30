import type { z } from "zod";

// Общее для серверных форм: ошибки по полям и сохранение введённого после ошибки.
export type FormState = { errors?: Record<string, string>; values?: Record<string, string>; attempt?: number };

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    errors[field] ??= issue.message;
  }
  return errors;
}

// values и attempt нужны, чтобы после ошибки форма не очищалась (кроме пароля).
export function withValues(state: FormState, prev: FormState, formData: FormData): FormState {
  const values = Object.fromEntries(
    [...formData].filter(([k, v]) => k !== "password" && !k.startsWith("$") && typeof v === "string"),
  ) as Record<string, string>;
  return { ...state, values, attempt: (prev.attempt ?? 0) + 1 };
}
