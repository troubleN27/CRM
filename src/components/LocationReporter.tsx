"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// Телефон как датчик местоположения:
// Для обычных сотрудников «вне офиса» — отправляет раз в минуту.
// Для выездного сотрудника с GPS-слежением (isGpsTracked) — работает в режиме реального времени
// (каждые 3–5 секунд при движении, highAccuracy, wakeLock для экрана смартфона).
const STANDARD_INTERVAL_MS = 60_000;
const REALTIME_INTERVAL_MS = 3_000;

// Точки для симуляции перемещения курьера по Ташкенту от офиса к клиентам
const SIMULATED_ROUTE = [
  { lat: 41.3111, lng: 69.2797 },
  { lat: 41.3138, lng: 69.2815 },
  { lat: 41.3175, lng: 69.2838 },
  { lat: 41.3212, lng: 69.2870 },
  { lat: 41.3255, lng: 69.2925 },
  { lat: 41.3298, lng: 69.2980 },
  { lat: 41.3340, lng: 69.3045 },
  { lat: 41.3385, lng: 69.3110 },
  { lat: 41.3430, lng: 69.3180 },
  { lat: 41.3480, lng: 69.3245 },
];

export function LocationReporter({
  employeeId,
  isGpsTracked = false,
}: {
  employeeId: string;
  isGpsTracked?: boolean;
}) {
  const t = useTranslations("map");
  const [state, setState] = useState<"waiting" | "sending" | "unknown">("waiting");
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [simIndex, setSimIndex] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const lastSent = useRef(0);

  const minInterval = isGpsTracked ? REALTIME_INTERVAL_MS : STANDARD_INTERVAL_MS;

  // Экран смартфона не засыпает во время смены (Screen Wake Lock API)
  useEffect(() => {
    if (!isGpsTracked || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => {
      lock = l;
    }).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [isGpsTracked]);

  const sendPosition = useCallback(async (lat: number, lng: number, accuracy?: number) => {
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "phone",
          positions: [{ employeeId, kind: "CITY", lat, lng, accuracy: accuracy ? Math.round(accuracy) : undefined }],
        }),
      });
      if (res.ok) {
        setState("sending");
        setLastCoords({ lat, lng, accuracy });
        setSentCount((c) => c + 1);
      }
    } catch {}
  }, [employeeId]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const timer = setTimeout(() => setState("unknown"), 0);
      return () => clearTimeout(timer);
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - lastSent.current < minInterval) return;
        lastSent.current = Date.now();
        void sendPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      () => setState("unknown"),
      { enableHighAccuracy: isGpsTracked, maximumAge: isGpsTracked ? 0 : 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [minInterval, isGpsTracked, sendPosition]);

  const handleSimulateStep = async () => {
    setSimulating(true);
    const nextIdx = (simIndex + 1) % SIMULATED_ROUTE.length;
    setSimIndex(nextIdx);
    const pt = SIMULATED_ROUTE[nextIdx];
    await sendPosition(pt.lat, pt.lng, 5);
    setSimulating(false);
  };

  if (!isGpsTracked) {
    return (
      <p className="mx-auto max-w-6xl px-4 pt-2 text-xs text-fg-2">
        {state === "sending" ? t("phoneSending") : state === "unknown" ? t("unknown") : t("phoneWaiting")}
      </p>
    );
  }

  return (
    <div className="border-b border-line bg-surface px-4 py-2 text-xs text-fg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="font-medium text-success">{t("phoneSendingGps")}</span>
          {lastCoords && (
            <span className="num text-fg-2">
              · {lastCoords.lat.toFixed(4)}, {lastCoords.lng.toFixed(4)}
              {lastCoords.accuracy && ` (±${Math.round(lastCoords.accuracy)}м)`}
            </span>
          )}
          {sentCount > 0 && <span className="num text-fg-3">· {t("phonePointsSent", { count: sentCount })}</span>}
        </div>
        <button
          type="button"
          onClick={handleSimulateStep}
          disabled={simulating}
          className="rounded border border-line-strong bg-elevated px-2.5 py-1 text-xs text-fg transition-colors hover:bg-pressed disabled:opacity-50"
        >
          {simulating ? t("simulating") : t("simulateStep")}
        </button>
      </div>
    </div>
  );
}
