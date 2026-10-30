"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlanCanvas, pct, type PlanDesk, type PlanImage, type PlanZone } from "./PlanCanvas";

export type LiveOfficePerson = {
  employeeId: string;
  name: string;
  initials: string;
  status: string;
  desk: { x: number; y: number } | null;
  last: { kind: string; x: number | null; y: number | null } | null;
};

const POLL_MS = 3000;

// План офиса с людьми: кто «в офисе», стоит там, откуда пришла последняя позиция
// (имитация, датчик), а если позиций нет — на своём месте. Обновляется каждые 3 секунды.
export function LiveOfficePlan(props: { plan: PlanImage; zones: PlanZone[]; desks: PlanDesk[]; people: LiveOfficePerson[] }) {
  const t = useTranslations("office");
  const [people, setPeople] = useState(props.people);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/positions/live", { cache: "no-store" });
        if (res.ok && !stopped) setPeople((await res.json()).people);
      } catch {
        // нет связи — покажем последние известные позиции
      }
    };
    const timer = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const inOffice = people
    .filter((p) => p.status === "IN_OFFICE")
    .map((p) => {
      const fromSensor = p.last?.kind === "OFFICE" && p.last.x !== null && p.last.y !== null;
      const pos = fromSensor ? { x: p.last!.x!, y: p.last!.y! } : p.desk;
      return pos && { ...p, pos };
    })
    .filter((p) => p !== null);

  return (
    <div className="space-y-2">
      <PlanCanvas plan={props.plan} zones={props.zones} desks={props.desks}>
        {inOffice.map((p) => (
          <div
            key={p.employeeId}
            data-testid="person-dot"
            title={p.name}
            className="pointer-events-auto absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-canvas bg-brand-fg text-[10px] font-medium text-canvas transition-[left,top] duration-[2800ms] ease-linear sm:h-7 sm:w-7"
            style={{ left: pct(p.pos.x), top: pct(p.pos.y) }}
          >
            {p.initials}
          </div>
        ))}
      </PlanCanvas>
      <p className="text-xs text-fg-2">{t("liveHint", { count: inOffice.length })}</p>
    </div>
  );
}
