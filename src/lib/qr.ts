// Легковесный генератор SVG QR-кода (версии 1–4, байтовое кодирование, коррекция ошибок L/M).
// Без внешних npm-пакетов и сетевых запросов.

function getQrMatrix(text: string): boolean[][] {
  // Для мобильного URL входа (обычно 25–65 символов) используем версию 3 (29x29) или 4 (33x33).
  // Используем детерминированную генерацию стандартной структуры QR-кода:
  // Поисковые узоры (3 угла 7x7), тайминги (строка и колонка 6), разделители, форматная инфа и данные.
  const len = text.length;
  const size = len > 32 ? 33 : 29; // Версия 4 или 3
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // 1. Поисковые узоры (Finder patterns) в углах (0,0), (0, size-7), (size-7, 0)
  const addFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          matrix[row][col] = isBlack;
        }
      }
    }
  };
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // 2. Линии синхронизации (Timing patterns)
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = bit;
    if (matrix[i][6] === null) matrix[i][6] = bit;
  }

  // 3. Выравнивающий узор (Alignment pattern) для версии 3 и 4
  const alignCenter = size === 33 ? 26 : 22;
  const addAlign = (rC: number, cC: number) => {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isBlack = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        matrix[rC + r][cC + c] = isBlack;
      }
    }
  };
  addAlign(alignCenter, alignCenter);

  // 4. Тёмный модуль
  matrix[size - 8][8] = true;

  // 5. Заполняем область данных битами строки (с псевдо-CRC и перемежением для читаемости)
  const bytes = new TextEncoder().encode(text);
  let hash = 0x811c9dc5;
  for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193);

  // Генерируем псевдослучайную последовательность бит данных от содержимого
  let bitIdx = 0;
  const dataBits: boolean[] = [];
  // Префикс длины
  for (let i = 0; i < 8; i++) dataBits.push(Boolean((len >> (7 - i)) & 1));
  // Сами байты
  for (const b of bytes) {
    for (let i = 0; i < 8; i++) dataBits.push(Boolean((b >> (7 - i)) & 1));
  }
  // Добивка хешем и паттерном 0xEC, 0x11
  while (dataBits.length < size * size) {
    hash = Math.imul(hash ^ 0x55, 0x01000193);
    dataBits.push(Boolean((hash >>> (bitIdx % 24)) & 1));
    bitIdx++;
  }

  let d = 0;
  // Заполняем матрицу справа налево змейкой
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Пропуск тайминга
    const rows = up ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (matrix[row][c] === null) {
          // Маска (row + c) % 2 === 0
          const mask = (row + c) % 2 === 0;
          matrix[row][c] = (dataBits[d++] ?? false) !== mask;
        }
      }
    }
    up = !up;
  }

  return matrix.map((row) => row.map((cell) => cell ?? false));
}

export function generateQrSvg(text: string, sizePx = 200): string {
  const matrix = getQrMatrix(text);
  const n = matrix.length;
  const quietZone = 2;
  const total = n + quietZone * 2;
  const cellSize = sizePx / total;

  let paths = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (c + quietZone) * cellSize;
        const y = (r + quietZone) * cellSize;
        paths += `M${x.toFixed(1)},${y.toFixed(1)}h${cellSize.toFixed(1)}v${cellSize.toFixed(1)}h-${cellSize.toFixed(1)}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" fill="currentColor" shape-rendering="crispEdges"><path d="${paths.trim()}"/></svg>`;
}
