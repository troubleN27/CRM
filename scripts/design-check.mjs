// Проверка правил дизайна «Strict Dark» (чек-лист из мастер-плана, раздел 8):
//   npm run design:check
// 1) нет градиентов; 2) нет белого и цветов светлее #A5ABB8; 3) нет размытых теней;
// 4) нет жирного начертания; 5) только цвета-токены, без стандартной палитры Tailwind;
// 6) контраст пар «фон — текст» в токенах не ниже 4.5:1.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILES = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.ts$/.test(name)) FILES.push(p);
  }
})(path.join(ROOT, "src"));

// Относительная яркость по WCAG.
function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const MAX_LUM = luminance("#a5abb8");

const TAILWIND_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?\b/;
const RULES = [
  { name: "градиент", re: /(linear|radial|conic)-gradient|\bbg-gradient-|\bbg-linear-|\bbg-radial-/ },
  { name: "белый цвет", re: /#fff(?:fff)?\b|rgb\(\s*255\s*,\s*255\s*,\s*255|\bwhite\b(?!-space)/i },
  { name: "размытая тень", re: /\b(?:shadow-(?:sm|md|lg|xl|2xl|inner)|shadow)(?=["'\s`])|\bdrop-shadow|box-shadow:\s*(?!none)[^;]*\d+px\s+\d+px\s+[1-9]/ },
  { name: "жирное начертание", re: /\bfont-(?:semibold|bold|extrabold|black)\b|font-weight:\s*(?:[6-9]00|bold)|fontWeight:\s*["']?(?:[6-9]00|bold)/ },
  { name: "цвет не из токенов", re: TAILWIND_PALETTE },
];

const problems = [];
for (const file of FILES) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/design-check:\s*ignore/.test(line)) return;
      for (const rule of RULES) {
        const m = line.match(rule.re);
        if (m) problems.push(`${rel}:${i + 1}  ${rule.name}: «${m[0]}»`);
      }
      for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
        if (luminance(m[0]) > MAX_LUM + 1e-6) problems.push(`${rel}:${i + 1}  светлее #A5ABB8: «${m[0]}»`);
      }
    });
}

// Контраст токенов.
const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const token = (name) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
const pairs = [
  ["fg", "canvas"],
  ["fg", "surface"],
  ["fg", "elevated"],
  ["fg", "pressed"],
  ["fg-2", "canvas"],
  ["fg-2", "surface"],
  ["fg-2", "elevated"],
  ["brand-ink", "brand"],
  ["brand-ink", "brand-hover"],
  ["brand-fg", "surface"],
  ["brand-fg", "elevated"],
  ["success", "success-bg"],
  ["warning", "warning-bg"],
  ["danger", "danger-bg"],
  ["info", "info-bg"],
  ["success", "surface"],
  ["warning", "surface"],
  ["danger", "surface"],
];
console.log("Контраст «текст / фон» (норма 4.5–7, но не ниже 4.5):");
for (const [fg, bg] of pairs) {
  const ratio = contrast(token(fg), token(bg));
  const ok = ratio >= 4.5;
  console.log(`  ${ok ? "✔" : "✘"} ${fg.padEnd(9)} на ${bg.padEnd(11)} ${ratio.toFixed(2)}:1`);
  if (!ok) problems.push(`globals.css  низкий контраст ${fg} на ${bg}: ${ratio.toFixed(2)}:1`);
}

if (problems.length) {
  console.log(`\nНарушений: ${problems.length}`);
  for (const p of problems) console.log("  ✘ " + p);
  process.exit(1);
}
console.log("\nВсе правила дизайна соблюдены");
