/**
 * Importación de preguntas desde Excel (.xlsx) o CSV.
 *
 * Columnas (el orden no importa, mayúsculas/acentos tampoco):
 *   tipo | dificultad | enunciado | opcion_a ... opcion_f | correcta | respuesta_modelo | renglones | justificacion
 *
 * - tipo: "multiple choice", "vf", "multi vf", "abierta", "completar"
 * - dificultad: facil / media / dificil (por defecto: media)
 * - correcta:
 *     multiple choice -> letra (a, b, c...) o número (1, 2, 3...)
 *     vf              -> V o F
 *     multi vf        -> una letra por afirmación separadas por coma: V,F,V
 * - multi vf: cada opcion_x es una afirmación
 * - completar: marcar las respuestas en el enunciado entre [[ ]]
 * - justificacion: si / no
 */

export type QType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_TRUE_FALSE" | "OPEN" | "FILL_IN";
export type Difficulty = "easy" | "medium" | "hard";

export type ImportedQuestion = {
  type: QType;
  difficulty: Difficulty;
  statement: string;
  options?: unknown[];
  correctIndex?: number;
  modelAnswer?: string;
  openLines?: number;
  requiresJustification?: boolean;
};

export type ParsedRow = {
  row: number; // número de fila en el archivo (1 = encabezado)
  question?: ImportedQuestion;
  error?: string;
};

const OPTION_KEYS = ["opcion_a", "opcion_b", "opcion_c", "opcion_d", "opcion_e", "opcion_f"];

export const TEMPLATE_HEADERS = [
  "tipo",
  "dificultad",
  "enunciado",
  ...OPTION_KEYS,
  "correcta",
  "respuesta_modelo",
  "renglones",
  "justificacion",
];

const TEMPLATE_ROWS: string[][] = [
  ["multiple choice", "facil", "¿Cuál es la capital de Francia?", "Madrid", "París", "Roma", "", "", "", "b", "", "", "no"],
  ["vf", "media", "El agua hierve a 100 °C a nivel del mar.", "", "", "", "", "", "", "V", "", "3", "si"],
  ["multi vf", "media", "Indicá si cada afirmación es verdadera o falsa:", "2 + 2 = 4", "El Sol es un planeta", "π es irracional", "", "", "", "V,F,V", "", "", "no"],
  ["abierta", "dificil", "Explicá el ciclo del agua.", "", "", "", "", "", "", "", "Evaporación, condensación, precipitación...", "6", "no"],
  ["completar", "facil", "La capital de Argentina es [[Buenos Aires]].", "", "", "", "", "", "", "", "", "", "no"],
];

function normalizeKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, "_");
}

function normalizeValue(s: unknown) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function parseType(raw: string): QType | null {
  const v = normalizeValue(raw).replace(/[\s_\-\/]+/g, "");
  if (["multiplechoice", "multiple", "opcionmultiple", "mc", "choice"].includes(v)) return "MULTIPLE_CHOICE";
  if (["vf", "verdaderofalso", "tf", "truefalse"].includes(v)) return "TRUE_FALSE";
  if (["multivf", "multiplevf", "multiverdaderofalso", "multipleverdaderofalso"].includes(v)) return "MULTI_TRUE_FALSE";
  if (["abierta", "desarrollo", "open"].includes(v)) return "OPEN";
  if (["completar", "fillin", "completa"].includes(v)) return "FILL_IN";
  return null;
}

function parseDifficulty(raw: string): Difficulty | null {
  const v = normalizeValue(raw);
  if (!v) return "medium";
  if (["facil", "easy", "baja"].includes(v)) return "easy";
  if (["media", "medio", "medium", "intermedia"].includes(v)) return "medium";
  if (["dificil", "hard", "alta"].includes(v)) return "hard";
  return null;
}

function parseTrueFalse(raw: string): boolean | null {
  const v = normalizeValue(raw);
  if (["v", "verdadero", "true", "si", "1"].includes(v)) return true;
  if (["f", "falso", "false", "no", "0"].includes(v)) return false;
  return null;
}

