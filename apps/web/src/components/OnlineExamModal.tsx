"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { renderLatex } from "@/lib/latex";
import { toast } from "sonner";
import { api, apiBlob } from "@/lib/api";

type Grading = { questionId: string; earned: number; max: number; auto: boolean; manual?: boolean };
type Answer = { choice?: number; items?: Array<boolean | null>; blanks?: string[]; text?: string };

type Submission = {
  id: string;
  studentName: string;
  autoScore: number;
  maxScore: number;
  pendingManual: boolean;
  source?: "online" | "paper";
  createdAt: string;
  grading: Grading[];
  answers: Record<string, Answer>;
};

type Online = { id: string; token: string; isOpen: boolean; showScore: boolean; submissions: Submission[] };

type ExamQuestion = {
  id: string;
  type: string;
  statement: string;
  options?: unknown;
};

function fmt(n: number) {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function describeAnswer(q: ExamQuestion | undefined, a: Answer | undefined, paper = false): string {
  if (!a) return paper && (q?.type === "OPEN" || q?.type === "FILL_IN") ? "(en la hoja del examen)" : "(sin responder)";
  // En papel las opciones están en el orden del tema impreso: se muestra la letra marcada
  if (paper && q?.type === "MULTIPLE_CHOICE" && a.choice !== undefined) return `marcó ${"ABCDEFGH"[a.choice]}`;
  if (q?.type === "MULTIPLE_CHOICE" && a.choice !== undefined) {
    const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
    return `${"abcdefgh"[a.choice]}) ${opts[a.choice] ?? ""}`;
  }
  if (q?.type === "TRUE_FALSE" && a.choice !== undefined) return a.choice === 0 ? "Verdadero" : "Falso";
  if (a.items) return a.items.map((v, i) => `${i + 1}:${v === true ? "V" : v === false ? "F" : "—"}`).join("  ");
  if (a.blanks) return a.blanks.map((b, i) => `(${i + 1}) ${b || "—"}`).join("  ");
  if (a.text !== undefined) return a.text || "(sin responder)";
  return "(sin responder)";
}

export default function OnlineExamModal({
  isOpen,
  onClose,
  examId,
  examTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  examTitle?: string | null;
}) {
  const [online, setOnline] = useState<Online | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [paperEnabled, setPaperEnabled] = useState(false);
  const [sheetVersions, setSheetVersions] = useState(1);
  const [grading, setGrading] = useState(false);
  const [lastPaper, setLastPaper] = useState<
    { studentName: string; autoScore: number; maxScore: number; version: string; notes: string } | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [status, exam] = await Promise.all([
        api<{ online: Online | null; paperGradingEnabled?: boolean }>(`/exams/${examId}/online`),
        api<{ items: Array<{ question: ExamQuestion }> }>(`/exams/${examId}`),
      ]);
      setOnline(status.online);
      setPaperEnabled(Boolean(status.paperGradingEnabled));
      setQuestions(exam.items.map((it) => it.question));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const link = online && typeof window !== "undefined" ? `${window.location.origin}/e/${online.token}` : "";

  if (!isOpen) return null;

  async function downloadSheet() {
    try {
      const blob = await apiBlob(`/exams/${examId}/export/answer-sheet?versions=${sheetVersions}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Hoja de respuestas - ${examTitle ?? "examen"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar la hoja");
    }
  }

  async function gradePhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setGrading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: la foto pesa más de 10 MB`);
          continue;
        }
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error("No se pudo leer la foto"));
          r.readAsDataURL(file);
        });
        const res = await api<{ studentName: string; autoScore: number; maxScore: number; version: string; notes: string }>(
          `/exams/${examId}/online/paper`,
          { method: "POST", body: JSON.stringify({ image: data, mimeType: file.type || "image/jpeg" }) }
        );
        setLastPaper(res);
        toast.success(`${res.studentName} (Tema ${res.version}): ${fmt(res.autoScore)} / ${fmt(res.maxScore)}`);
      }
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo corregir la foto");
    } finally {
      setGrading(false);
    }
  }

  async function publish() {
    try {
      await api(`/exams/${examId}/online`, { method: "POST" });
      toast.success("Examen publicado. Compartí el link con tus alumnos.");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo publicar");
    }
  }

  async function patch(data: { isOpen?: boolean; showScore?: boolean }) {
    try {
      await api(`/exams/${examId}/online`, { method: "PATCH", body: JSON.stringify(data) });
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  async function saveGrades(sub: Submission) {
    const points: Record<string, number> = {};
    for (const g of sub.grading) {
      const raw = manual[`${sub.id}:${g.questionId}`];
      if (raw !== undefined && raw.trim() !== "") points[g.questionId] = Number(raw.replace(",", "."));
    }
    if (Object.keys(points).length === 0) return;
    try {
      await api(`/exams/${examId}/online/submissions/${sub.id}`, {
        method: "PATCH",
        body: JSON.stringify({ points }),
      });
      toast.success("Corrección guardada");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  async function removeSubmission(sub: Submission) {
    if (!window.confirm(`¿Borrar la entrega de ${sub.studentName}?`)) return;
    try {
      await api(`/exams/${examId}/online/submissions/${sub.id}`, { method: "DELETE" });
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo borrar");
    }
  }

  function exportCsv() {
    if (!online) return;
    const rows = [
      ["Alumno", "Fecha", "Puntaje", "Máximo", "Pendiente de corrección"],
      ...online.submissions.map((s) => [
        s.studentName,
        new Date(s.createdAt).toLocaleString("es-AR"),
        fmt(s.autoScore),
        fmt(s.maxScore),
        s.pendingManual ? "sí" : "no",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas - ${examTitle ?? "examen"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn =
    "h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Examen online</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400">{examTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
            Cerrar ✕
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 p-4 text-sm dark:border-slate-800">
          <div className="font-semibold text-gray-900 dark:text-white">Examen en papel</div>
          <p className="mt-1 text-gray-600 dark:text-slate-400">
            Imprimí la hoja de respuestas con burbujas. Después sacale una foto a cada hoja completada y la app la corrige
            sola (usa la clave del tema que figura en la hoja).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={sheetVersions}
              onChange={(e) => setSheetVersions(Number(e.target.value))}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 tema" : `${n} temas`}
                </option>
              ))}
            </select>
            <button type="button" className={btn} onClick={downloadSheet}>
              Descargar hoja de respuestas
            </button>
            {paperEnabled ? (
              <label className={`${btn} inline-flex cursor-pointer items-center ${grading ? "opacity-60" : ""}`}>
                {grading ? "Corrigiendo…" : "📷 Corregir con foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  multiple
                  disabled={grading}
                  className="hidden"
                  onChange={(e) => {
                    gradePhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : (
              <span className="text-xs text-gray-500">La corrección con foto requiere la IA habilitada en el servidor.</span>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-500">
            Usá la misma cantidad de temas que al descargar el examen. Las preguntas abiertas y de completar se corrigen a mano.
          </p>
          {lastPaper && (
            <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
              Última hoja: <b>{lastPaper.studentName}</b> · Tema {lastPaper.version} ·{" "}
              <b>
                {fmt(lastPaper.autoScore)} / {fmt(lastPaper.maxScore)}
              </b>
              {lastPaper.notes ? <div className="mt-1 text-xs text-amber-700">Atención: {lastPaper.notes}</div> : null}
            </div>
          )}
        </div>

        {loading && !online ? (
          <div className="mt-6 text-sm text-gray-500">Cargando…</div>
        ) : !online ? (
          <div className="mt-6 grid gap-3 text-sm text-gray-700 dark:text-slate-300">
            <p>
              Publicá este examen para que tus alumnos lo respondan desde el celular o la compu, con un link y sin crear
              cuenta.
            </p>
            <ul className="list-disc pl-5 text-gray-600 dark:text-slate-400">
              <li>Multiple choice, V/F, Multi V/F y completar se corrigen solos.</li>
              <li>Las preguntas abiertas las corregís vos desde acá.</li>
              <li>Usa los puntajes que cargaste (si no, 1 punto por pregunta).</li>
            </ul>
            <button
              type="button"
              onClick={publish}
              className="mt-2 h-10 w-fit rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700"
            >
              Publicar online
            </button>
          </div>
        ) : (
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                className={btn}
                onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copiado"))}
              >
                Copiar link
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-700 dark:text-slate-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={online.isOpen} onChange={(e) => patch({ isOpen: e.target.checked })} />
                Recibiendo respuestas
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={online.showScore}
                  onChange={(e) => patch({ showScore: e.target.checked })}
                />
                Mostrar el puntaje al alumno al enviar
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Entregas ({online.submissions.length})
              </h3>
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={load}>
                  Actualizar
                </button>
                {online.submissions.length > 0 && (
                  <button type="button" className={btn} onClick={exportCsv}>
                    Exportar notas (CSV)
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
              {online.submissions.length === 0 ? (
                <p className="py-6 text-sm text-gray-500">Todavía no hay entregas.</p>
              ) : (
                <ul className="grid gap-2">
                  {online.submissions.map((s) => (
                    <li key={s.id} className="rounded-lg border border-gray-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setOpenSub(openSub === s.id ? null : s.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {s.studentName}
                          {s.source === "paper" && (
                            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                              papel
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2 text-sm">
                          {s.pendingManual && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                              falta corregir
                            </span>
                          )}
                          <b className="text-gray-900 dark:text-white">
                            {fmt(s.autoScore)} / {fmt(s.maxScore)}
                          </b>
                          <span className="text-xs text-gray-500">
                            {new Date(s.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </span>
                      </button>

                      {openSub === s.id && (
                        <div className="border-t border-gray-100 px-3 py-3 dark:border-slate-800">
                          <ol className="grid gap-2 text-sm">
                            {s.grading.map((g, i) => {
                              const q = qById.get(g.questionId);
                              const key = `${s.id}:${g.questionId}`;
                              return (
                                <li key={g.questionId} className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-gray-800 dark:text-slate-200">
                                      {i + 1}) {q?.statement ? renderLatex(q.statement.replace(/\[\[.*?\]\]/g, "____")) : "(pregunta)"}
                                    </div>
                                    <div className="text-gray-500 dark:text-slate-400">
                                      Respuesta: {describeAnswer(q, s.answers?.[g.questionId], s.source === "paper")}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    {!g.auto || g.manual ? (
                                      <input
                                        inputMode="decimal"
                                        placeholder={g.manual ? fmt(g.earned) : "—"}
                                        value={manual[key] ?? ""}
                                        onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))}
                                        className="h-8 w-14 rounded border border-gray-300 px-1.5 text-right dark:border-slate-700 dark:bg-slate-800"
                                      />
                                    ) : (
                                      <span className={g.earned >= g.max ? "text-emerald-700" : g.earned > 0 ? "text-amber-700" : "text-red-700"}>
                                        {fmt(g.earned)}
                                      </span>
                                    )}
                                    <span className="text-gray-500">/ {fmt(g.max)}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                          <div className="mt-3 flex justify-between">
                            <button type="button" onClick={() => removeSubmission(s)} className="text-xs text-red-600 hover:underline">
                              Borrar entrega
                            </button>
                            {s.grading.some((g) => !g.auto || g.manual) && (
                              <button
                                type="button"
                                onClick={() => saveGrades(s)}
                                className="h-8 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                              >
                                Guardar corrección
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
