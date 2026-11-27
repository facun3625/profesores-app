"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api, API_URL } from "@/lib/api";

type PublicQuestion = {
  id: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_TRUE_FALSE" | "OPEN" | "FILL_IN";
  statement?: string;
  options?: string[];
  items?: string[];
  segments?: string[];
  blanks?: number;
  openLines?: number;
  points?: number | null;
  hasImage?: boolean;
};

type PublicExam = {
  isOpen: boolean;
  title: string;
  description?: string | null;
  institutionName: string;
  questions: PublicQuestion[];
};

type Answer = { choice?: number; items?: Array<boolean | null>; blanks?: string[]; text?: string };

type SubmitResult = { ok: true; score?: number; maxScore?: number; pendingManual?: boolean };

function fmt(n: number) {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/** Página pública para que el alumno responda el examen (sin cuenta). */
export default function OnlineExamPage() {
  const { token } = useParams<{ token: string }>();
  const draftKey = `profly-online-${token}`;

  const [exam, setExam] = useState<PublicExam | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    api<PublicExam>(`/public/online/${encodeURIComponent(token)}`)
      .then(setExam)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "No se pudo cargar el examen"));

    // Recuperar borrador (por si se recarga la página)
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.name) setName(draft.name);
        if (draft?.answers) setAnswers(draft.answers);
        if (draft?.result) setResult(draft.result);
      }
    } catch { }
  }, [token, draftKey]);

  useEffect(() => {
    if (!exam || result) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ name, answers }));
    } catch { }
  }, [name, answers, exam, result, draftKey]);

  const answeredCount = useMemo(() => {
    if (!exam) return 0;
    return exam.questions.filter((q) => {
      const a = answers[q.id];
      if (!a) return false;
      if (q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") return a.choice !== undefined;
      if (q.type === "MULTI_TRUE_FALSE") return (a.items ?? []).some((x) => x !== null && x !== undefined);
      if (q.type === "FILL_IN") return (a.blanks ?? []).some((b) => b?.trim());
      return Boolean(a.text?.trim());
    }).length;
  }, [exam, answers]);

  function setAnswer(id: string, patch: Answer) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function submit() {
    if (!exam) return;
    setError("");
    if (!name.trim()) {
      setError("Escribí tu nombre y apellido antes de enviar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const missing = exam.questions.length - answeredCount;
    if (missing > 0 && !window.confirm(`Te faltan ${missing} pregunta(s) sin responder. ¿Enviar igual?`)) return;

    setSending(true);
    try {
      const res = await api<SubmitResult>(`/public/online/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        body: JSON.stringify({ studentName: name.trim(), answers }),
      });
      setResult(res);
      try {
        localStorage.setItem(draftKey, JSON.stringify({ name, result: res }));
      } catch { }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo enviar. Revisá tu conexión y probá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";

  if (loadError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Examen no disponible</h1>
        <p className="mt-2 text-gray-600">{loadError}. Verificá el link con tu docente.</p>
      </main>
    );
  }

  if (!exam) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-gray-500">Cargando examen…</main>;
  }

  if (result) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className={card}>
          <div className="text-4xl">✅</div>
          <h1 className="mt-3 text-xl font-semibold text-gray-900">¡Respuestas enviadas!</h1>
          <p className="mt-1 text-gray-600">{exam.title}</p>
          {typeof result.score === "number" && (
            <p className="mt-4 text-lg text-gray-900">
              Puntaje automático: <b>{fmt(result.score)}</b> de {fmt(result.maxScore ?? 0)}
            </p>
          )}
          {result.pendingManual && (
            <p className="mt-2 text-sm text-gray-600">
              Algunas preguntas las corrige tu docente, así que la nota final puede cambiar.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="text-center">
        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">{exam.institutionName}</div>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{exam.title}</h1>
        {exam.description && <p className="mt-1 text-gray-600">{exam.description}</p>}
      </header>

      {!exam.isOpen ? (
        <div className={`${card} mt-6 text-center text-gray-700`}>Este examen está cerrado y ya no recibe respuestas.</div>
      ) : (
        <>
          <div className={`${card} mt-6`}>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-gray-700">Nombre y apellido</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoComplete="name"
                className="h-11 rounded-lg border border-gray-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          <ol className="mt-4 grid gap-4">
            {exam.questions.map((q, idx) => {
              const a = answers[q.id] ?? {};
              return (
                <li key={q.id} className={card}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="font-medium text-gray-900">
                      {idx + 1}){" "}
                      {q.type === "FILL_IN" ? "Completá los espacios:" : q.statement}
                    </div>
                    {typeof q.points === "number" && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {fmt(q.points)} pts
                      </span>
                    )}
                  </div>

                  {q.hasImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_URL}/public/online/${encodeURIComponent(token)}/image/${q.id}`}
                      alt=""
                      className="mb-3 max-h-72 max-w-full rounded-lg border border-gray-200 object-contain"
                    />
                  )}

                  {(q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") && (
                    <div className="grid gap-2">
                      {(q.options ?? []).map((opt, i) => (
                        <label
                          key={i}
                          className={
                            "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 " +
                            (a.choice === i ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50")
                          }
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={a.choice === i}
                            onChange={() => setAnswer(q.id, { choice: i })}
                            className="h-4 w-4"
                          />
                          <span className="text-gray-800">
                            {q.type === "MULTIPLE_CHOICE" ? `${"abcdefgh"[i]}) ` : ""}
                            {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === "MULTI_TRUE_FALSE" && (
                    <div className="grid gap-2">
                      {(q.items ?? []).map((item, i) => {
                        const v = a.items?.[i];
                        const set = (val: boolean) => {
                          const next = [...(a.items ?? Array((q.items ?? []).length).fill(null))];
                          next[i] = val;
                          setAnswer(q.id, { items: next });
                        };
                        return (
                          <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                            <span className="text-gray-800">
                              {i + 1}. {item}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              {[
                                { val: true, label: "V" },
                                { val: false, label: "F" },
                              ].map((b) => (
                                <button
                                  key={b.label}
                                  type="button"
                                  onClick={() => set(b.val)}
                                  className={
                                    "h-9 w-10 rounded-md border text-sm font-semibold " +
                                    (v === b.val ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-700")
                                  }
                                >
                                  {b.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "FILL_IN" && (
                    <p className="leading-10 text-gray-800">
                      {(q.segments ?? []).map((seg, i) => (
                        <span key={i}>
                          {seg}
                          {i < (q.blanks ?? 0) && (
                            <input
                              value={a.blanks?.[i] ?? ""}
                              onChange={(e) => {
                                const next = [...(a.blanks ?? Array(q.blanks ?? 0).fill(""))];
                                next[i] = e.target.value;
                                setAnswer(q.id, { blanks: next });
                              }}
                              aria-label={`Espacio ${i + 1}`}
                              className="mx-1 inline-block h-9 w-40 rounded-md border border-gray-300 px-2 align-middle outline-none focus:border-blue-500"
                            />
                          )}
                        </span>
                      ))}
                    </p>
                  )}

                  {q.type === "OPEN" && (
                    <textarea
                      value={a.text ?? ""}
                      onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                      rows={Math.min(12, Math.max(3, q.openLines ?? 4))}
                      maxLength={5000}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t border-gray-200 bg-white/95 py-4 backdrop-blur">
            <span className="text-sm text-gray-600">
              Respondiste {answeredCount} de {exam.questions.length}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={sending}
              className="h-11 rounded-xl bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Enviar respuestas"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
