"use client";

// Карта OpenStreetMap через Leaflet: бесплатно, без регистрации и ключей.
// Маркеры — CircleMarker, им не нужны картинки иконок.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngTuple } from "leaflet";

// lines — строки под заголовком во всплывающем окне; radius — размер точки (офис крупнее).
export type MapPoint = { id: string; lat: number; lng: number; label: string; href?: string; color?: string; radius?: number; lines?: string[] };

export type MapPolyline = {
  id: string;
  positions: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
};

// Центр Ташкента — по умолчанию, если точек нет.
export const DEFAULT_CENTER: LatLngTuple = [41.3111, 69.2797];

// Подгоняем масштаб один раз — иначе живая карта прыгала бы при каждом обновлении.
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng] as LatLngTuple), { padding: [30, 30] });
    else map.setView([points[0].lat, points[0].lng]);
  }, [map, points]);
  return null;
}

function FollowTarget({ center }: { center?: LatLngTuple | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.panTo(center, { animate: true, duration: 1 });
    }
  }, [map, center]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

type Props = {
  points: MapPoint[];
  polylines?: MapPolyline[];
  followCenter?: LatLngTuple | null;
  height?: number;
  zoom?: number;
  onPick?: (lat: number, lng: number) => void;
};

export default function LeafletMap({ points, polylines, followCenter, height = 360, zoom = 12, onPick }: Props) {
  const center: LatLngTuple = points.length ? [points[0].lat, points[0].lng] : DEFAULT_CENTER;

  return (
    <MapContainer center={center} zoom={zoom} style={{ height }} className="z-0 w-full rounded-lg" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polylines?.map((line) => (
        <Polyline
          key={line.id}
          positions={line.positions}
          pathOptions={{
            color: line.color ?? "#7b97bd",
            weight: line.weight ?? 3,
            opacity: line.opacity ?? 0.8,
            dashArray: line.dashArray,
          }}
        />
      ))}
      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={p.radius ?? 9}
          pathOptions={{ color: "#090a0c", weight: p.radius && p.radius > 10 ? 4 : 2, fillColor: p.color ?? "#4f6f99", fillOpacity: 1 }}
        >
          <Popup>
            <div className="space-y-0.5">
              <div className="font-medium">{p.href ? <a href={p.href}>{p.label}</a> : p.label}</div>
              {p.lines?.map((line, i) => (
                <div key={i} className="text-fg-2">
                  {line}
                </div>
              ))}
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {followCenter && <FollowTarget center={followCenter} />}
      {!onPick && !followCenter && <FitBounds points={points} />}
      {onPick && <ClickHandler onPick={onPick} />}
    </MapContainer>
  );
}
