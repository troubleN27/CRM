// Программа-имитация движения сотрудников.
//   npm run sim:on      — включить (работает в фоне, путь к логу команда напишет)
//   npm run sim:off     — выключить
//   npm run sim:status  — работает ли
// Каждые 3 секунды берёт с сервера, кто сейчас на работе, двигает людей и отправляет
// все позиции в общее место POST /api/positions — туда же позже пойдут настоящие датчики и телефоны.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomInRect, randomNear, stepToward, type Pt, type Rect } from "../src/lib/sim-motion";

const BASE = process.env.SIM_BASE_URL ?? "http://localhost:3000";
const KEY = process.env.POSITIONS_API_KEY ?? "";
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS ?? 3000);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Лог и pid — во временной папке системы: файл, который меняется каждые 3 секунды
// в папке проекта, заставляет dev-сервер Next бесконечно пересобирать и перезагружать страницы.
const STATE_DIR = path.join(os.tmpdir(), "office-crm-sim");
mkdirSync(STATE_DIR, { recursive: true });
const PID_FILE = path.join(STATE_DIR, "sim.pid");
export const LOG_FILE = path.join(STATE_DIR, "sim.log");

// Скорости за один шаг (3 секунды). Для наглядности — быстрее, чем в жизни.
const OFFICE_STEP = 0.05; // доля ширины плана
const DRIVE_STEP = 0.0015; // градусы ≈ 150 м
const WALK_STEP = 0.0004; // градусы ≈ 40 м

type Person = {
  employeeId: string;
  name: string;
  status: "IN_OFFICE" | "OUT_OF_OFFICE" | "OFF_WORK";
  desk: { x: number; y: number } | null;
  outReason: string | null;
  request: { number: number; lat: number; lng: number } | null;
  last: { kind: "OFFICE" | "CITY"; x: number | null; y: number | null; lat: number | null; lng: number | null } | null;
};
type Zone = Rect & { id: string; type: string };
type Live = { people: Person[]; zones: Zone[]; cityCenter: { lat: number; lng: number } };

type OfficeState = { kind: "office"; pos: Pt; mode: "desk" | "going" | "staying" | "returning"; target: Pt; stay: number };
// В городе x = широта, y = долгота.
type CityState = { kind: "city"; pos: Pt; waypoint: Pt };
const states = new Map<string, OfficeState | CityState>();

const log = (msg: string) => console.log(`${new Date().toLocaleTimeString("ru-RU")} ${msg}`);

function officeStep(p: Person, zones: Zone[]): Pt {
  const home = p.desk ?? { x: 0.5, y: 0.5 };
  let s = states.get(p.employeeId);
  if (s?.kind !== "office") {
    const start = p.last?.kind === "OFFICE" && p.last.x !== null && p.last.y !== null ? { x: p.last.x, y: p.last.y } : home;
    s = { kind: "office", pos: start, mode: "returning", target: home, stay: 0 };
    states.set(p.employeeId, s);
  }
  // Ходят на кухню и в переговорную; если таких зон нет — в любую.
  const places = zones.filter((z) => z.type === "KITCHEN" || z.type === "MEETING");
  const choices = places.length ? places : zones;

  if (s.mode === "desk" && choices.length && Math.random() < 0.12) {
    s.target = randomInRect(choices[Math.floor(Math.random() * choices.length)]);
    s.mode = "going";
  }
  if (s.mode === "going" || s.mode === "returning") {
    const step = stepToward(s.pos, s.target, OFFICE_STEP);
    s.pos = step.pos;
    if (step.arrived) {
      if (s.mode === "going") {
        s.mode = "staying";
        s.stay = 3 + Math.floor(Math.random() * 6);
      } else s.mode = "desk";
    }
  } else if (s.mode === "staying" && --s.stay <= 0) {
    s.mode = "returning";
    s.target = home;
  }
  return s.pos;
}

