"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { EmployeeStatus, ZoneType } from "@prisma/client";
import { toFraction } from "@/lib/office-plan";

export type PlanImage = { url: string; width: number; height: number };
export type PlanZone = { id: string; name: string; type: ZoneType; x: number; y: number; width: number; height: number };
export type PlanDesk = {
  id: string;
  code: string;
  pcNumber: string | null;
  x: number;
  y: number;
  employee: { id: string; name: string; status: EmployeeStatus } | null;
};

export const zoneColor: Record<ZoneType, string> = {
  WORK: "border-info/50 bg-info-bg/40 text-info",
  MEETING: "border-brand-fg/50 bg-brand/30 text-brand-fg",
  KITCHEN: "border-warning/50 bg-warning-bg/50 text-warning",
  OTHER: "border-line-strong bg-pressed/50 text-fg-2",
};

const deskColor: Record<EmployeeStatus | "EMPTY", string> = {
  IN_OFFICE: "bg-success-bg text-success border-success/60",
  OUT_OF_OFFICE: "bg-warning-bg text-warning border-warning/60",
  OFF_WORK: "bg-pressed text-fg-2 border-line-strong",
  EMPTY: "bg-surface text-fg-2 border-dashed border-line-strong",
};

type Props = {
  plan: PlanImage;
  zones: PlanZone[];
  desks: PlanDesk[];
  selectedId?: string | null;
  zonesClickable?: boolean;
  // Места без цвета статуса — только номер (для мини-карты на главной).
  plainDesks?: boolean;
  onPlanPointerDown?: (p: { x: number; y: number }, e: PointerEvent) => void;
  onPlanPointerMove?: (p: { x: number; y: number }) => void;
  onPlanPointerUp?: (p: { x: number; y: number }) => void;
  onDeskClick?: (desk: PlanDesk) => void;
  onZoneClick?: (zone: PlanZone) => void;
  children?: ReactNode;
};

const pct = (v: number) => `${v * 100}%`;

// План офиса. Всё позиционируется в процентах от блока, у которого
// те же пропорции, что у картинки, — поэтому при любом размере места стоят на своих столах.
export function PlanCanvas(props: Props) {
  const t = useTranslations("office");
  const ref = useRef<HTMLDivElement>(null);
  const point = (e: { clientX: number; clientY: number }) => toFraction(e.clientX, e.clientY, ref.current!.getBoundingClientRect());

  return (
    <div
      ref={ref}
      className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-line bg-surface"
      style={{ aspectRatio: `${props.plan.width} / ${props.plan.height}` }}
      onPointerDown={(e) => {
        if (!props.onPlanPointerDown) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        props.onPlanPointerDown(point(e), e);
      }}
      onPointerMove={(e) => props.onPlanPointerMove?.(point(e))}
      onPointerUp={(e) => props.onPlanPointerUp?.(point(e))}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- картинка из нашего API, оптимизация не нужна */}
      <img src={props.plan.url} alt={t("planAlt")} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />

      {props.zones.map((z) => (
        <div
          key={z.id}
          className={`absolute border-2 ${zoneColor[z.type]} ${props.zonesClickable ? "cursor-pointer" : "pointer-events-none"} ${
            props.selectedId === z.id ? "ring-2 ring-brand-fg" : ""
          }`}
          style={{ left: pct(z.x), top: pct(z.y), width: pct(z.width), height: pct(z.height) }}
          onPointerDown={(e) => {
            if (!props.zonesClickable) return;
            e.stopPropagation();
            props.onZoneClick?.(z);
          }}
        >
          <span className="absolute left-1 top-1 rounded bg-surface/80 px-1.5 text-xs font-medium sm:text-sm">{z.name}</span>
        </div>
      ))}

      {props.desks.map((d) => (
        <button
          key={d.id}
          type="button"
          title={[`${t("desk")} ${d.code}`, d.pcNumber, d.employee?.name ?? t("free")].filter(Boolean).join(" · ")}
          className={
            props.plainDesks
              ? "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 num rounded border border-line bg-surface/80 px-1 text-[10px] text-fg-2"
              : `absolute flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 px-1 text-[11px] font-medium sm:h-9 sm:min-w-9 sm:text-xs ${
                  deskColor[d.employee?.status ?? "EMPTY"]
                } ${props.selectedId === d.id ? "ring-2 ring-brand-fg ring-offset-1 ring-offset-canvas" : ""} ${props.onDeskClick ? "cursor-pointer" : "cursor-default"}`
          }
          style={{ left: pct(d.x), top: pct(d.y) }}
          onPointerDown={(e) => {
            if (!props.onDeskClick) return;
            e.stopPropagation();
            props.onDeskClick(d);
          }}
        >
          {d.code}
        </button>
      ))}

      {props.children}
    </div>
  );
}

export { pct };
