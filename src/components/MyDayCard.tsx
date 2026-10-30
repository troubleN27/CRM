import { getTranslations } from "next-intl/server";
import { checkInAction, comeBackAction, endWorkAction, goOutAction } from "@/app/[locale]/(app)/attendance-actions";
import { db } from "@/lib/db";
import { workDayDate } from "@/lib/attendance/time";
import { formatOfficeTime } from "@/lib/time";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { inputClass } from "./ui";

const outButton = "rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-canvas disabled:opacity-50";

// «Мой день» на главной: приход, опоздание, «Вышел» / «Вернулся», «Закончить работу».
export async function MyDayCard({ employeeId, locale }: { employeeId: string; locale: string }) {
  const t = await getTranslations("attendance");
  const day = await db.workDay.findUnique({
    where: { employeeId_date: { employeeId, date: workDayDate(new Date()) } },
    include: { events: { orderBy: { at: "asc" }, include: { request: true } } },
  });
  const lastEvent = day?.events.at(-1);
  const isOut = Boolean(day && !day.endedAt && lastEvent?.type === "OUT");
  const myRequests =
    day && !day.endedAt && !isOut
      ? await db.request.findMany({ where: { assigneeId: employeeId, status: { not: "DONE" } }, include: { client: true }, orderBy: { number: "asc" } })
      : [];
  const time = (d: Date) => formatOfficeTime(d, locale);

  return (
    <section data-testid="my-day" className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="font-medium">{t("myDay")}</h2>

      {!day && (
        // Сюда попадает только админ: остальных до отметки встречает экран «Я пришёл».
        <form action={checkInAction.bind(null, locale)}>
          <ConfirmSubmit className="rounded-lg bg-brand px-6 py-2 font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-50">
            {t("checkIn")}
          </ConfirmSubmit>
        </form>
      )}

      {day && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{t("arrivedAt", { time: time(day.firstInAt) })}</span>
          {day.isLate ? (
            <span className="rounded bg-danger-bg px-2 py-0.5 text-danger">{t("late", { minutes: day.lateMinutes })}</span>
          ) : (
            <span className="rounded bg-success-bg px-2 py-0.5 text-success">{t("onTime")}</span>
          )}
          {day.endedAt && <span>{t("endedAt", { time: time(day.endedAt) })}</span>}
        </div>
      )}

      {day && !day.endedAt && !isOut && (
        <form action={goOutAction.bind(null, locale)} className="space-y-2">
          <p className="text-sm text-fg-2">{t("goOutTitle")}</p>
          <div className="flex flex-wrap gap-2">
            <ConfirmSubmit name="reason" value="LUNCH" className={outButton}>
              {t("out.LUNCH")}
            </ConfirmSubmit>
            <ConfirmSubmit name="reason" value="PERSONAL" className={outButton}>
              {t("out.PERSONAL")}
            </ConfirmSubmit>
            <ConfirmSubmit name="reason" value="CLIENT_VISIT" className={outButton}>
              {t("out.CLIENT_VISIT")}
            </ConfirmSubmit>
          </div>
          {myRequests.length > 0 && (
            <label className="block text-sm">
              <span className="text-fg-2">{t("visitRequest")}</span>
              <select name="requestId" className={inputClass} defaultValue={myRequests[0].id}>
                {myRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    #{r.number} · {r.client.name}
                  </option>
                ))}
                <option value="">{t("noRequest")}</option>
              </select>
            </label>
          )}
        </form>
      )}

      {isOut && lastEvent && (
        <div className="space-y-2">
          <p className="rounded bg-warning-bg px-3 py-2 text-sm text-warning">
            {t("outNow", { reason: t(`out.${lastEvent.reason}`), time: time(lastEvent.at) })}
            {lastEvent.request && ` · #${lastEvent.request.number}`}
          </p>
          <form action={comeBackAction.bind(null, locale)}>
            <ConfirmSubmit className="rounded-lg bg-brand px-6 py-2 font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-50">
              {t("comeBack")}
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {day && !day.endedAt && (
        <form action={endWorkAction.bind(null, locale)}>
          <ConfirmSubmit
            message={t("endConfirm")}
            className="rounded border border-line-strong bg-pressed px-5 py-2 text-sm font-medium text-fg transition-colors hover:border-fg-3 disabled:opacity-50"
          >
            {t("endWork")}
          </ConfirmSubmit>
        </form>
      )}

      {day?.endedAt && (
        <p className="text-sm text-fg-2">
          {t("dayEnded")} ·{" "}
          {t("worked", { hours: Math.floor(day.workedMinutes / 60), minutes: day.workedMinutes % 60 })}
        </p>
      )}
    </section>
  );
}
