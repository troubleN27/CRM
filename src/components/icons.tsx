// Линейные иконки 16×16, штрих 1.5px, цвет — currentColor. Без сторонних наборов.
import type { SVGProps } from "react";

const paths = {
  home: "M2.5 7.5L8 3l5.5 4.5V13a.5.5 0 01-.5.5H10v-4H6v4H3a.5.5 0 01-.5-.5z",
  users: "M6 7.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.5 13.5c0-2.2 2-3.5 4.5-3.5s4.5 1.3 4.5 3.5M10.5 3a2.5 2.5 0 010 4.5M12 10.2c1.5.4 2.5 1.5 2.5 3.3",
  building: "M3 13.5V3.5a1 1 0 011-1h5a1 1 0 011 1v10M10 6.5h2a1 1 0 011 1v6M1.5 13.5h13M5.5 5h2M5.5 7.5h2M5.5 10h2",
  clipboard: "M5.5 2.5h5v2h-5zM5.5 3.5H4a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1v-9a1 1 0 00-1-1h-1.5M5.5 8h5M5.5 10.5h3",
  plan: "M2 2.5h12v11H2zM2 7.5h5.5V2.5M9.5 13.5V9.5H14M9.5 5.5h2",
  globe: "M8 14.5A6.5 6.5 0 108 1.5a6.5 6.5 0 000 13zM1.5 8h13M8 1.5c1.8 1.8 2.6 4 2.6 6.5S9.8 12.7 8 14.5C6.2 12.7 5.4 10.5 5.4 8S6.2 3.3 8 1.5",
  chart: "M2 13.5h12M4 11V7.5M7 11V4M10 11V8.5M13 11V6",
  calendar: "M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3",
  search: "M7 12a5 5 0 100-10 5 5 0 000 10zM10.5 10.5l3.5 3.5",
  chevronLeft: "M10 3.5L5.5 8l4.5 4.5",
  chevronRight: "M6 3.5L10.5 8 6 12.5",
  chevronDown: "M3.5 6l4.5 4.5L12.5 6",
  logout: "M6 2.5H3.5a1 1 0 00-1 1v9a1 1 0 001 1H6M10.5 11L13.5 8l-3-3M13.5 8H6",
  menu: "M2.5 4h11M2.5 8h11M2.5 12h11",
  close: "M3.5 3.5l9 9M12.5 3.5l-9 9",
  grip: "M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01",
  board: "M2 2.5h3.5v11H2zM6.25 2.5h3.5v7h-3.5zM10.5 2.5H14v9h-3.5z",
  table: "M2 3h12v10H2zM2 6.5h12M2 9.75h12M6 6.5V13",
  arrowIn: "M3 8h9M8 4l4 4-4 4",
  arrowOut: "M5 11l6-6M6 5h5v5",
  arrowBack: "M6 4L2.5 7.5 6 11M3 7.5h7a3 3 0 010 6H8",
  stop: "M4.5 4.5h7v7h-7z",
  check: "M3 8.5l3 3 7-7",
  clock: "M8 14.5A6.5 6.5 0 108 1.5a6.5 6.5 0 000 13zM8 4.5V8l2.5 1.5",
  settings: "M8 10a2 2 0 100-4 2 2 0 000 4zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "grip" ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
