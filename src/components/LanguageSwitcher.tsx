"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value })}
      className="h-9 rounded border border-line bg-surface px-2 text-sm text-fg-2 transition-colors hover:border-line-strong hover:text-fg focus:outline-none"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {l === "ru" ? "RU" : "UZ"}
        </option>
      ))}
    </select>
  );
}
