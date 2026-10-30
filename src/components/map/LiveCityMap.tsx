"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CityMapData } from "@/lib/dashboard";
import { PointsMap, type MapPoint, type MapPolyline } from "./index";
import { MobileConnectModal } from "./MobileConnectModal";

const POLL_MS = 3000;
const reasonColor: Record<string, string> = { CLIENT_VISIT: "#b8924d", LUNCH: "#76a986", PERSONAL: "#8a7ab0" };
const OFFICE_COLOR = "#7b97bd";
const REQUEST_COLOR = "#68707e";
const COURIER_COLOR = "#76a986";

export function LiveCityMap({ initial }: { initial: CityMapData }) {
  const t = useTranslations("map");
  const locale = useLocale();
  const [data, setData] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [followGps, setFollowGps] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/city?locale=${locale}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as CityMapData;
        if (!stopped) {
          setData(next);
          setOffline(false);
        }
      } catch {
        if (!stopped) setOffline(true);
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [locale]);

  const reason = (r: string | null) => (r ? t(`reason.${r}`) : t("reasonUnknown"));

  const gpsEmployee = data.out.find((p) => p.isGpsTracked);

  const polylines: MapPolyline[] =
    gpsEmployee?.route && gpsEmployee.route.length > 1
      ? [
          {
            id: `route-${gpsEmployee.employeeId}`,
            positions: gpsEmployee.route,
            color: "#7b97bd",
            weight: 3,
            opacity: 0.85,
          },
        ]
      : [];

  const points: MapPoint[] = [
    { id: "office", ...data.office, label: t("office"), color: OFFICE_COLOR, radius: 13, lines: [t("officeHint")] },
    ...data.clients.map((c) => ({
      id: `client-${c.id}`,
      lat: c.lat,
      lng: c.lng,
      label: c.client,
      color: REQUEST_COLOR,
      radius: 7,
      lines: [
        c.address,
        ...c.requests.map(
          (r) => `#${r.number} ${r.description} — ${t(`requestStatus.${r.status}`)}${r.assignee ? `, ${r.assignee}` : ""}`,
        ),
      ],
    })),
    ...data.out.flatMap((p) =>
      p.point
        ? [
            {
              id: p.employeeId,
              lat: p.point.lat,
              lng: p.point.lng,
              label: p.name,
              color: p.isGpsTracked ? COURIER_COLOR : reasonColor[p.reason ?? ""] ?? "#7b97bd",
              radius: p.isGpsTracked ? 12 : 10,
              lines: [
                p.isGpsTracked ? `📡 ${t("gpsTrackedBadge")}` : `${reason(p.reason)}${p.since ? ` · ${t("leftAt", { time: p.since })}` : ""}`,
                ...(p.point.accuracy ? [t("accuracyMeters", { m: Math.round(p.point.accuracy) })] : []),
                ...(p.isGpsTracked ? [t("totalDistance", { km: p.totalKm })] : []),
                ...(p.request ? [t("forRequest", { number: p.request.number, client: p.request.client })] : []),
              ],
            },
          ]
        : [],
    ),
  ];

  const followCenter: [number, number] | null =
    followGps && gpsEmployee?.point ? [gpsEmployee.point.lat, gpsEmployee.point.lng] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-2">
          <Legend color={OFFICE_COLOR} big label={t("office")} />
          <Legend color={REQUEST_COLOR} label={t("legendRequests")} />
          <Legend color={COURIER_COLOR} label={t("gpsTrackedBadge")} />
          <Legend color={reasonColor.CLIENT_VISIT} label={t("reason.CLIENT_VISIT")} />
          <Legend color={reasonColor.LUNCH} label={t("reason.LUNCH")} />
          <Legend color={reasonColor.PERSONAL} label={t("reason.PERSONAL")} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-elevated"
          >
            📱 {t("connectPhone")}
          </button>
          <span className="flex items-center gap-2 text-xs text-fg-2">
            <span className={`h-2 w-2 rounded-full ${offline ? "bg-danger" : "animate-pulse bg-success"}`} />
            {offline ? t("offline") : t("updatedAt", { time: data.updatedAt })}
          </span>
        </div>
      </div>

      {gpsEmployee && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 font-medium text-fg">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              {t("realtimeTracking")}:
            </span>
            <span className="font-medium text-fg">{gpsEmployee.name}</span>
            {gpsEmployee.point && (
              <span className="num text-fg-2">
                {gpsEmployee.point.lat.toFixed(4)}, {gpsEmployee.point.lng.toFixed(4)}
                {gpsEmployee.point.accuracy && ` (±${Math.round(gpsEmployee.point.accuracy)}м)`}
              </span>
            )}
            <span className="num text-fg-2">{t("totalDistance", { km: gpsEmployee.totalKm })}</span>
            {gpsEmployee.point && <span className="num text-fg-3">· {gpsEmployee.point.time}</span>}
          </div>
          <button
            type="button"
            onClick={() => setFollowGps((f) => !f)}
            className={`rounded border px-2.5 py-1 transition-colors ${
              followGps
                ? "border-brand bg-brand text-brand-ink"
                : "border-line-strong bg-elevated text-fg hover:bg-pressed"
            }`}
          >
            {followGps ? `✓ ${t("following")}` : t("follow")}
          </button>
        </div>
      )}

      <PointsMap points={points} polylines={polylines} followCenter={followCenter} height={480} />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-fg-2">
            <tr>
              <th className="px-4 py-3">{t("employee")}</th>
              <th className="px-4 py-3">{t("reasonTitle")}</th>
              <th className="px-4 py-3">{t("request")}</th>
              <th className="px-4 py-3">{t("lastPoint")}</th>
            </tr>
          </thead>
          <tbody data-testid="out-list">
            {data.out.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-fg-2">
                  {t("nobody")}
                </td>
              </tr>
            )}
            {data.out.map((p) => (
              <tr key={p.employeeId} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium">
                  {p.name}
                  {p.isGpsTracked && (
                    <span className="ml-2 rounded bg-success-bg px-1.5 py-0.5 text-[10px] text-success">
                      GPS
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: p.isGpsTracked ? COURIER_COLOR : reasonColor[p.reason ?? ""] ?? "#7b97bd" }}
                  />
                  {p.isGpsTracked ? t("gpsTrackedBadge") : reason(p.reason)}
                  {p.since && <span className="text-fg-2"> · {t("leftAt", { time: p.since })}</span>}
                </td>
                <td className="px-4 py-2">{p.request ? `#${p.request.number} ${p.request.client}` : "—"}</td>
                <td className="px-4 py-2 text-fg-2">
                  {p.point ? (
                    <span className="num">
                      {p.point.time} · {p.point.source}
                      {p.totalKm > 0 && ` (${p.totalKm} км)`}
                    </span>
                  ) : (
                    t("unknown")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MobileConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function Legend({ color, label, big }: { color: string; label: string; big?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block rounded-full border-2 border-canvas ${big ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
