import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClass, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { todayInOffice } from "@/lib/time";

// «Отчёты»: выбрать даты и скачать Excel.
export default async function ReportsPage({ params }: PageProps<"/[locale]/reports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["ADMIN", "MANAGER"]);
  const t = await getTranslations("reports");

  const today = todayInOffice();
  const monthStart = `${today.slice(0, 8)}01`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium text-fg">{t("title")}</h1>
      <form method="get" action="/api/reports/attendance" className="max-w-xl space-y-4 rounded-lg border border-line bg-surface p-6">
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-fg-2">{t("from")}</span>
            <input type="date" name="from" required defaultValue={monthStart} max={today} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm text-fg-2">{t("to")}</span>
            <input type="date" name="to" required defaultValue={today} className={inputClass} />
          </label>
        </div>
        <button type="submit" className={buttonClass}>
          {t("download")}
        </button>
        <p className="text-xs text-fg-2">{t("hint")}</p>
      </form>
    </div>
  );
}
