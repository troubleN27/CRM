import { getTranslations, setRequestLocale } from "next-intl/server";
import { TimelineView } from "@/components/timeline/TimelineView";
import { pageTitleClass } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { todayInOffice } from "@/lib/time";
import { timelineData } from "@/lib/timeline";

// «Время»: ресурсное планирование — кто когда был в офисе и вне его.
export default async function TimelinePage({ params }: PageProps<"/[locale]/timeline">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["ADMIN", "MANAGER"]);
  const t = await getTranslations("timeline");

  return (
    <div className="space-y-4">
      <div>
        <h1 className={pageTitleClass}>{t("title")}</h1>
        <p className="text-sm text-fg-2">{t("hint")}</p>
      </div>
      <TimelineView initial={await timelineData("day", todayInOffice())} />
    </div>
  );
}
