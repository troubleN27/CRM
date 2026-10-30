"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocationPicker } from "@/components/map";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { FormState } from "@/lib/forms";

type Props = { action: (prev: FormState, formData: FormData) => Promise<FormState> };

export function ClientForm({ action }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values ?? {};
  const err = (field: string) =>
    state.errors?.[field] && <p className="mt-1 text-xs text-danger">{t(`errors.${state.errors[field]}`)}</p>;

  const text = (name: "name" | "phone" | "address", type = "text") => (
    <label className="block">
      <span className="text-sm text-fg-2">{t(`clients.${name}`)}</span>
      <input name={name} type={type} defaultValue={v[name]} className={inputClass} />
      {err(name)}
    </label>
  );

  return (
    <form key={state.attempt ?? 0} action={formAction} className="max-w-2xl space-y-4 rounded-lg border border-line bg-surface p-6">
      {err("form")}
      {text("name")}
      {text("phone", "tel")}
      {text("address")}
      <LocationPicker lat={v.lat} lng={v.lng} error={err("lat") || err("lng")} />
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("common.save")}
        </button>
        <Link href="/clients" className={secondaryButtonClass}>
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