function cityStep(p: Person, center: { lat: number; lng: number }): { lat: number; lng: number } {
  let s = states.get(p.employeeId);
  if (s?.kind !== "city") {
    const start =
      p.last?.kind === "CITY" && p.last.lat !== null && p.last.lng !== null
        ? { x: p.last.lat, y: p.last.lng }
        : randomNear({ x: center.lat, y: center.lng }, 0.01);
    s = { kind: "city", pos: start, waypoint: start };
    states.set(p.employeeId, s);
  }
  if (p.request) {
    // Выезд на заявку: едем к клиенту, на месте немного ходим рядом.
    const client = { x: p.request.lat, y: p.request.lng };
    const step = stepToward(s.pos, client, DRIVE_STEP);
    s.pos = step.arrived ? randomNear(client, 0.0002) : step.pos;
  } else {
    // Обед или личное: гуляем по случайному маршруту.
    const step = stepToward(s.pos, s.waypoint, WALK_STEP);
    s.pos = step.pos;
    if (step.arrived) s.waypoint = randomNear(s.pos, 0.006);
  }
  return { lat: Number(s.pos.x.toFixed(6)), lng: Number(s.pos.y.toFixed(6)) };
}

async function tick() {
  const headers = { authorization: `Bearer ${KEY}`, "content-type": "application/json" };
  try {
    const res = await fetch(`${BASE}/api/positions/live`, { headers });
    if (!res.ok) return log(`сервер ответил ${res.status} — проверьте POSITIONS_API_KEY и что сайт запущен`);
    const live = (await res.json()) as Live;

    const positions = [];
    for (const p of live.people) {
      if (p.status === "IN_OFFICE") {
        const { x, y } = officeStep(p, live.zones);
        positions.push({ employeeId: p.employeeId, kind: "OFFICE", x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
      } else if (p.status === "OUT_OF_OFFICE") {
        positions.push({ employeeId: p.employeeId, kind: "CITY", ...cityStep(p, live.cityCenter), accuracy: 15 });
      }
    }
    // Кто ушёл домой — забываем.
    for (const id of states.keys()) if (!live.people.some((p) => p.employeeId === id)) states.delete(id);

    if (!positions.length) return log("на работе никого нет — двигать некого");
    const sent = await fetch(`${BASE}/api/positions`, { method: "POST", headers, body: JSON.stringify({ source: "simulator", positions }) });
    const result = (await sent.json()) as { accepted?: number; rejected?: number };
    const office = positions.filter((p) => p.kind === "OFFICE").length;
    log(`в офисе: ${office}, в городе: ${positions.length - office}, принято: ${result.accepted ?? 0}, отклонено: ${result.rejected ?? 0}`);
  } catch (e) {
    log(`нет связи с ${BASE}: ${(e as Error).message}`);
  }
}

function runningPid(): number | null {
  if (!existsSync(PID_FILE)) return null;
  const pid = Number(readFileSync(PID_FILE, "utf8"));
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    rmSync(PID_FILE, { force: true });
    return null;
  }
}

const command = process.argv[2] ?? "status";

if (command === "run") {
  if (!KEY) {
    log("нет POSITIONS_API_KEY в .env");
    process.exit(1);
  }
  log(`имитация запущена: ${BASE}, шаг ${INTERVAL_MS / 1000} с`);
  void tick();
  setInterval(tick, INTERVAL_MS);
} else if (command === "on") {
  const pid = runningPid();
  if (pid) {
    console.log(`Имитация уже работает (pid ${pid}).`);
  } else {
    const out = openSync(LOG_FILE, "w");
    const child = spawn(process.execPath, ["--import", "tsx", fileURLToPath(import.meta.url), "run"], {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", out, out],
      windowsHide: true,
    });
    child.unref();
    writeFileSync(PID_FILE, String(child.pid));
    console.log(`Имитация включена (pid ${child.pid}). Лог: ${LOG_FILE}. Выключить: npm run sim:off`);
  }
} else if (command === "off") {
  const pid = runningPid();
  if (!pid) console.log("Имитация и так выключена.");
  else {
    process.kill(pid);
    rmSync(PID_FILE, { force: true });
    console.log("Имитация выключена.");
  }
} else {
  const pid = runningPid();
  console.log(pid ? `Имитация работает (pid ${pid}).` : "Имитация выключена.");
}
