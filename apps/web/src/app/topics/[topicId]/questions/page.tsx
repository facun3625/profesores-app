"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

type Difficulty = "easy" | "medium" | "hard";
type QType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN";

type Question = {
  id: string;
  type: QType;
  difficulty: Difficulty;
  statement: string;
  options?: string[] | null;
  correctIndex?: number | null;
  modelAnswer?: string | null;
};

type ListResponse = {
  data: Question[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type TopicInfo = {
  id: string;
  name: string;
  subject: {
    id: string;
    name: string;
  };
};

type ViewMode = "summary" | "create" | "list";

function labelType(t: QType) {
  if (t === "MULTIPLE_CHOICE") return "Multiple choice";
  if (t === "TRUE_FALSE") return "True/False";
  return "Open";
}

function labelDifficulty(d: Difficulty) {
  if (d === "easy") return "easy";
  if (d === "medium") return "medium";
  return "hard";
}

export default function TopicQuestionsPage() {
  const params = useParams();
  const search = useSearchParams();

  const topicId = params.topicId as string;
  const subjectId = (search.get("subjectId") || "").trim();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [topicInfo, setTopicInfo] = useState<TopicInfo | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState<ViewMode>("summary");

  // filtros para listado
  const [filterType, setFilterType] = useState<QType | "ALL">("ALL");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "ALL">("ALL");
  const [searchText, setSearchText] = useState("");

  // form create
  const [statement, setStatement] = useState("");
  const [type, setType] = useState<QType>("TRUE_FALSE");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [optionsText, setOptionsText] = useState("Opción A\nOpción B\nOpción C\nOpción D");
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [modelAnswer, setModelAnswer] = useState("");

  const options = useMemo(() => {
    if (type === "TRUE_FALSE") return ["Verdadero", "Falso"];
    if (type === "OPEN") return null;

    const arr = optionsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    return arr.length ? arr : null;
  }, [optionsText, type]);

  async function load() {
    setError("");

    if (!topicId) {
      setError("Topic inválido");
      return;
    }
    if (!subjectId) {
      setError("Falta subjectId en la URL. Volvé a Temas y entrá por el botón 'Gestionar preguntas'.");
      return;
    }

    try {
      const r = await api<ListResponse>(
        `/questions?subjectId=${encodeURIComponent(subjectId)}&topicId=${encodeURIComponent(topicId)}&limit=100&page=1`
      );
      setQuestions(r.data || []);
    } catch (e: any) {
      setError(e.message || "No se pudieron cargar preguntas");
    }
  }

  async function loadTopicInfo() {
    if (!topicId) return;

    try {
      const r = await api<TopicInfo>(`/topics/${encodeURIComponent(topicId)}`);
      setTopicInfo(r);
    } catch {
      setTopicInfo(null);
    }
  }

  useEffect(() => {
    load();
    loadTopicInfo();
  }, [topicId, subjectId]);

  function validateCreate(): string | null {
    if (!subjectId) return "Falta subjectId (entrar desde Temas).";
    if (!topicId) return "Falta topicId.";
    if (!statement.trim()) return "Escribí el enunciado.";

    if (type === "MULTIPLE_CHOICE") {
      if (!options || options.length < 2) return "Multiple choice requiere al menos 2 opciones.";
      if (correctIndex < 0 || correctIndex >= options.length) return "correctIndex inválido para las opciones.";
    }

    if (type === "TRUE_FALSE") {
      if (correctIndex !== 0 && correctIndex !== 1)
        return "En True/False, correctIndex debe ser 0 (Verdadero) o 1 (Falso).";
    }

    return null;
  }

  async function createQuestion() {
    setError("");

    const err = validateCreate();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        subjectId,
        topicId,
        type,
        difficulty,
        statement: statement.trim(),
        modelAnswer: modelAnswer.trim() ? modelAnswer.trim() : null,
      };

      if (type === "MULTIPLE_CHOICE") {
        payload.options = options;
        payload.correctIndex = correctIndex;
      }

      if (type === "TRUE_FALSE") {
        payload.correctIndex = correctIndex; // 0 = Verdadero, 1 = Falso
      }

      await api("/questions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setStatement("");
      setModelAnswer("");
      setCorrectIndex(0);

      if (type === "MULTIPLE_CHOICE") setOptionsText("Opción A\nOpción B\nOpción C\nOpción D");

      await load();

      // UX: después de crear, volvemos al resumen
      setView("summary");
    } catch (e: any) {
      setError(e.message || "Error creando pregunta");
    } finally {
      setLoading(false);
    }
  }

  // stats (resumen)
  const stats = useMemo(() => {
    const byType: Record<QType, number> = {
      MULTIPLE_CHOICE: 0,
      TRUE_FALSE: 0,
      OPEN: 0,
    };
    const byDifficulty: Record<Difficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    for (const q of questions) {
      byType[q.type] += 1;
      byDifficulty[q.difficulty] += 1;
    }

    return { total: questions.length, byType, byDifficulty };
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    return questions.filter((q) => {
      if (filterType !== "ALL" && q.type !== filterType) return false;
      if (filterDifficulty !== "ALL" && q.difficulty !== filterDifficulty) return false;
      if (text && !q.statement.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [questions, filterType, filterDifficulty, searchText]);

  function goCreate() {
    setError("");
    setView("create");
  }

  function goList() {
    setError("");
    setView("list");
  }

  function goSummary() {
    setError("");
    setView("summary");
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <a href="/subjects">← Volver a materias</a>
      </div>

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Preguntas del tema</h1>

      <div style={{ marginBottom: 14, opacity: 0.85 }}>
        <div>
          Materia: <b>{topicInfo?.subject?.name ?? "—"}</b>
        </div>
        <div>
          Tema: <b>{topicInfo?.name ?? "—"}</b>
        </div>
      </div>

      {error && (
        <div style={{ border: "1px solid red", padding: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* barra de acciones */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <button onClick={goSummary} disabled={view === "summary"} style={{ padding: "8px 12px" }}>
          Resumen
        </button>
        <button onClick={goCreate} disabled={view === "create"} style={{ padding: "8px 12px" }}>
          ➕ Añadir pregunta
        </button>
        <button onClick={goList} disabled={view === "list"} style={{ padding: "8px 12px" }}>
          📋 Ver listado
        </button>

        <div style={{ marginLeft: "auto", fontSize: 13, opacity: 0.85 }}>
          Total: <b>{stats.total}</b>
        </div>
      </div>

      {/* ✅ VISTA: RESUMEN */}
      {view === "summary" && (
        <div style={{ border: "1px solid #333", padding: 12, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Tenés <b>{stats.total}</b> preguntas en este tema
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #ccc", padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Por tipo</div>
              <div>
                Multiple choice: <b>{stats.byType.MULTIPLE_CHOICE}</b>
              </div>
              <div>
                True/False: <b>{stats.byType.TRUE_FALSE}</b>
              </div>
              <div>
                Open: <b>{stats.byType.OPEN}</b>
              </div>
            </div>

            <div style={{ border: "1px solid #ccc", padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Por dificultad</div>
              <div>
                easy: <b>{stats.byDifficulty.easy}</b>
              </div>
              <div>
                medium: <b>{stats.byDifficulty.medium}</b>
              </div>
              <div>
                hard: <b>{stats.byDifficulty.hard}</b>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
            Tip: el botón “Añadir pregunta” te abre el formulario. “Ver listado” te deja filtrar y buscar.
          </div>
        </div>
      )}

      {/* ✅ VISTA: CREAR */}
      {view === "create" && (
        <div style={{ border: "1px solid #333", padding: 12, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Añadir pregunta</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              Tipo
              <select
                value={type}
                onChange={(e) => {
                  const next = e.target.value as QType;
                  setType(next);
                  setCorrectIndex(0);

                  if (next === "MULTIPLE_CHOICE") setOptionsText("Opción A\nOpción B\nOpción C\nOpción D");
                  if (next === "TRUE_FALSE") setOptionsText("");
                  if (next === "OPEN") setOptionsText("");
                }}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="MULTIPLE_CHOICE">Multiple choice</option>
                <option value="TRUE_FALSE">True/False</option>
                <option value="OPEN">Open</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Dificultad
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            Enunciado
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              style={{ width: "100%", padding: 8, minHeight: 80 }}
            />
          </label>

          {type === "MULTIPLE_CHOICE" && (
            <>
              <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                Opciones (una por línea)
                <textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  style={{ width: "100%", padding: 8, minHeight: 90 }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                Índice correcto (0 a {Math.max(0, (options?.length ?? 0) - 1)})
                <input
                  type="number"
                  value={correctIndex}
                  onChange={(e) => setCorrectIndex(Number(e.target.value))}
                  min={0}
                  style={{ padding: 8 }}
                />
              </label>
            </>
          )}

          {type === "TRUE_FALSE" && (
            <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>Respuesta correcta</div>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="radio" checked={correctIndex === 0} onChange={() => setCorrectIndex(0)} />
                Verdadero
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="radio" checked={correctIndex === 1} onChange={() => setCorrectIndex(1)} />
                Falso
              </label>
            </div>
          )}

          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            Respuesta modelo (opcional)
            <textarea
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
              style={{ width: "100%", padding: 8, minHeight: 70 }}
            />
          </label>

          <button onClick={createQuestion} disabled={loading} style={{ padding: "10px 14px" }}>
            {loading ? "Creando..." : "Crear"}
          </button>
        </div>
      )}

      {/* ✅ VISTA: LISTADO */}
      {view === "list" && (
        <>
          <div style={{ border: "1px solid #333", padding: 12, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Listado de preguntas</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                Tipo
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="ALL">Todos</option>
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                  <option value="TRUE_FALSE">True/False</option>
                  <option value="OPEN">Open</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Dificultad
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value as any)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="ALL">Todas</option>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Buscar enunciado
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Ej: músculos, capital, fracciones..."
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
              Mostrando <b>{filteredQuestions.length}</b> de <b>{questions.length}</b>
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div>No hay preguntas con esos filtros.</div>
          ) : (
            <ol style={{ display: "grid", gap: 12, paddingLeft: 18, margin: 0 }}>
              {filteredQuestions.map((q) => (
                <li key={q.id} style={{ border: "1px solid #333", padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{q.statement}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                    {labelType(q.type)} · {labelDifficulty(q.difficulty)}
                  </div>

                  {q.options?.length ? (
                    <ul style={{ paddingLeft: 18, margin: 0, display: "grid", gap: 4 }}>
                      {q.options.map((opt, idx) => (
                        <li key={`${q.id}-${idx}`}>{opt}</li>
                      ))}
                    </ul>
                  ) : null}

                  {q.type === "TRUE_FALSE" && typeof q.correctIndex === "number" ? (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                      <b>Respuesta correcta:</b> {q.correctIndex === 0 ? "Verdadero" : "Falso"}
                    </div>
                  ) : null}

                  {q.type === "MULTIPLE_CHOICE" && typeof q.correctIndex === "number" ? (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                      <b>Opción correcta:</b> {q.correctIndex + 1}
                    </div>
                  ) : null}

                  {q.modelAnswer ? (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                      <b>Modelo:</b> {q.modelAnswer}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}