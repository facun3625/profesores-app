"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, apiBlob } from "@/lib/api";

/* =====================
   Types
===================== */

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subjectId: string };

type Difficulty = "easy" | "medium" | "hard";
type QType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN";

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

  subjectId?: string | null;
  topicId?: string | null;

  items?: ExamItem[] | null;
  questions?: Question[] | null;
};

/* =====================
   Helpers
===================== */

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function labelType(t?: QType) {
  if (!t) return "—";
  if (t === "MULTIPLE_CHOICE") return "Multiple choice";
  if (t === "TRUE_FALSE") return "True / False";
  return "Open";
}

function safeName(name: string) {
  return (name || "exam").replace(/[^a-z0-9\-_ ]/gi, "").trim() || "exam";
}

function resolveFromExam(exam: Exam): {
  subjectId?: string;
  topicIds: string[];
  questionIds: string[];
} {
  let subjectId = exam.subjectId ?? undefined;
  const topicIds: string[] = [];
  const questionIds: string[] = [];

  if (Array.isArray(exam.questions) && exam.questions.length) {
    for (const q of exam.questions) {
      if (!q?.id) continue;
      questionIds.push(q.id);
      if (!subjectId && q.subjectId) subjectId = q.subjectId;
      if (q.topicId && !topicIds.includes(q.topicId)) topicIds.push(q.topicId);
    }
    if (exam.topicId) return { subjectId, topicIds: [exam.topicId], questionIds };
    return { subjectId, topicIds, questionIds };
  }

  if (Array.isArray(exam.items) && exam.items.length) {
    const items = exam.items.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const it of items) {
      const qid = (it.questionId ?? it.question?.id ?? null) as string | null;
      if (qid) questionIds.push(qid);

      const q = it.question ?? null;
      if (q) {
        if (!subjectId && q.subjectId) subjectId = q.subjectId;
        if (q.topicId && !topicIds.includes(q.topicId)) topicIds.push(q.topicId);
      }
    }
    if (exam.topicId) return { subjectId, topicIds: [exam.topicId], questionIds };
    return { subjectId, topicIds, questionIds };
  }

  if (exam.topicId) topicIds.push(exam.topicId);
  return { subjectId, topicIds, questionIds };
}

async function tryCreateExam(payload: any) {
  const candidates = ["/exams", "/exams/manual", "/exams/create", "/exams/manual-create"];
  let lastErr: any = null;

  for (const path of candidates) {
    try {
      const res = await api<any>(path, { method: "POST", body: JSON.stringify(payload) });
      const id = res?.id || res?.exam?.id;
      if (!id) throw new Error(`Respuesta inesperada creando examen en ${path}`);
      return { id, usedPath: path };
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? "");
      const is404 =
        msg.includes("Cannot POST") || msg.includes("Not Found") || msg.includes("HTTP 404");
      if (!is404) throw e;
    }
  }

  throw lastErr ?? new Error("No se pudo crear el examen (ningún endpoint).");
}

