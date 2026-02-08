"use client";

import { useEffect, useMemo, useState } from "react";
import { api, apiBlob } from "@/lib/api";

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subjectId: string };

type QType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN";
type Difficulty = "easy" | "medium" | "hard";

type Question = {
  id: string;
  subjectId?: string | null;
  topicId?: string | null;
  type?: QType;
  difficulty?: Difficulty;
  statement?: string;
  options?: string[] | null;
};

type ExamItem = {
  order?: number | null;
  questionId?: string | null;
  question?: Question | null;
};

type Exam = {
  id: string;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;

  subjectId?: string | null;
  topicId?: string | null;

  items?: ExamItem[] | null;
  questions?: Question[] | null;
};

function extractArray<T>(res: any): T[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.exams)) return res.exams;
  return [];
}

function contains(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function formatDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function safeName(name: string) {
  return (name || "exam").replace(/[^a-z0-9\-_ ]/gi, "").trim() || "exam";
}

function resolveSubjectTopicIds(exam: Exam) {
  if (exam.subjectId || exam.topicId) {
    return {
      subjectId: exam.subjectId ?? undefined,
      topicId: exam.topicId ?? undefined,
    };
  }

  const qFromItems = exam.items?.find((it) => it?.question)?.question;
  if (qFromItems?.subjectId || qFromItems?.topicId) {
    return {
      subjectId: qFromItems.subjectId ?? undefined,
      topicId: qFromItems.topicId ?? undefined,
    };
  }

  const qFromQuestions = exam.questions?.[0];
  if (qFromQuestions?.subjectId || qFromQuestions?.topicId) {
    return {
      subjectId: qFromQuestions.subjectId ?? undefined,
      topicId: qFromQuestions.topicId ?? undefined,
    };
  }

  return {};
}

function resolveQuestions(exam: Exam): Question[] {
  if (Array.isArray(exam.questions) && exam.questions.length) {
    return exam.questions.filter(Boolean) as Question[];
  }

  if (Array.isArray(exam.items) && exam.items.length) {
    return exam.items
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((it) => it.question)
      .filter(Boolean) as Question[];
  }

  return [];
}

function labelType(t?: QType) {
  if (!t) return "—";
  if (t === "MULTIPLE_CHOICE") return "Multiple choice";
  if (t === "TRUE_FALSE") return "True / False";
  return "Open";
}

export default function Page() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");

  const [exams, setExams] = useState<Exam[]>([]);

  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 250);
  const [sort, setSort] = useState<"newest" | "oldest" | "az">("newest");

  const [openExamId, setOpenExamId] = useState<string | null>(null);
  const [openExamQuestions, setOpenExamQuestions] = useState<Question[]>([]);
  const [openLoading, setOpenLoading] = useState(false);
  const [openQ, setOpenQ] = useState("");
  const dOpenQ = useDebouncedValue(openQ, 150);

  useEffect(() => {
    api<Subject[]>("/subjects")
      .then(setSubjects)
      .catch((e: any) => setError(e?.message ?? "Error cargando materias"));
  }, []);

  useEffect(() => {
    if (!subjectId) {
      setTopics([]);
      setTopicId("");
      return;
    }

    api<Topic[]>(`/topics/subject/${subjectId}`)
      .then(setTopics)
      .catch((e: any) => setError(e?.message ?? "Error cargando temas"));
  }, [subjectId]);

  async function loadExams() {
    setError("");
    setLoading(true);
    try {
      const res = await api<any>("/exams");
      setExams(extractArray<Exam>(res));
    } catch (e: any) {
      setError(e?.message ?? "Error cargando exámenes");
      setExams([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExams();
  }, []);

  async function downloadPdf(examId: string, title?: string | null) {
    setError("");
    try {
      const blob = await apiBlob(`/exams/${examId}/export/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName(String(title ?? "exam"))}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? "Error descargando PDF");
    }
  }

  async function openExam(exam: Exam) {
    setError("");
    setOpenQ("");
    if (openExamId === exam.id) {
      setOpenExamId(null);
      setOpenExamQuestions([]);
      return;
    }

    setOpenLoading(true);
    try {
      let qs = resolveQuestions(exam);

      if (qs.length === 0) {
        const full = await api<any>(`/exams/${exam.id}`);
        const fullExam = (full?.exam ?? full) as Exam;
        qs = resolveQuestions(fullExam);
      }

      setOpenExamId(exam.id);
      setOpenExamQuestions(qs);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando examen");
      setOpenExamId(null);
      setOpenExamQuestions([]);
    } finally {
      setOpenLoading(false);
    }
  }

  const subjectNameById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.name])),
    [subjects]
  );

  const topicNameById = useMemo(
    () => new Map(topics.map((t) => [t.id, t.name])),
    [topics]
  );

  const filtered = useMemo(() => {
    let list = [...exams];

    if (subjectId || topicId) {
      list = list.filter((e) => {
        const r = resolveSubjectTopicIds(e);
        if (subjectId && r.subjectId !== subjectId) return false;
        if (topicId && r.topicId !== topicId) return false;
        return true;
      });
    }

    if (dq.trim()) {
      list = list.filter((e) =>
        contains(`${e.title ?? ""} ${e.description ?? ""} ${e.id}`, dq)
      );
    }

    if (sort === "az") {
      list.sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? "")));
    } else {
      const dir = sort === "newest" ? -1 : 1;
      list.sort(
        (a, b) =>
          (new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()) * dir
      );
    }

    return list;
  }, [exams, subjectId, topicId, dq, sort]);

  const openFilteredQuestions = useMemo(() => {
    const needle = dOpenQ.trim();
    if (!needle) return openExamQuestions;
    return openExamQuestions.filter((q) => contains(`${q.statement ?? ""} ${q.id}`, needle));
  }, [openExamQuestions, dOpenQ]);

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Exámenes guardados</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/exams/manual">+ Nuevo examen manual</a>
          <a href="/exams/builder">Crear examen automático</a>
          <button onClick={loadExams} disabled={loading}>
            {loading ? "Actualizando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ border: "1px solid red", padding: 10, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <section style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <b>Filtros</b>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            Buscar (título/desc/id)
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: fracciones, cml..., prueba..."
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Materia
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— todas —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Tema
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId}>
              <option value="">— todos —</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Orden
            <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="newest">Más nuevo</option>
              <option value="oldest">Más viejo</option>
              <option value="az">A-Z</option>
            </select>
          </label>
        </div>
      </section>

      <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
        <b>
          Resultados: {filtered.length} / {exams.length}
        </b>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {filtered.map((e) => {
            const r = resolveSubjectTopicIds(e);
            const subjectLabel = r.subjectId ? subjectNameById.get(r.subjectId) ?? r.subjectId : "(no disponible)";
            const topicLabel = r.topicId ? topicNameById.get(r.topicId) ?? r.topicId : "(no disponible)";
            const isOpen = openExamId === e.id;

            return (
              <div key={e.id} style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{e.title ?? "Sin título"}</b>
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>{e.id}</span>
                </div>

                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Materia: {subjectLabel} · Tema: {topicLabel} · Creado: {formatDate(e.createdAt)}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={() => openExam(e)} disabled={openLoading && !isOpen}>
                    {isOpen ? "Cerrar" : openLoading ? "Cargando..." : "Ver"}
                  </button>

                  <button onClick={() => downloadPdf(e.id, e.title)}>Descargar PDF</button>

                  <a href={`/exams/manual?from=${e.id}&mode=duplicate`}>Duplicar</a>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <b>Preguntas ({openExamQuestions.length})</b>
                      <input
                        value={openQ}
                        onChange={(ev) => setOpenQ(ev.target.value)}
                        placeholder="Buscar dentro del examen..."
                        style={{ minWidth: 280 }}
                      />
                    </div>

                    {openExamQuestions.length === 0 ? (
                      <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
                        No hay preguntas cargadas para este examen (o el backend no las está incluyendo).
                      </div>
                    ) : (
                      <ol style={{ marginTop: 10 }}>
                        {openFilteredQuestions.map((q) => (
                          <li key={q.id} style={{ marginBottom: 8 }}>
                            <b>{q.statement ?? "(sin enunciado)"}</b>{" "}
                            <span style={{ fontSize: 12, opacity: 0.75 }}>
                              — {labelType(q.type)} ({q.difficulty ?? "—"}) · {q.id}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}

                    <div style={{ marginTop: 10 }}>
                      <a href={`/exams/manual?from=${e.id}&mode=duplicate`}>Duplicar</a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}