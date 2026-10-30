"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import type { SegmentKind, TimelineData, TimelineView as View } from "@/lib/timeline";
import { Icon } from "../icons";

const DAY_FROM = 7 * 60; // ось дня: 07:00–21:00
const DAY_TO = 21 * 60;
const pct = (m: number) => `${((Math.min(DAY_TO, Math.max(DAY_FROM, m)) - DAY_FROM) / (DAY_TO - DAY_FROM)) * 100}%`;
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const VIEWS: View[] = ["day", "week", "month"];

const segmentClass: Record<SegmentKind, string> = {
  office: "bg-brand border-brand-fg/60",
  LUNCH: "bg-success-bg border-success/60",
  CLIENT_VISIT: "bg-warning-bg border-warning/60",
  PERSONAL: "bg-pressed border-fg-2/60",
};

function shift(date: string, view: View, dir: number) {
  const d = new Date(`${date}T00:00:00Z`);
  if (view === "day") d.setUTCDate(d.getUTCDate() + dir);
  else if (view === "week") d.setUTCDate(d.getUTCDate() + 7 * dir);
  else d.setUTCMonth(d.getUTCMonth() + dir, 1);
  return d.toISOString().slice(0, 10);
}

// Диаграмма Ганта рабочего времени. Масштаб День ↔ Неделя ↔ Месяц меняется плавным «зумом» без рывков.
export function TimelineView({ initial }: { initial: TimelineData }) {
  const t = useTranslations("timeline");
  const tr = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [dir, setDir] = useState(0);

  const load = async (view: View, date: string) => {
    setLoading(true);
    const res = await fetch(`/api/timeline?view=${view}&date=${date}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData(await res.json());
    setLoading(false);
  };
  const zoom = (view: View) => {
    if (view === data.view) return;
    setDir(VIEWS.indexOf(view) < VIEWS.indexOf(data.view) ? 1 : -1);
    void load(view, data.date);
  };
  const move = (step: number) => {
    setDir(0);
    void load(data.view, shift(data.date, data.view, step));
  };

  const label = (() => {
    const d = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", ...o });
    if (data.view === "day") return d(data.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (data.view === "week") return `${d(data.dates[0], { day: "numeric", month: "short" })} — ${d(data.dates.at(-1)!, { day: "numeric", month: "short", year: "numeric" })}`;
    return d(data.date, { month: "long", year: "numeric" });
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutGroup id="timeline-zoom">
          <div role="group" aria-label={t("zoom")} className="flex rounded-md border border-line bg-surface p-1">
            {VIEWS.map((v) => (
              <button key={v} type="button" onClick={() => zoom(v)} aria-pressed={data.view === v} className={`relative rounded px-3 py-1.5 text-sm transition-colors ${data.view === v ? "text-fg" : "text-fg-2 hover:text-fg"}`}>
                {data.view === v && <motion.span layoutId="zoom-indicator" className="absolute inset-0 rounded bg-pressed" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                <span className="relative">{t(`view.${v}`)}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => move(-1)} aria-label={t("prev")} className="flex h-9 w-9 items-center justify-center rounded border border-line text-fg-2 hover:border-line-strong hover:text-fg">
            <Icon name="chevronLeft" />
          </button>
          <button type="button" onClick={() => {
              setDir(0);
              void load(data.view, data.today);
            }} className="h-9 rounded border border-line px-3 text-sm text-fg-2 hover:border-line-strong hover:text-fg">
            {t("today")}
          </button>
          <button type="button" onClick={() => move(1)} aria-label={t("next")} className="flex h-9 w-9 items-center justify-center rounded border border-line text-fg-2 hover:border-line-strong hover:text-fg">
            <Icon name="chevronRight" />
          </button>
        </div>
        <span className="text-sm text-fg first-letter:uppercase">{label}</span>
        <Legend />
      </div>

      <div data-lenis-prevent className={`relative overflow-x-auto rounded-lg border border-line bg-surface transition-opacity duration-200 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={`${data.view}-${data.date}`}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, scale: d > 0 ? 0.96 : d < 0 ? 1.04 : 1, x: d === 0 ? 12 : 0 }),
              center: { opacity: 1, scale: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, scale: d > 0 ? 1.04 : d < 0 ? 0.96 : 1 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "50% 0%" }}
            className="min-w-[720px]"
          >
            {data.view === "day" && <DayGrid data={data} />}
            {data.view === "week" && <WeekGrid data={data} />}
            {data.view === "month" && <MonthGrid data={data} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="text-xs text-fg-2">{tr("timeline.footnote")}</p>
    </div>
  );
}

