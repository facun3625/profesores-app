"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  downloadTemplateCsv,
  parseQuestionFile,
  type ImportedQuestion,
  type ParsedRow,
} from "@/lib/question-import";

const TYPE_LABEL: Record<ImportedQuestion["type"], string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  TRUE_FALSE: "V/F",
  MULTI_TRUE_FALSE: "Multi V/F",
  OPEN: "Abierta",
  FILL_IN: "Completar",
};

const DIFF_LABEL: Record<ImportedQuestion["difficulty"], string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

/** Lista de revisión compartida por la importación y la generación con IA. */
export function QuestionReviewList({
  rows,
  onRemove,
}: {
  rows: ParsedRow[];
  onRemove?: (index: number) => void;
}) {
  return (
    <ol className="grid gap-2">
      {rows.map((r, i) => (
        <li
          key={`${r.row}-${i}`}
          className={
            "rounded-lg border p-3 text-sm " +
            (r.error
              ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
              : "border-gray-200 dark:border-slate-800")
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {r.error ? (
                <div className="text-red-700 dark:text-red-300">
                  <span className="font-semibold">Fila {r.row}:</span> {r.error}
                </div>
              ) : r.question ? (
                <>
                  <div className="mb-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      {TYPE_LABEL[r.question.type]}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                      {DIFF_LABEL[r.question.difficulty]}
                    </span>
                  </div>
                  <div className="text-gray-900 dark:text-white">{r.question.statement}</div>
                  {r.question.type === "MULTIPLE_CHOICE" && Array.isArray(r.question.options) && (
                    <ul className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                      {(r.question.options as string[]).map((o, idx) => (
                        <li
                          key={idx}
                          className={idx === r.question!.correctIndex ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""}
                        >
                          {"abcdef"[idx]}) {o} {idx === r.question!.correctIndex ? "✓" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.question.type === "TRUE_FALSE" && (
                    <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Correcta: {r.question.correctIndex === 0 ? "Verdadero" : "Falso"}
                    </div>
                  )}
                  {r.question.type === "MULTI_TRUE_FALSE" && Array.isArray(r.question.options) && (
                    <ul className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                      {(r.question.options as Array<{ statement: string; isCorrect: boolean }>).map((o, idx) => (
                        <li key={idx}>
                          {idx + 1}. {o.statement}{" "}
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">[{o.isCorrect ? "V" : "F"}]</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.question.modelAnswer && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-500">
                      Respuesta modelo: {r.question.modelAnswer}
                    </div>
                  )}
                </>
              ) : null}
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Quitar
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function ImportQuestionsModal({
  isOpen,
  onClose,
  subjectId,
  topicId,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
  topicId: string;
  onImported: (count: number) => void;
}) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const valid = rows?.filter((r) => r.question) ?? [];
  const invalid = rows?.filter((r) => r.error) ?? [];

  function reset() {
    setRows(null);
    setFileName("");
    setError("");
  }

  function close() {
    reset();
    onClose();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setRows(null);
    setFileName(file.name);
    try {
      setRows(await parseQuestionFile(file));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo");
    }
  }

  async function doImport() {
    if (valid.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ count: number }>("/questions/import", {
        method: "POST",
        body: JSON.stringify({
          subjectId,
          topicId,
          questions: valid.map((r) => r.question),
        }),
      });
      toast.success(`Se importaron ${res.count} preguntas`);
      onImported(res.count);
      close();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error importando preguntas");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Importar preguntas desde Excel o CSV</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Cargá muchas preguntas de una vez en este tema. Descargá la plantilla, completala en Excel o Google Sheets y
          subila como <b>.xlsx</b> o <b>.csv</b>.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={downloadTemplateCsv}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Descargar plantilla
          </button>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">
            Elegir archivo
            <input
              type="file"
              accept=".xlsx,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {fileName && <span className="text-sm text-gray-600 dark:text-slate-400">{fileName}</span>}
        </div>

        <details className="mt-3 text-xs text-gray-600 dark:text-slate-400">
          <summary className="cursor-pointer font-medium">¿Cómo completar las columnas?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>tipo</b>: multiple choice, vf, multi vf, abierta o completar.</li>
            <li><b>dificultad</b>: facil, media o dificil (si la dejás vacía: media).</li>
            <li><b>opcion_a … opcion_f</b>: las opciones (en multi vf, cada una es una afirmación).</li>
            <li><b>correcta</b>: multiple choice → letra (a, b…); vf → V o F; multi vf → una por afirmación: V,F,V.</li>
            <li><b>completar</b>: escribí las respuestas en el enunciado entre [[ ]]. Ej: La capital es [[París]].</li>
            <li><b>renglones</b> y <b>justificacion</b> (si/no) son opcionales.</li>
          </ul>
        </details>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {rows && (
          <>
            <div className="mt-4 flex gap-3 text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{valid.length} listas para importar</span>
              {invalid.length > 0 && (
                <span className="font-semibold text-red-700 dark:text-red-400">
                  {invalid.length} con errores (no se importan)
                </span>
              )}
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
              <QuestionReviewList rows={[...invalid, ...valid]} />
            </div>
          </>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={doImport}
            disabled={busy || valid.length === 0}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Importando…" : `Importar ${valid.length || ""} preguntas`}
          </button>
        </div>
      </div>
    </div>
  );
}
