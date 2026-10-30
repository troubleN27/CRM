"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { EDITABLE_ROLES } from "@/lib/validation";
import type { FormState } from "@/lib/forms";

type Values = {
  firstName: string;
  lastName: string;
  position: string;
  login: string;
  role: (typeof EDITABLE_ROLES)[number];
  deskId: string;
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  desks: { id: string; code: string; pcNumber: string | null }[];
  values?: Values;
  isEdit?: boolean;
};

export function EmployeeForm({ action, desks, values: initial, isEdit }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  const values = (state.values as Values | undefined) ?? initial;
  const err = (field: string) =>
    state.errors?.[field] && <p className="mt-1 text-xs text-danger">{t(`errors.${state.errors[field]}`)}</p>;

  const text = (name: keyof Values, autoComplete = "off") => (
    <label className="block">
      <span className="text-sm text-fg-2">{t(`employees.${name}`)}</span>
      <input name={name} defaultValue={values?.[name]} autoComplete={autoComplete} className={inputClass} />
      {err(name)}
    </label>
  );

  return (
    <form key={state.attempt ?? 0} action={formAction} className="max-w-lg space-y-4 rounded-lg border border-line bg-surface p-6">
      {err("form")}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("firstName")}
        {text("lastName")}
      </div>
      {text("position")}
      {text("login")}

      <label className="block">
        <span className="text-sm text-fg-2">{t("employees.role")}</span>
        <select name="role" defaultValue={values?.role ?? "EMPLOYEE"} className={inputClass}>
          {EDITABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-fg-2">{t("employees.desk")}</span>
        <select name="deskId" defaultValue={values?.deskId ?? ""} className={inputClass}>
          <option value="">{t("employees.noDesk")}</option>
          {desks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code}
              {d.pcNumber && ` · ${d.pcNumber}`}
            </option>
          ))}
        </select>
        {err("deskId")}
      </label>

      <label className="block">
        <span className="text-sm text-fg-2">{t("employees.password")}</span>
        <input name="password" type="password" autoComplete="new-password" className={inputClass} />
        {isEdit && <p className="mt-1 text-xs text-fg-2">{t("employees.passwordHint")}</p>}
        {err("password")}
      </label>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("common.save")}
        </button>
        <Link href="/employees" className={secondaryButtonClass}>
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
