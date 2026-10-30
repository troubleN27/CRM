"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

// login и attempt нужны, чтобы после ошибки логин не стирался.
export type LoginState = { error?: boolean; login?: string; attempt?: number };

export async function loginAction(locale: string, prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      login: formData.get("login"),
      password: formData.get("password"),
      redirectTo: `/${locale}`,
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: true, login: String(formData.get("login") ?? ""), attempt: (prev.attempt ?? 0) + 1 };
    }
    throw e; // успешный вход — это redirect, его пробрасываем
  }
}
