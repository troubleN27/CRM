"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

type Option = { id: string; label: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  clients: Option[];
  employees: Option[];
  clientId?: string;
};

export function RequestForm({ action, clients, employees, clientId }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values ?? { clientId: clientId ?? "" };
  const err = (field: string) =>
    state.errors?.[field] && <p className="mt-1 text-xs text-danger">{t(`errors.${state.errors[field]}`)}</p>;

  return (
    <form key={state.attempt ?? 0} action={formAction} className="max-w-xl space-y-4 rounded-lg border border-line bg-surface p-6">
      {err("form")}
      <label className="block">
        <span className="text-sm text-fg-2">{t("requests.client")}</span>
        <select name="clientId" defaultValue={v.clientId} className={inputClass}>
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {err("clientId")}
      </label>

      <label className="block">
        <span className="text-sm text-fg-2">{t("requests.description")}</span>
        <textarea name="description" rows={4} defaultValue={v.description} className={inputClass} />
        {err("description")}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-fg-2">{t("requests.assignee")}</span>
          <select name="assigneeId" defaultValue={v.assigneeId ?? ""} className={inputClass}>
            <option value="">{t("requests.notAssigned")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          {err("assigneeId")}
        </label>
        <label className="block">
          <span className="text-sm text-fg-2">{t("requests.dueDate")}</span>
          <input type="date" name="dueDate" defaultValue={v.dueDate} className={inputClass} />
          {err("dueDate")}
        </label>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("common.save")}
        </button>
        <Link href="/requests" className={secondaryButtonClass}>
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
