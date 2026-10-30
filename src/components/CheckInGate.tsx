import { getTranslations } from"next-intl/server";
import { checkInAction } from"@/app/[locale]/(app)/attendance-actions";
import { ConfirmSubmit } from"./ConfirmSubmit";
import { PlanCanvas } from"./office/PlanCanvas";
import { db } from"@/lib/db";
import { loadOfficePlan } from"@/lib/office-data";
import { formatOfficeTime } from"@/lib/time";

// Пока сотрудник не нажал «Я пришёл», вместо любой страницы видит этот экран:
// кнопку и своё рабочее место на плане.
export async function CheckInGate({ employeeId, locale }: { employeeId: string; locale: string }) {
  const t = await getTranslations("attendance");
  const [me, { plan, zones, desks }] = await Promise.all([
    db.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { desk: true } }),
    loadOfficePlan(),
  ]);

  return (
    <div data-testid="check-in" className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3 rounded-lg border border-line bg-surface p-6 text-center">
        <h1 className="text-xl font-medium text-fg">{t("checkInTitle", { name: me.firstName })}</h1>
        <p className="text-fg-2">{t("checkInText")}</p>
        <p className="text-sm text-fg-2">{t("nowOffice", { time: formatOfficeTime(new Date(), locale) })}</p>
        <form action={checkInAction.bind(null, locale)}>
          <ConfirmSubmit className="rounded-lg bg-brand px-10 py-4 text-lg font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-50">
            {t("checkIn")}
          </ConfirmSubmit>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">{t("yourDesk")}</h2>
        {me.desk ? (
          <p data-testid="my-desk" className="text-fg">
            {t("deskInfo", { code: me.desk.code })}
            {me.desk.pcNumber &&` · ${t("pcInfo", { pc: me.desk.pcNumber })}`}
          </p>
        ) : (
          <p className="rounded-md bg-warning-bg p-3 text-sm text-warning">{t("noDesk")}</p>
        )}
        {plan && <PlanCanvas plan={plan} zones={zones} desks={desks} selectedId={me.deskId} />}
      </div>
    </div>
  );
}