function Legend() {
  const t = useTranslations("timeline");
  return (
    <div className="ml-auto flex flex-wrap gap-3 text-xs text-fg-2">
      {(Object.keys(segmentClass) as SegmentKind[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-4 rounded-sm border ${segmentClass[k]}`} />
          {t(`segment.${k}`)}
        </span>
      ))}
    </div>
  );
}

const nameCol = "sticky left-0 z-10 w-52 shrink-0 border-r border-line bg-surface px-3 py-2";

function DayGrid({ data }: { data: TimelineData }) {
  const t = useTranslations("timeline");
  const hours = Array.from({ length: (DAY_TO - DAY_FROM) / 60 + 1 }, (_, i) => DAY_FROM + i * 60);
  const isToday = data.date === data.today;
  return (
    <div role="table" aria-label={t("title")}>
      <div role="row" className="flex border-b border-line text-xs text-fg-2">
        <div role="columnheader" className={`${nameCol} uppercase tracking-wide`}>{t("employee")}</div>
        <div className="relative h-8 flex-1">
          {hours.map((h) => (
            <span key={h} className="num absolute top-2 -translate-x-1/2" style={{ left: pct(h) }}>
              {String(h / 60).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>
      {data.rows.map((r) => {
        const day = r.days[0];
        return (
          <div role="row" key={r.employeeId} className="flex border-b border-line transition-colors last:border-0 hover:bg-elevated">
            <div role="rowheader" className={nameCol}>
              <div className="truncate text-sm text-fg">{r.name}</div>
              <div className="num text-xs text-fg-2">{day.segments.length ? `${hm(day.officeMinutes)} · ${hm(day.outMinutes)}` : "—"}</div>
            </div>
            <div role="cell" className="relative flex-1">
              {hours.map((h) => (
                <span key={h} className="absolute inset-y-0 w-px bg-line" style={{ left: pct(h) }} />
              ))}
              {day.segments.map((s, i) => (
                <motion.span
                  key={i}
                  title={`${t(`segment.${s.kind}`)}: ${hm(s.start)}–${hm(s.end)}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 26, delay: i * 0.03 }}
                  style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})`, transformOrigin: "0 50%" }}
                  className={`absolute top-1/2 h-5 -translate-y-1/2 rounded-sm border ${segmentClass[s.kind]}`}
                />
              ))}
              {day.late && <span className="absolute top-1 h-1.5 w-1.5 rounded-full bg-danger" style={{ left: pct(day.segments[0]?.start ?? DAY_FROM) }} title={t("late")} />}
              {isToday && <span className="absolute inset-y-0 w-px bg-danger/70" style={{ left: pct(data.nowMinute) }} aria-hidden />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekGrid({ data }: { data: TimelineData }) {
  const t = useTranslations("timeline");
  const locale = useLocale();
  const SCALE = 10 * 60; // полная ширина ячейки — 10 часов
  return (
    <div role="table" aria-label={t("title")}>
      <div role="row" className="flex border-b border-line text-xs text-fg-2">
        <div role="columnheader" className={`${nameCol} uppercase tracking-wide`}>{t("employee")}</div>
        {data.dates.map((d) => (
          <div key={d} role="columnheader" className={`num flex-1 border-r border-line px-3 py-2 last:border-0 ${d === data.today ? "text-fg" : ""}`}>
            {new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" })}
          </div>
        ))}
      </div>
      {data.rows.map((r) => (
        <div role="row" key={r.employeeId} className="flex border-b border-line transition-colors last:border-0 hover:bg-elevated">
          <div role="rowheader" className={`${nameCol} truncate text-sm text-fg`}>{r.name}</div>
          {r.days.map((d) => (
            <div key={d.date} role="cell" className="flex-1 space-y-1 border-r border-line px-3 py-2 last:border-0">
              {d.officeMinutes + d.outMinutes > 0 ? (
                <>
                  <div className="flex h-2 overflow-hidden rounded-sm border border-line bg-canvas">
                    <motion.span className="h-full bg-brand" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (d.officeMinutes / SCALE) * 100)}%` }} transition={{ type: "spring", stiffness: 160, damping: 24 }} />
                    <motion.span className="h-full bg-warning-bg" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (d.outMinutes / SCALE) * 100)}%` }} transition={{ type: "spring", stiffness: 160, damping: 24 }} />
                  </div>
                  <div className="num flex items-center gap-1.5 text-xs text-fg-2">
                    {hm(d.officeMinutes)}
                    {d.outMinutes > 0 && <span className="text-fg-3">+{hm(d.outMinutes)}</span>}
                    {d.late && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-danger" title={t("late")} />}
                  </div>
                </>
              ) : (
                <span className="text-xs text-fg-3">—</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Месяц: ячейка на день, плотность — ступенями сплошного цвета (без градиентов).
function MonthGrid({ data }: { data: TimelineData }) {
  const t = useTranslations("timeline");
  const level = (m: number) => (m === 0 ? "bg-canvas" : m < 4 * 60 ? "bg-pressed" : m < 7 * 60 ? "bg-brand/50" : "bg-brand");
  return (
    <div role="table" aria-label={t("title")}>
      <div role="row" className="flex border-b border-line text-xs text-fg-2">
        <div role="columnheader" className={`${nameCol} uppercase tracking-wide`}>{t("employee")}</div>
        <div className="flex flex-1 gap-px px-2 py-2">
          {data.dates.map((d) => (
            <span key={d} className={`num w-6 shrink-0 text-center ${d === data.today ? "text-fg" : ""}`}>
              {d.slice(8)}
            </span>
          ))}
        </div>
      </div>
      {data.rows.map((r) => (
        <div role="row" key={r.employeeId} className="flex border-b border-line transition-colors last:border-0 hover:bg-elevated">
          <div role="rowheader" className={`${nameCol} truncate text-sm text-fg`}>{r.name}</div>
          <div className="flex flex-1 items-center gap-px px-2 py-2">
            {r.days.map((d) => {
              const weekend = [0, 6].includes(new Date(`${d.date}T00:00:00Z`).getUTCDay());
              return (
                <span
                  key={d.date}
                  role="cell"
                  title={`${d.date}: ${hm(d.officeMinutes)}${d.late ? ` · ${t("late")}` : ""}`}
                  className={`h-6 w-6 shrink-0 rounded-sm border ${d.late ? "border-danger/70" : "border-line"} ${level(d.officeMinutes)} ${weekend ? "opacity-40" : ""}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
