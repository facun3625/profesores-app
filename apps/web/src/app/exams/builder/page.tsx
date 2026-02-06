"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { apiBlob } from "@/lib/api";

/* =====================
   Types
===================== */

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subjectId: string };

type Difficulty = "easy" | "medium" | "hard";
type QType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN";

type Question = {
  id: string;
  type: QType;
  difficulty: Difficulty;
  statement: string;
  options?: string[] | null;
};

type PreviewQuestionsResponse = {
  questions: Question[];
};

type GenerateOrReuseResponse = {
  mode: "created" | "reused";
  exam: { id: string; title: string };
  exportPdfUrl: string;
};

type StockBucket = {
  type: QType;
  difficulty: Difficulty;
  available: number;
};

/* =====================
   Helpers
===================== */

function labelType(t: QType) {
  if (t === "MULTIPLE_CHOICE") return "Multiple choice";
  if (t === "TRUE_FALSE") return "True / False";
  return "Open";
}

function extractQuestions(res: any): Question[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.questions)) return res.questions;
  return [];
}

/* =====================
   Page
===================== */

export default function Page() {
  // DEV ONLY: user real que existe en tu DB (el que usaste para exportar por curl)
  const userId = "cml46dnou00020xqqo3fhehqr";

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

  /* ---------- base state ---------- */
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicIds, setTopicIds] = useState<string[]>([]);

  const [title, setTitle] = useState("Examen de prueba");

  const [mc, setMc] = useState(0);
  const [tf, setTf] = useState(0);
  const [op, setOp] = useState(0);

  const totalQuestions = useMemo(() => mc + tf + op, [mc, tf, op]);

  const [difficulties, setDifficulties] = useState<Difficulty[]>([
    "easy",
    "medium",
    "hard",
  ]);

  /* ---------- preview / result ---------- */
  const [stock, setStock] = useState<StockBucket[] | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[] | null>(
    null
  );
  const [result, setResult] = useState<GenerateOrReuseResponse | null>(null);
  const [error, setError] = useState("");

  /* =====================
     Load subjects / topics
  ===================== */

  useEffect(() => {
    api<Subject[]>("/subjects")
      .then(setSubjects)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!subjectId) {
      setTopics([]);
      setTopicIds([]);
      setStock(null);
      return;
    }

    api<Topic[]>(`/topics/subject/${subjectId}`)
      .then((data) => {
        setTopics(data);
        setTopicIds([]);
        setStock(null);
      })
      .catch((e) => setError(e.message));
  }, [subjectId]);

  /* =====================
     Toggles
  ===================== */

  function toggleTopic(id: string) {
    setPreviewQuestions(null);
    setResult(null);
    setTopicIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleDifficulty(d: Difficulty) {
    setPreviewQuestions(null);
    setResult(null);
    setDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  /* =====================
     Stock preview (AUTO)
  ===================== */

  useEffect(() => {
    if (!subjectId || topicIds.length === 0 || difficulties.length === 0) {
      setStock(null);
      return;
    }

    Promise.all(
      topicIds.map((topicId) =>
        api<any>(
          `/questions?subjectId=${subjectId}&topicId=${topicId}&page=1&limit=1000`
        )
      )
    )
      .then((responses) => {
        const all = responses.flatMap(extractQuestions);
        const filtered = all.filter((q) => difficulties.includes(q.difficulty));

        const types: QType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "OPEN"];
        const diffs: Difficulty[] = ["easy", "medium", "hard"];

        const buckets: StockBucket[] = [];

        for (const t of types) {
          for (const d of diffs) {
            buckets.push({
              type: t,
              difficulty: d,
              available: filtered.filter(
                (q) => q.type === t && q.difficulty === d
              ).length,
            });
          }
        }

        setStock(buckets);
      })
      .catch(() => setStock(null));
  }, [subjectId, topicIds, difficulties]);

  const stockByType = useMemo(() => {
    if (!stock) return null;

    const types: QType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "OPEN"];
    const diffs: Difficulty[] = ["easy", "medium", "hard"];

    return types.map((t) => {
      const byDiff = diffs.reduce<Record<Difficulty, number>>(
        (acc, d) => {
          acc[d] =
            stock.find((b) => b.type === t && b.difficulty === d)?.available ??
            0;
          return acc;
        },
        { easy: 0, medium: 0, hard: 0 }
      );

      const total = diffs.reduce((s, d) => s + byDiff[d], 0);
      return { type: t, total, byDiff };
    });
  }, [stock]);

  /* =====================
     Validation
  ===================== */

  function validate(): string | null {
    if (!subjectId) return "Elegí una materia.";
    if (topicIds.length === 0) return "Seleccioná al menos un tema.";
    if (totalQuestions <= 0) return "Elegí al menos una pregunta.";
    return null;
  }

  const typeCounts = {
    MULTIPLE_CHOICE: mc,
    TRUE_FALSE: tf,
    OPEN: op,
  };

  /* =====================
     Actions
  ===================== */

  async function previewRequest() {
    setError("");
    setPreviewQuestions(null);
    setResult(null);

    const err = validate();
    if (err) return setError(err);

    const payload = {
      title,
      topicIds,
      totalQuestions,
      typeCounts,
      difficulties,
      shuffle: true,
    };

    try {
      const res = await api<PreviewQuestionsResponse>("/exams/preview-questions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPreviewQuestions(res.questions ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function generateOrReuse() {
    setError("");
    setResult(null);

    const err = validate();
    if (err) return setError(err);

    const payload = {
      title,
      topicIds,
      totalQuestions,
      typeCounts,
      difficulties,
      shuffle: true,
    };

    try {
      const res = await api<GenerateOrReuseResponse>("/exams/generate-or-reuse", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const pdfHref = result ? `${API_BASE}${result.exportPdfUrl}` : null;

  async function downloadPdf() {
  setError("");
  if (!result) return;

  try {
    const safeName =
      (result.exam.title || "exam").replace(/[^a-z0-9\-_ ]/gi, "").trim() || "exam";

    const blob = await apiBlob(result.exportPdfUrl);

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    console.error(e);
    setError(e?.message ?? "Error descargando PDF");
  }
}

  /* =====================
     UI
  ===================== */

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Profesores App — Front MVP</h1>

      {error && (
        <div style={{ border: "1px solid red", padding: 10 }}>{error}</div>
      )}

      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label>
        Materia
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">— seleccionar —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <h3>Temas</h3>
      {topics.map((t) => (
        <label key={t.id}>
          <input
            type="checkbox"
            checked={topicIds.includes(t.id)}
            onChange={() => toggleTopic(t.id)}
          />
          {t.name}
        </label>
      ))}

      {stockByType && (
        <div style={{ border: "1px solid", padding: 12, marginTop: 12 }}>
          <b>Preguntas disponibles</b>
          {stockByType.map((r) => (
            <div key={r.type}>
              {labelType(r.type)}: {r.total} (easy {r.byDiff.easy} · medium{" "}
              {r.byDiff.medium} · hard {r.byDiff.hard})
            </div>
          ))}
        </div>
      )}

      <h3>Cantidad de preguntas</h3>
      <input type="number" value={mc} onChange={(e) => setMc(+e.target.value)} />
      <input type="number" value={tf} onChange={(e) => setTf(+e.target.value)} />
      <input type="number" value={op} onChange={(e) => setOp(+e.target.value)} />

      <h3>Dificultades</h3>
      {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
        <label key={d}>
          <input
            type="checkbox"
            checked={difficulties.includes(d)}
            onChange={() => toggleDifficulty(d)}
          />
          {d}
        </label>
      ))}

      <div style={{ marginTop: 20 }}>
        <button onClick={previewRequest}>Preview</button>
        <button onClick={generateOrReuse}>Generate</button>
      </div>

      {previewQuestions && (
        <>
          <h3>Preview ({previewQuestions.length})</h3>
          <ol>
            {previewQuestions.map((q) => (
              <li key={q.id}>
                <b>{q.statement}</b> — {labelType(q.type)} ({q.difficulty})
              </li>
            ))}
          </ol>
        </>
      )}

      {result && (
  <div>
    <h3>Examen generado</h3>
    <button type="button" onClick={downloadPdf}>
      Descargar PDF
    </button>
  </div>
)}


      
    </main>
  );
}