function rowToQuestion(rec: Record<string, string>): ImportedQuestion {
  const type = parseType(rec.tipo ?? "");
  if (!type) throw new Error(`Tipo desconocido: "${rec.tipo ?? ""}"`);

  const difficulty = parseDifficulty(rec.dificultad ?? "");
  if (!difficulty) throw new Error(`Dificultad desconocida: "${rec.dificultad}" (usá facil, media o dificil)`);

  const statement = (rec.enunciado ?? "").trim();
  if (!statement) throw new Error("Falta el enunciado");

  const options = OPTION_KEYS.map((k) => (rec[k] ?? "").trim()).filter(Boolean);
  const correctRaw = (rec.correcta ?? "").trim();
  const modelAnswer = (rec.respuesta_modelo ?? "").trim() || undefined;
  const linesRaw = (rec.renglones ?? "").trim();
  const openLines = linesRaw ? Math.round(Number(linesRaw)) : undefined;
  if (openLines !== undefined && (!Number.isFinite(openLines) || openLines < 1 || openLines > 50)) {
    throw new Error("Renglones debe ser un número entre 1 y 50");
  }
  const requiresJustification = parseTrueFalse(rec.justificacion ?? "") === true;

  const base = { type, difficulty, statement, modelAnswer, openLines, requiresJustification };

  switch (type) {
    case "MULTIPLE_CHOICE": {
      if (options.length < 2) throw new Error("Multiple choice necesita al menos 2 opciones");
      const letter = normalizeValue(correctRaw);
      let idx = "abcdef".indexOf(letter);
      if (letter.length !== 1 || idx === -1) idx = Number(letter) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
        throw new Error(`Respuesta correcta inválida: "${correctRaw}" (usá a, b, c... o 1, 2, 3...)`);
      }
      return { ...base, options, correctIndex: idx, requiresJustification: false };
    }
    case "TRUE_FALSE": {
      const tf = parseTrueFalse(correctRaw);
      if (tf === null) throw new Error(`V/F: la columna "correcta" debe ser V o F`);
      return { ...base, correctIndex: tf ? 0 : 1 };
    }
    case "MULTI_TRUE_FALSE": {
      if (options.length < 1) throw new Error("Multi V/F necesita al menos una afirmación (opcion_a...)");
      const answers = correctRaw.split(/[,;\s]+/).filter(Boolean).map(parseTrueFalse);
      if (answers.length !== options.length || answers.some((a) => a === null)) {
        throw new Error(`Multi V/F: poné una V o F por afirmación en "correcta" (ej: V,F,V)`);
      }
      return {
        ...base,
        requiresJustification: false,
        options: options.map((statement, i) => ({
          statement,
          isCorrect: answers[i] === true,
          requiresJustification: requiresJustification,
          openLines: openLines ?? 2,
        })),
      };
    }
    case "FILL_IN":
      if (!/\[\[.+?\]\]/.test(statement)) {
        throw new Error("Completar: marcá las respuestas en el enunciado entre [[ ]]");
      }
      return base;
    case "OPEN":
      return { ...base, openLines: openLines ?? 4 };
  }
}

/** Parser CSV simple con comillas; detecta separador ; , o tabulación. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ";": 0, ",": 0, "\t": 0 } as Record<string, number>;
  for (const ch of firstLine) if (ch in counts) counts[ch]++;
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function readTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = (await readSheet(file)) as unknown[][];
    return rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))));
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(await file.text());
  }
  throw new Error("Formato no soportado. Usá un archivo .xlsx o .csv");
}

export async function parseQuestionFile(file: File): Promise<ParsedRow[]> {
  const table = await readTable(file);
  if (table.length < 2) throw new Error("El archivo no tiene preguntas (solo encabezado o vacío)");

  const headers = table[0].map(normalizeKey);
  if (!headers.includes("tipo") || !headers.includes("enunciado")) {
    throw new Error('No encontré las columnas "tipo" y "enunciado". Descargá la plantilla para ver el formato.');
  }

  return table.slice(1).map((cells, i) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => (rec[h] = cells[idx] ?? ""));
    try {
      return { row: i + 2, question: rowToQuestion(rec) };
    } catch (e: unknown) {
      return { row: i + 2, error: e instanceof Error ? e.message : "Fila inválida" };
    }
  });
}

/** Descarga la plantilla CSV (con ; y BOM para que Excel en castellano la abra bien). */
export function downloadTemplateCsv() {
  const escape = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS].map((r) => r.map(escape).join(";"));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-preguntas-profly.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
