"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { LatLngTuple } from "leaflet";
import type { MapPoint, MapPolyline } from "./LeafletMap";

// Leaflet работает только в браузере, поэтому без серверного рендера.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full animate-pulse rounded-lg bg-elevated" />,
});

export type { MapPoint, MapPolyline };

export function PointsMap(props: {
  points: MapPoint[];
  polylines?: MapPolyline[];
  followCenter?: LatLngTuple | null;
  height?: number;
  zoom?: number;
}) {
  return <LeafletMap {...props} />;
}

// Выбор точки кликом. Координаты уходят в форму скрытыми полями lat и lng.
export function LocationPicker({ lat, lng, error }: { lat?: string; lng?: string; error?: ReactNode }) {
  const t = useTranslations("clients");
  const [point, setPoint] = useState(lat && lng ? { lat: Number(lat), lng: Number(lng) } : null);

  return (
    <div className="space-y-1">
      <span className="text-sm text-fg-2">{t("pickOnMap")}</span>
      <LeafletMap
        points={point ? [{ id: "picked", ...point, label: t("point") }] : []}
        height={300}
        zoom={11}
        onPick={(la, ln) => setPoint({ lat: Number(la.toFixed(6)), lng: Number(ln.toFixed(6)) })}
      />
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <p className="text-xs text-fg-2">{point ? `${point.lat}, ${point.lng}` : t("noPoint")}</p>
      {error}
    </div>
  );
}
