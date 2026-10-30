"use client";

import { useTranslations } from "next-intl";
import type { DashboardPerson } from "@/lib/dashboard";
import { PlanCanvas, pct, type PlanDesk, type PlanImage, type PlanZone } from "./PlanCanvas";

// Мини-карта офиса: план и цветные точки тех, кто сейчас в офисе.
// Наведите на точку — подсказка с именем, местом или зоной и временем последней отметки.
export function OfficeMiniMap({ plan, zones, desks, people }: { plan: PlanImage; zones: PlanZone[]; desks: PlanDesk[]; people: DashboardPerson[] }) {
  const t = useTranslations("dashboard");

  const place = (p: DashboardPerson) =>
    p.place.kind === "desk" ? t("placeDesk", { desk: p.place.desk }) : p.place.kind === "zone" ? t("placeZone", { zone: p.place.zone }) : t("placeOffice");

  return (
    <PlanCanvas plan={plan} zones={zones} desks={desks.map((d) => ({ ...d, employee: null }))} plainDesks>
      {people.map((p) => {
        // Подсказка не должна вылезать за края плана.
        const horizontal = p.x > 0.7 ? "right-0" : p.x < 0.3 ? "left-0" : "left-1/2 -translate-x-1/2";
        const vertical = p.y < 0.25 ? "top-full mt-2" : "bottom-full mb-2";
        return (
          <div
            key={p.employeeId}
            data-testid="mini-dot"
            tabIndex={0}
            aria-label={p.name}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[2800ms] ease-linear focus:outline-none"
            style={{ left: pct(p.x), top: pct(p.y) }}
          >
            <div
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-canvas text-[10px] font-medium text-canvas ring-0 transition duration-150 group-hover:scale-125 group-hover:ring-2 group-focus:ring-2 sm:h-7 sm:w-7"
              style={{ backgroundColor: p.color, ["--tw-ring-color" as string]: `${p.color}55` }}
            >
              {p.initials}
            </div>
            <div
              role="tooltip"
              className={`pointer-events-none absolute ${horizontal} ${vertical} z-20 w-max max-w-56 rounded-lg bg-pressed/95 px-3 py-2 text-xs text-brand-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-fg-3">{place(p)}</div>
              {p.lastMark && (
                <div className="text-fg-3">
                  {t(p.lastMark.kind === "checkIn" ? "markCheckIn" : "markBack", { time: p.lastMark.time })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </PlanCanvas>
  );
}