/* =====================
   Page
===================== */

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();

  const from = sp.get("from");
  const mode = sp.get("mode");
  const isDuplicate = !!from && mode === "duplicate";

  const [error, setError] = useState("");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [subjectId, setSubjectId] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);

  const [title, setTitle] = useState("Examen manual");
  const [description, setDescription] = useState("");

  const [bankLoading, setBankLoading] = useState(false);
  const [bank, setBank] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const dSearch = useDebouncedValue(search, 200);

  const [typeFilter, setTypeFilter] = useState<QType | "ALL">("ALL");
  const [diffFilter, setDiffFilter] = useState<Difficulty | "ALL">("ALL");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ✅ para quedarnos en pantalla post-create/duplicate
  const [createdExamId, setCreatedExamId] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  /* Load subjects */
  useEffect(() => {
    api<Subject[]>("/subjects")
      .then(setSubjects)
      .catch((e: any) => setError(e?.message ?? "Error cargando materias"));
  }, []);

  /* Load exam if duplicating */
  useEffect(() => {
    if (!from) return;

    (async () => {
      setError("");
      setCreatedExamId(null);

      try {
        const res = await api<any>(`/exams/${from}`);
        const exam = (res?.exam ?? res) as Exam;

        const baseTitle = exam.title ?? "Examen";
        setTitle(isDuplicate ? `${baseTitle} (copia)` : baseTitle);
        setDescription(exam.description ?? "");

        const parsed = resolveFromExam(exam);

        if (parsed.subjectId) setSubjectId(parsed.subjectId);
        if (parsed.topicIds.length) setTopicIds(parsed.topicIds);
        if (parsed.questionIds.length) setSelectedIds(parsed.questionIds);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando examen para duplicar");
      }
    })();
  }, [from, isDuplicate]);

  /* Load topics when subject changes */
  useEffect(() => {
    if (!subjectId) {
      setTopics([]);
      setTopicIds([]);
      setBank([]);
      setCreatedExamId(null);
      return;
    }

    api<Topic[]>(`/topics/subject/${subjectId}`)
      .then((data) => setTopics(data))
      .catch((e: any) => setError(e?.message ?? "Error cargando temas"));
  }, [subjectId]);

  /* Load bank questions when subject/topic changes */
  useEffect(() => {
    if (!subjectId) {
      setBank([]);
      return;
    }

    (async () => {
      setError("");
      setBankLoading(true);
      try {
        let all: Question[] = [];

        if (topicIds.length) {
          const responses = await Promise.all(
            topicIds.map((tid) =>
              api<any>(`/questions?subjectId=${subjectId}&topicId=${tid}&page=1&limit=1000`)
            )
          );

          all = responses.flatMap((r) =>
            Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []
          );
        } else {
          const r = await api<any>(`/questions?subjectId=${subjectId}&page=1&limit=1000`);
          all = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
        }

        setBank(all);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando preguntas");
        setBank([]);
      } finally {
        setBankLoading(false);
      }
    })();
  }, [subjectId, topicIds]);

  const filteredBank = useMemo(() => {
    let list = [...bank];

    if (typeFilter !== "ALL") list = list.filter((q) => q.type === typeFilter);
    if (diffFilter !== "ALL") list = list.filter((q) => q.difficulty === diffFilter);

    const needle = dSearch.trim().toLowerCase();
    if (needle) {
      list = list.filter((q) => (q.statement ?? "").toLowerCase().includes(needle));
    }

    return list;
  }, [bank, typeFilter, diffFilter, dSearch]);

  const selectedQuestions = useMemo(() => {
    const map = new Map(bank.map((q) => [q.id, q]));
    return selectedIds.map((id) => map.get(id) ?? ({ id, statement: "(pregunta no cargada)" } as any));
  }, [selectedIds, bank]);

  function touch() {
    // si el user toca algo, invalidamos el “examen creado”
    if (createdExamId) setCreatedExamId(null);
  }

  function toggleTopic(id: string) {
    touch();
    setTopicIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelect(questionId: string) {
    touch();
    setSelectedIds((prev) =>
      prev.includes(questionId) ? prev.filter((x) => x !== questionId) : [...prev, questionId]
    );
  }

  function moveSelected(id: string, dir: -1 | 1) {
    touch();
    setSelectedIds((prev) => {
      const i = prev.indexOf(id);
      if (i === -1) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
      return copy;
    });
  }

  function removeSelected(id: string) {
    touch();
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  function validate(): string | null {
    if (!title.trim()) return "Poné un título.";
    if (!subjectId) return "Elegí una materia.";
    if (selectedIds.length === 0) return "Seleccioná al menos una pregunta.";
    return null;
  }

  async function submit() {
    setError("");
    const err = validate();
    if (err) return setError(err);

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        questionIds: selectedIds,
      };

      const created = await tryCreateExam(payload);
      setCreatedExamId(created.id);

      // ✅ NO redirigimos: nos quedamos como antes
      // (si algún día querés volver a listado, lo hacemos con un botón "Ir a exámenes")
    } catch (e: any) {
      setError(e?.message ?? "Error creando examen");
      setCreatedExamId(null);
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    setError("");
    if (!createdExamId) return;

    try {
      const blob = await apiBlob(`/exams/${createdExamId}/export/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName(title)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? "Error descargando PDF");
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>
          {isDuplicate ? "Duplicar examen" : "Crear examen manual"}
        </h1>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/exams">Volver</a>
          <button onClick={submit} disabled={saving}>
            {saving ? "Procesando..." : isDuplicate ? "Duplicar" : "Crear"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ border: "1px solid red", padding: 10, marginTop: 12 }}>
          {error}
        </div>
      )}

      {/* ✅ “Examen creado” + acciones, igual que antes */}
      {createdExamId && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #cce7ff",
            background: "#f6fbff",
            padding: 12,
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 13 }}>
            <b>Examen creado:</b>{" "}
            <span style={{ fontFamily: "monospace" }}>{createdExamId}</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={downloadPdf}>
              Descargar PDF
            </button>
            <button type="button" onClick={() => router.push("/exams")}>
              Ir a exámenes
            </button>
          </div>
        </div>
      )}

      <section style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Título
          <input
            value={title}
            onChange={(e) => {
              touch();
              setTitle(e.target.value);
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Descripción
          <textarea
            value={description}
            onChange={(e) => {
              touch();
              setDescription(e.target.value);
            }}
            rows={3}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Materia
          <select
            value={subjectId}
            onChange={(e) => {
              touch();
              setSubjectId(e.target.value);
            }}
          >
            <option value="">— seleccionar —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Banco de preguntas</h2>

          <div style={{ marginBottom: 10 }}>
            <b>Temas</b>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {topics.map((t) => (
                <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={topicIds.includes(t.id)}
                    onChange={() => toggleTopic(t.id)}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              Buscar
              <input
                value={search}
                onChange={(e) => {
                  touch();
                  setSearch(e.target.value);
                }}
                placeholder="Escribí y filtra..."
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Tipo
              <select
                value={typeFilter}
                onChange={(e) => {
                  touch();
                  setTypeFilter(e.target.value as any);
                }}
              >
                <option value="ALL">Todos</option>
                <option value="MULTIPLE_CHOICE">Multiple choice</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="OPEN">Open</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Dificultad
              <select
                value={diffFilter}
                onChange={(e) => {
                  touch();
                  setDiffFilter(e.target.value as any);
                }}
              >
                <option value="ALL">Todas</option>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </label>
          </div>

          {bankLoading ? (
            <div style={{ opacity: 0.8 }}>Cargando preguntas...</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {filteredBank.map((q) => (
                <label
                  key={q.id}
                  style={{ display: "grid", gap: 4, border: "1px solid #eee", borderRadius: 8, padding: 10 }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                    />
                    <b style={{ flex: 1 }}>{q.statement}</b>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {labelType(q.type)} · {q.difficulty} · {q.id}
                  </div>
                </label>
              ))}
              {filteredBank.length === 0 && (
                <div style={{ opacity: 0.8, fontSize: 13 }}>No hay preguntas con esos filtros.</div>
              )}
            </div>
          )}
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Seleccionadas ({selectedIds.length})</h2>

          {selectedIds.length === 0 ? (
            <div style={{ opacity: 0.8 }}>Elegí preguntas del banco.</div>
          ) : (
            <ol style={{ display: "grid", gap: 8, paddingLeft: 18 }}>
              {selectedQuestions.map((q: any) => (
                <li key={q.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <b style={{ flex: 1 }}>{q.statement ?? "(sin enunciado)"}</b>
                    <span style={{ fontFamily: "monospace", fontSize: 12 }}>{q.id}</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => moveSelected(q.id, -1)}>↑</button>
                    <button type="button" onClick={() => moveSelected(q.id, 1)}>↓</button>
                    <button type="button" onClick={() => removeSelected(q.id)}>Quitar</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}