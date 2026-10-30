"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loginAction } from "./actions";
import { inputClass, buttonClass } from "@/components/ui";

export function LoginForm() {
  const t = useTranslations("login");
  const locale = useLocale();
  const [state, action, pending] = useActionState(loginAction.bind(null, locale), {});

  return (
    <form key={state.attempt ?? 0} action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm text-fg-2">{t("login")}</span>
        <input name="login" defaultValue={state.login} autoComplete="username" required autoFocus className={inputClass} />
      </label>
      <label className="block">
        <span className="text-sm text-fg-2">{t("password")}</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {t("error")}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {t("submit")}
      </button>
    </form>
  );
}
