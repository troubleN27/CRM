"use client";

import { AxisBottom } from "@visx/axis";
import { Group } from "@visx/group";
import { PatternLines } from "@visx/pattern";
import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear } from "@visx/scale";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

// Графики без градиентов: сплошные тёмные слои и штриховка SVG-узором.
// При обновлении данных высота и ширина столбцов плавно «перетекают».
const C = {
  line: "#22262e",
  text: "#7e8694",
  brand: "#1e3a5f",
  brandFg: "#7b97bd",
  danger: "#cc7a7a",
  dangerBg: "#3d1a1a",
  info: "#7b97bd",
  pressed: "#20242b",
  warning: "#b8924d",
  success: "#76a986",
};
const spring = { type: "spring", stiffness: 160, damping: 24 } as const;

export function AttendanceChart({ data }: { data: { date: string; onTime: number; late: number }[] }) {
  const t = useTranslations("dashboard");
  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs text-fg-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.brand, border: `1px solid ${C.brandFg}` }} />
          {t("chartOnTime")}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <rect width="10" height="10" fill={C.dangerBg} stroke={C.danger} />
            <path d="M0 10L10 0" stroke={C.danger} />
          </svg>
          {t("chartLate")}
        </span>
      </div>
      <div className="h-48">
        <ParentSize>
          {({ width, height }) => {
            if (width < 10) return null;
            const margin = { top: 8, bottom: 22 };
            const innerH = height - margin.top - margin.bottom;
            const x = scaleBand({ domain: data.map((d) => d.date), range: [0, width], padding: 0.35 });
            const max = Math.max(1, ...data.map((d) => d.onTime + d.late));
            const y = scaleLinear({ domain: [0, max], range: [innerH, 0] });
            return (
              <svg width={width} height={height} role="img" aria-label={t("chartAttendance")}>
                <PatternLines id="late-hatch" height={6} width={6} stroke={C.danger} strokeWidth={1} orientation={["diagonal"]} background={C.dangerBg} />
                <Group top={margin.top}>
                  {[0.25, 0.5, 0.75, 1].map((f) => (
                    <line key={f} x1={0} x2={width} y1={y(max * f)} y2={y(max * f)} stroke={C.line} strokeDasharray="2 4" />
                  ))}
                  {data.map((d) => {
                    const bx = x(d.date) ?? 0;
                    const bw = x.bandwidth();
                    const onH = innerH - y(d.onTime);
                    const lateH = innerH - y(d.late);
                    return (
                      <g key={d.date}>
                        <title>{`${d.date}: ${t("chartOnTime")} ${d.onTime}, ${t("chartLate")} ${d.late}`}</title>
                        <motion.rect x={bx} width={bw} fill={C.brand} stroke={C.brandFg} strokeWidth={1} initial={false} animate={{ y: innerH - onH, height: onH }} transition={spring} />
                        <motion.rect
                          x={bx}
                          width={bw}
                          fill="url(#late-hatch)"
                          stroke={C.danger}
                          strokeWidth={1}
                          initial={false}
                          animate={{ y: innerH - onH - lateH, height: lateH }}
                          transition={spring}
                        />
                      </g>
                    );
                  })}
                  <AxisBottom
                    top={innerH}
                    scale={x}
                    stroke={C.line}
                    tickStroke={C.line}
                    tickFormat={(v) => `${String(v).slice(8, 10)}.${String(v).slice(5, 7)}`}
                    tickLabelProps={{ fill: C.text, fontSize: 10, fontFamily: "var(--font-mono)", textAnchor: "middle" }}
                  />
                </Group>
              </svg>
            );
          }}
        </ParentSize>
      </div>
    </div>
  );
}

const STATUS_COLOR = { NEW: C.info, ASSIGNED: C.text, IN_PROGRESS: C.warning, DONE: C.success } as const;

export function RequestsChart({ data }: { data: { status: keyof typeof STATUS_COLOR; count: number }[] }) {
  const t = useTranslations();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-3" aria-label={t("dashboard.chartRequests")}>
      {data.map((d) => (
        <li key={d.status} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate text-fg-2">{t(`requestStatus.${d.status}`)}</span>
          <span className="h-2.5 rounded-sm border border-line bg-canvas">
            <motion.span
              className="block h-full rounded-sm"
              style={{ background: STATUS_COLOR[d.status] }}
              initial={false}
              animate={{ width: `${(d.count / max) * 100}%` }}
              transition={spring}
            />
          </span>
          <span className="num text-right text-fg">{d.count}</span>
        </li>
      ))}
    </ul>
  );
}
