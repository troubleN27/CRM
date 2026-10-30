// Простой тестовый план офиса 1000×640: опенспейс на 13 мест, переговорная, кухня.
// Координаты мест и зон — доли от размера картинки (см. SPEC.md).

export const PLAN_W = 1000;
export const PLAN_H = 640;

// Центры столов в пикселях: 5 + 4 + 4 = 13.
const deskCenters: [number, number][] = [
  ...[90, 205, 320, 435, 550].map((x) => [x, 130] as [number, number]),
  ...[120, 250, 380, 510].map((x) => [x, 320] as [number, number]),
  ...[120, 250, 380, 510].map((x) => [x, 510] as [number, number]),
];

export const testDesks = deskCenters.map(([x, y], i) => {
  const n = String(i + 1).padStart(2, "0");
  return { code: n, pcNumber: `PC-${n}`, x: x / PLAN_W, y: y / PLAN_H };
});

const rooms = {
  open: { x: 20, y: 20, w: 610, h: 600 },
  meeting: { x: 650, y: 20, w: 330, h: 280 },
  kitchen: { x: 650, y: 320, w: 330, h: 300 },
};

const frac = (r: { x: number; y: number; w: number; h: number }) => ({
  x: r.x / PLAN_W,
  y: r.y / PLAN_H,
  width: r.w / PLAN_W,
  height: r.h / PLAN_H,
});

export const testZones = [
  { name: "Опенспейс", type: "WORK" as const, ...frac(rooms.open) },
  { name: "Переговорная", type: "MEETING" as const, ...frac(rooms.meeting) },
  { name: "Кухня", type: "KITCHEN" as const, ...frac(rooms.kitchen) },
];

// Сама картинка: стены, двери, столы, мебель. Подписей нет — их рисуют зоны.
export function testPlanSvg(): string {
  const wall = `fill="none" stroke="#3a414d" stroke-width="6"`;
  const desks = deskCenters
    .map(
      ([x, y]) =>
        `<rect x="${x - 45}" y="${y - 28}" width="90" height="56" rx="4" fill="#1a1d23" stroke="#2b3039" stroke-width="2"/>` +
        `<rect x="${x - 15}" y="${y - 22}" width="30" height="6" fill="#404652"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PLAN_W}" height="${PLAN_H}" viewBox="0 0 ${PLAN_W} ${PLAN_H}">
<rect width="${PLAN_W}" height="${PLAN_H}" fill="#0d0f12"/>
<rect x="20" y="20" width="960" height="600" ${wall}/>
<line x1="640" y1="20" x2="640" y2="250" stroke="#3a414d" stroke-width="6"/>
<line x1="640" y1="320" x2="640" y2="560" stroke="#3a414d" stroke-width="6"/>
<line x1="640" y1="310" x2="900" y2="310" stroke="#3a414d" stroke-width="6"/>
<rect x="420" y="614" width="80" height="12" fill="#0d0f12"/>
${desks}
<rect x="720" y="90" width="190" height="110" rx="50" fill="#1a1d23" stroke="#2b3039" stroke-width="2"/>
<rect x="670" y="560" width="290" height="40" fill="#1a1d23" stroke="#2b3039" stroke-width="2"/>
<rect x="740" y="410" width="150" height="80" rx="6" fill="#1a1d23" stroke="#2b3039" stroke-width="2"/>
</svg>`;
}
