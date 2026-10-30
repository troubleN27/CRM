import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LiveOfficePlan } from "@/components/office/LiveOfficePlan";
import { livePeople } from "@/lib/positions";
import { buttonClass, statusColor } from "@/components/ui";
import { loadOfficePlan } from "@/lib/office-data";
import { requireUser } from "@/lib/session";

export default async function OfficePage({ params }: PageProps<"/[locale]/office">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();
  const [{ plan, zones, desks }, people] = await Promise.all([loadOfficePlan(), livePeople()]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-medium text-fg">{t("office.title")}</h1>
        {user.role === "ADMIN" && (
          <Link href="/office/edit" className={`${buttonClass} ml-auto`}>
            {t("office.editLink")}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {(["IN_OFFICE", "OUT_OF_OFFICE", "OFF_WORK"] as const).map((s) => (
          <span key={s} className={`rounded px-2 py-0.5 ${statusColor[s]}`}>
            {t(`status.${s}`)}
          </span>
        ))}
        <span className="rounded border border-dashed border-line-strong px-2 py-0.5 text-fg-2">{t("office.free")}</span>
      </div>

      {plan ? (
        <LiveOfficePlan
          plan={plan}
          zones={zones}
          desks={desks}
          // Точки в городе видит только админ — остальным отдаём только офис.
          people={people.map((p) => ({
            employeeId: p.employeeId,
            name: p.name,
            initials: p.initials,
            status: p.status,
            desk: p.desk,
            last: p.last?.kind === "OFFICE" ? { kind: p.last.kind, x: p.last.x, y: p.last.y } : null,
          }))}
        />
      ) : (
        <p className="rounded-md bg-warning-bg p-3 text-sm text-warning">{t("office.noPlan")}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-fg-2">
            <tr>
              <th className="px-4 py-3">{t("office.desk")}</th>
              <th className="px-4 py-3">{t("office.pcNumber")}</th>
              <th className="px-4 py-3">{t("office.employee")}</th>
              <th className="px-4 py-3">{t("employees.status")}</th>
            </tr>
          </thead>
          <tbody>
            {desks.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium">{d.code}</td>
                <td className="px-4 py-2 font-mono text-xs">{d.pcNumber ?? "—"}</td>
                <td className="px-4 py-2">{d.employee?.name ?? <span className="text-fg-3">{t("office.free")}</span>}</td>
                <td className="px-4 py-2">
                  {d.employee && (
                    <span className={`rounded px-2 py-0.5 text-xs ${statusColor[d.employee.status]}`}>
                      {t(`status.${d.employee.status}`)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
