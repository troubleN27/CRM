import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { loadOfficePlan } from "@/lib/office-data";
import { requireUser } from "@/lib/session";
import { PLAN_H, PLAN_W } from "@/lib/test-plan";
import { PlanEditor } from "./PlanEditor";

export default async function OfficeEditPage({ params }: PageProps<"/[locale]/office/edit">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["ADMIN"]);
  const t = await getTranslations("office");

  const [{ plan, zones, desks }, employees] = await Promise.all([
    loadOfficePlan(),
    db.employee.findMany({ where: { isActive: true }, include: { desk: true }, orderBy: [{ lastName: "asc" }] }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-medium text-fg">{t("editTitle")}</h1>
        <Link href="/office" className="ml-auto text-sm text-brand-fg hover:underline">
          {t("viewLink")}
        </Link>
      </div>
      {!plan && <p className="rounded-md bg-warning-bg p-3 text-sm text-warning">{t("noPlan")}</p>}
      <PlanEditor
        plan={plan ?? { url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", width: PLAN_W, height: PLAN_H }}
        zones={zones}
        desks={desks}
        employees={employees.map((e) => ({
          id: e.id,
          label: `${e.lastName} ${e.firstName}`,
          deskCode: e.desk?.code ?? null,
        }))}
      />
    </div>
  );
}
