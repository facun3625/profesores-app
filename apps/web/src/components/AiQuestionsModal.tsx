"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ParsedRow, QType } from "@/lib/question-import";
import { QuestionReviewList } from "@/components/ImportQuestionsModal";

const TYPES: Array<{ value: QType; label: string }> = [
  { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { value: "TRUE_FALSE", label: "Verdadero/Falso" },
  { value: "MULTI_TRUE_FALSE", label: "Multi V/F" },
  { value: "FILL_IN", label: "Completar" },
  { value: "OPEN", label: "Abierta" },
];

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = () => reject(new Error("No se pudo leer el PDF"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generar preguntas con IA a partir de un apunte (texto o PDF).
 * El docente revisa, quita las que no le sirven y recién ahí se guardan en el tema.
 */
export default function AiQuestionsModal({
  isOpen,
  onClose,
  subjectId,
  topicId,
  topicName,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
  topicId: string;
  topicName?: string;
  onSaved: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<QType[]>(["MULTIPLE_CHOICE", "TRUE_FALSE"]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [instructions, setInstructions] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [busy, setBusy] = useState<"" | "generating" | "saving">("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const valid = rows?.filter((r) => r.question) ?? [];

  function close() {
    setRows(null);
    setError("");
    onClose();
  }

  function toggleType(t: QType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function generate() {
    setError("");
    if (!text.trim() && !pdf) return setError("Pegá el texto del apunte o subí un PDF.");
    if (types.length === 0) return setError("Elegí al menos un tipo de pregunta.");
    if (pdf && pdf.size > MAX_PDF_BYTES) return setError("El PDF no puede pesar más de 10 MB.");

    setBusy("generating");
    try {
      const res = await api<{ rows: ParsedRow[] }>("/questions/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          text: text.trim() || undefined,
          pdfBase64: pdf ? await fileToBase64(pdf) : undefined,
          count,
          types,
          difficulty,
          instructions: instructions.trim() || undefined,
        }),
      });
      setRows(res.rows.filter((r) => r.question)); // las inválidas se descartan directamente
      if (res.rows.length > 0 && res.rows.every((r) => !r.question)) {
        setError("La IA no devolvió preguntas válidas. Probá con otro material o menos preguntas.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error generando preguntas");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (valid.length === 0) return;
    setBusy("saving");
    setError("");
    try {
      const res = await api<{ count: number }>("/questions/import", {
        method: "POST",
        body: JSON.stringify({
          subjectId,
          topicId,
          source: "ai",
          questions: valid.map((r) => r.question),
        }),
      });
      toast.success(`Se guardaron ${res.count} preguntas en el tema`);
      onSaved(res.count);
      close();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando preguntas");
    } finally {
      setBusy("");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Generar preguntas con IA{topicName ? ` — ${topicName}` : ""}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Pegá tu apunte o subí un PDF. La IA propone preguntas basadas solo en ese material; vos las revisás antes de
          guardarlas.
        </p>

        {!rows ? (
          <div className="mt-4 grid min-h-0 gap-4 overflow-y-auto pr-1">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Texto del apunte</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder="Pegá acá el contenido de la clase, un resumen o un capítulo…"
                className={inputCls}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {pdf ? "Cambiar PDF" : "…o subir un PDF"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                />
              </label>
              {pdf && (
                <span className="text-gray-600 dark:text-slate-400">
                  {pdf.name}{" "}
                  <button type="button" onClick={() => setPdf(null)} className="text-red-600 hover:underline">
                    quitar
                  </button>
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Cantidad de preguntas</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  className={inputCls}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Dificultad</span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                  className={inputCls}
                >
                  <option value="mixed">Mezcla de fácil, media y difícil</option>
                  <option value="easy">Fácil</option>
                  <option value="medium">Media</option>
                  <option value="hard">Difícil</option>
                </select>
              </label>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Tipos de pregunta</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={
                      "cursor-pointer rounded-full border px-3 py-1 text-sm " +
                      (types.includes(t.value)
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                        : "border-gray-300 text-gray-600 dark:border-slate-700 dark:text-slate-400")
                    }
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={types.includes(t.value)}
                      onChange={() => toggleType(t.value)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Indicaciones (opcional)</span>
              <input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={1000}
                placeholder="Ej: 3er año de secundaria, enfocate en las causas de la Revolución de Mayo"
                className={inputCls}
              />
            </label>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {valid.length} preguntas propuestas — quitá las que no te sirvan
              </span>
              <button type="button" onClick={() => setRows(null)} className="text-indigo-600 hover:underline dark:text-indigo-400">
                Volver a generar
              </button>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
              <QuestionReviewList rows={rows} onRemove={(i) => setRows((prev) => prev!.filter((_, idx) => idx !== i))} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
              La IA puede equivocarse: revisá enunciados y respuestas correctas antes de usarlas en un examen.
            </p>
          </>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={close}
            disabled={busy !== ""}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Cancelar
          </button>
          {!rows ? (
            <button
              type="button"
              onClick={generate}
              disabled={busy !== ""}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy === "generating" ? "Generando… (puede tardar un minuto)" : "Generar preguntas"}
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={busy !== "" || valid.length === 0}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === "saving" ? "Guardando…" : `Guardar ${valid.length} preguntas en el tema`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
