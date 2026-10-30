// Встроенный PostgreSQL: Docker и отдельная установка не нужны.
// Данные лежат в папке .pgdata (она в .gitignore).
//   npm run db        — запустить базу (работает в фоне)
//   npm run db:stop   — остановить
// Запускаем через pg_ctl: под администратором Windows он сам понижает права,
// а postgres.exe напрямую отказывается стартовать.
import EmbeddedPostgres from "embedded-postgres";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(".pgdata");
const PORT = 5433;

const binDir = path.resolve("node_modules/@embedded-postgres/windows-x64/native/bin");
const pgCtl = path.join(binDir, "pg_ctl.exe");

// stdio: "ignore" — иначе запущенный сервер держит вывод и команда не завершается.
function ctl(args) {
  execFileSync(pgCtl, ["-D", DATA_DIR, ...args], { stdio: "ignore" });
}

const command = process.argv[2] ?? "start";

if (command === "stop") {
  ctl(["stop", "-m", "fast"]);
  process.exit(0);
}

if (!existsSync(DATA_DIR)) {
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) {
    console.error("Нет POSTGRES_PASSWORD в .env");
    process.exit(1);
  }
  await new EmbeddedPostgres({ databaseDir: DATA_DIR, user: "crm", password, port: PORT }).initialise();
}

try {
  ctl(["status"]);
  console.log("PostgreSQL уже запущен.");
} catch {
  ctl(["start", "-w", "-o", `-p ${PORT}`, "-l", path.join(DATA_DIR, "server.log")]);
  console.log(`PostgreSQL запущен на порту ${PORT}.`);
}
