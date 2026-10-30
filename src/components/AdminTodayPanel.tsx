import { getTranslations } from "next-intl/server";
import { isPastGrace, workDayDate } from "@/lib/attendance/time";
import { db } from "@/lib/db";
import { formatOfficeTime } from "@/lib/time";

// Для админа: кто не отметился после 09:05 и кто сегодня опоздал.
export async function AdminTodayPanel({ locale }: { locale: string }) {
  const t = await getTranslations("attendance");
  const now = new Date();
  const pastGrace = isPastGrace(now);

  const people = await db.employee.findMany({
    where: { isActive: true, user: { is: { role: { in: ["EMPLOYEE", "MANAGER"] } } } },
    include: { desk: true, workDays: { where: { date: workDayDate(now) } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const notChecked = people.filter((p) => p.workDays.length === 0);
  const late = people
    .filter((p) => p.workDays[0]?.isLate)
    .sort((a, b) => b.workDays[0].lateMinutes - a.workDays[0].lateMinutes);
  const name = (p: (typeof people)[number]) => `${p.firstName} ${p.lastName}`;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section data-testid="not-checked" className="space-y-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-medium">
          {t("notCheckedTitle")} {pastGrace && <span className="text-danger">· {notChecked.length}</span>}
        </h2>
        {!pastGrace && <p className="text-sm text-fg-2">{t("notCheckedBefore", { count: notChecked.length })}</p>}
        {pastGrace && notChecked.length === 0 && <p className="text-sm text-success">{t("allChecked")}</p>}
        {pastGrace && notChecked.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {notChecked.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span className="font-medium text-danger">{name(p)}</span>
                <span className="text-fg-2">
                  {p.position}
                  {p.desk && ` · ${t("deskInfo", { code: p.desk.code })}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-testid="late-today" className="space-y-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-medium">{t("lateTitle")}</h2>
        {late.length === 0 && <p className="text-sm text-fg-2">{t("noLate")}</p>}
        {late.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {late.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span className="font-medium">{name(p)}</span>
                <span className="text-fg-2">
                  {t("arrivedAt", { time: formatOfficeTime(p.workDays[0].firstInAt, locale) })} ·{" "}
                  <span className="text-danger">{t("late", { minutes: p.workDays[0].lateMinutes })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
