import { getTranslations, setRequestLocale } from"next-intl/server";
import { AdminDashboard } from"@/components/dashboard/AdminDashboard";
import { AdminTodayPanel } from"@/components/AdminTodayPanel";
import { MyDayCard } from"@/components/MyDayCard";
import { adminDashboard } from"@/lib/dashboard";
import { db } from"@/lib/db";
import { loadOfficePlan } from"@/lib/office-data";
import { requireUser } from"@/lib/session";
import { formatOfficeTime } from"@/lib/time";
import { statusColor } from"@/components/ui";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();

  const me = await db.employee.findUniqueOrThrow({
    where: { id: user.employeeId },
    include: { desk: true },
  });
  const header = (
    <div className="flex flex-wrap items-baseline gap-3">
      <h1 className="text-xl font-medium text-fg">{t("home.hello", { name: me.firstName })}</h1>
      <span className="text-sm text-fg-2">{t("attendance.nowOffice", { time: formatOfficeTime(new Date(), locale) })}</span>
    </div>
  );

  // Главная админа: цифры, мини-карта офиса, лента событий; ниже — свой день и списки.
  if (user.role === "ADMIN") {
    const [dashboard, { plan, zones, desks }] = await Promise.all([adminDashboard(locale), loadOfficePlan()]);
    return (
      <div className="space-y-4">
        {header}
        <AdminDashboard initial={dashboard} plan={plan} zones={zones} desks={desks} />
        <div className="grid gap-4 lg:grid-cols-3">
          <MyDayCard employeeId={me.id} locale={locale} />
          <div className="lg:col-span-2">
            <AdminTodayPanel locale={locale} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <div className="grid gap-4 md:grid-cols-2">
        <MyDayCard employeeId={me.id} locale={locale} />
        <dl className="grid grid-cols-2 content-start gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
          <dt className="text-fg-2">{t("home.yourRole")}</dt>
          <dd data-testid="role">{t(`roles.${user.role}`)}</dd>
          <dt className="text-fg-2">{t("home.yourStatus")}</dt>
          <dd>
            <span className={`rounded px-2 py-0.5 ${statusColor[me.status]}`}>{t(`status.${me.status}`)}</span>
          </dd>
          <dt className="text-fg-2">{t("home.yourDesk")}</dt>
          <dd>
            {me.desk ? `${me.desk.code}${me.desk.pcNumber ? ` · ${me.desk.pcNumber}` : ""}` : t("employees.noDesk")}
          </dd>
        </dl>
      </div>
    </div>
  );
}
