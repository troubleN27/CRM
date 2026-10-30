import { getTranslations, setRequestLocale } from "next-intl/server";
import { LiveCityMap } from "@/components/map/LiveCityMap";
import { cityMap } from "@/lib/dashboard";
import { requireUser } from "@/lib/session";

// «На карте города»: офис, заявки и сотрудники вне офиса — только админ (CLAUDE.md, «Доступ»).
export default async function MapPage({ params }: PageProps<"/[locale]/map">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["ADMIN"]);
  const t = await getTranslations("map");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium text-fg">{t("title")}</h1>
        <p className="text-sm text-fg-2">{t("hint")}</p>
      </div>
      <LiveCityMap initial={await cityMap(locale)} />
    </div>
  );
}
