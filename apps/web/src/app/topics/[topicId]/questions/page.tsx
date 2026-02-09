"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "gray";
}) {
  const cls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : tone === "green"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "gray"
      ? "border-gray-200 bg-gray-50 text-gray-700"
      : "border-gray-200 bg-white text-gray-700";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        cls
      )}
    >
      {children}
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12px] text-gray-500">{children}</span>;
}

function highlight(text: string, q: string) {
  const query = q.trim();
  if (!query) return text;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;

  const a = text.slice(0, idx);
  const b = text.slice(idx, idx + query.length);
  const c = text.slice(idx + query.length);

  return (
    <>
      {a}
      <mark className="rounded bg-yellow-100 px-1 text-gray-900">{b}</mark>
      {c}
    </>
  );
}

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

function PillButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition disabled:opacity-60",
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn(
        "h-4 w-4 text-blue-700 transition-transform duration-200",
        open ? "rotate-180" : "rotate-0"
      )}
    >
      <path
        d="M5 8l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TopicQuestionsPage() {
  const params = useParams();
  const search = useSearchParams();

  const topicId = (params.topicId as string) || "";
  const subjectId = (search.get("subjectId") || "").trim();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [topicInfo, setTopicInfo] = useState<TopicInfo | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [view, setView] = useState<ViewMode>("summary");

  const [filterType, setFilterType] = useState<QType | "ALL">("ALL");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "ALL">(
    "ALL"
  );
  const [searchText, setSearchText] = useState("");

  const [statement, setStatement] = useState("");
  const [type, setType] = useState<QType>("TRUE_FALSE");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [optionsText, setOptionsText] = useState(
    "Opción A\nOpción B\nOpción C\nOpción D"
  );
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [modelAnswer, setModelAnswer] = useState("");

  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTimers = useRef<Record<string, number[]>>({});

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
      setError(
        "Falta subjectId en la URL. Volvé a Temas y entrá por el botón 'Gestionar preguntas'."
      );
      return;
    }

    try {
      const r = await api<ListResponse>(
        `/questions?subjectId=${encodeURIComponent(
          subjectId
        )}&topicId=${encodeURIComponent(topicId)}&limit=100&page=1`
      );
      setQuestions(r.data || []);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar preguntas");
      setQuestions([]);
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
    let cancelled = false;

    (async () => {
      setInitialLoading(true);
      try {
        await Promise.all([load(), loadTopicInfo()]);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, subjectId]);

  useEffect(() => {
    setOpenQuestionId(null);
  }, [view, filterType, filterDifficulty, searchText]);

  // Limpia timeouts si el componente se desmonta
  useEffect(() => {
    return () => {
      const map = scrollTimers.current;
      for (const key of Object.keys(map)) {
        for (const t of map[key]) window.clearTimeout(t);
      }
      scrollTimers.current = {};
    };
  }, []);

  function validateCreate(): string | null {
    if (!subjectId) return "Falta subjectId (entrar desde Temas).";
    if (!topicId) return "Falta topicId.";
    if (!statement.trim()) return "Escribí el enunciado.";

    if (type === "MULTIPLE_CHOICE") {
      if (!options || options.length < 2)
        return "Multiple choice requiere al menos 2 opciones.";
      if (correctIndex < 0 || correctIndex >= options.length)
        return "correctIndex inválido para las opciones.";
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
        payload.correctIndex = correctIndex;
      }

      await api("/questions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setStatement("");
      setModelAnswer("");
      setCorrectIndex(0);

      if (type === "MULTIPLE_CHOICE")
        setOptionsText("Opción A\nOpción B\nOpción C\nOpción D");

      await load();
      setView("summary");
    } catch (e: any) {
      setError(e?.message || "Error creando pregunta");
    } finally {
      setLoading(false);
    }
  }

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
      if (filterDifficulty !== "ALL" && q.difficulty !== filterDifficulty)
        return false;
      if (text && !q.statement.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [questions, filterType, filterDifficulty, searchText]);

  const canCreate = statement.trim().length > 0 && !loading;

  function ensureCardFullyVisible(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const topPadding = 12;
    const bottomPadding = 16;

    if (rect.top < topPadding) {
      window.scrollBy({
        top: rect.top - topPadding,
        behavior: "smooth",
      });
      return;
    }

    const overflowBottom = rect.bottom - (window.innerHeight - bottomPadding);
    if (overflowBottom > 0) {
      window.scrollBy({
        top: overflowBottom,
        behavior: "smooth",
      });
    }
  }

  function clearTimersFor(id: string) {
    const list = scrollTimers.current[id];
    if (!list?.length) return;
    for (const t of list) window.clearTimeout(t);
    scrollTimers.current[id] = [];
  }

  function toggleQuestion(id: string) {
    setOpenQuestionId((prev) => {
      const next = prev === id ? null : id;

      // cancelamos cualquier timer previo de ese item
      clearTimersFor(id);

      if (next) {
        requestAnimationFrame(() => {
          const el = questionRefs.current[id];
          if (!el) return;

          // 1) Traer la tarjeta al viewport (arriba)
          el.scrollIntoView({ behavior: "smooth", block: "start" });

          // 2) Cuando termina de abrir (duration-300), ajustar para que se vea completa
          const t = window.setTimeout(() => {
            const el2 = questionRefs.current[id];
            if (!el2) return;
            ensureCardFullyVisible(el2);
          }, 340);

          scrollTimers.current[id] = [t];
        });
      }

      return next;
    });
  }

  return (
    <main className="min-h-[calc(100vh-64px)] px-6 py-8">
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-50 via-white to-gray-100" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.10) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <a
              href={subjectId ? `/subjects/${subjectId}/topics` : "/subjects"}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              ← Volver a temas
            </a>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-blue-900">
              Preguntas del tema
            </h1>

            <div className="mt-1 text-sm text-gray-600">
              <div>
                Materia:{" "}
                <span className="font-semibold text-gray-900">
                  {topicInfo?.subject?.name ?? "—"}
                </span>
              </div>
              <div className="mt-0.5">
                Tema:{" "}
                <span className="font-semibold text-gray-900">
                  {topicInfo?.name ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="blue">{stats.total} total</Badge>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-full overflow-hidden rounded-xl border border-gray-200 bg-white sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setView("summary");
                }}
                className={cn(
                  "h-10 px-4 text-sm font-semibold transition focus:outline-none",
                  view === "summary"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                Resumen
              </button>

              <div className="w-px bg-gray-200" />

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setView("create");
                }}
                className={cn(
                  "h-10 px-4 text-sm font-semibold transition focus:outline-none",
                  view === "create"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                Añadir pregunta
              </button>

              <div className="w-px bg-gray-200" />

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setView("list");
                }}
                className={cn(
                  "h-10 px-4 text-sm font-semibold transition focus:outline-none",
                  view === "list"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                Ver listado de preguntas
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm text-gray-600">Total de Preguntas</span>
              <span className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-900">
                {stats.total}
              </span>
            </div>
          </div>
        </section>

        {initialLoading ? (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 px-6 py-8 shadow-sm">
            <div className="text-sm text-gray-600">Cargando…</div>
          </section>
        ) : null}

        {!initialLoading && view === "summary" ? (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-blue-600" />
              <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Resumen
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-700">
              Tenés{" "}
              <span className="font-semibold text-gray-900">{stats.total}</span>{" "}
              preguntas en este tema.
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Por tipo</div>
                <div className="mt-3 grid gap-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Multiple choice</span>
                    <Badge tone="gray">{stats.byType.MULTIPLE_CHOICE}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>True/False</span>
                    <Badge tone="gray">{stats.byType.TRUE_FALSE}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Open</span>
                    <Badge tone="gray">{stats.byType.OPEN}</Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">
                  Por dificultad
                </div>
                <div className="mt-3 grid gap-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>easy</span>
                    <Badge tone="gray">{stats.byDifficulty.easy}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>medium</span>
                    <Badge tone="gray">{stats.byDifficulty.medium}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>hard</span>
                    <Badge tone="gray">{stats.byDifficulty.hard}</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              Tip: “Añadir pregunta” abre el formulario. “Ver listado” te deja filtrar
              y buscar.
            </div>
          </section>
        ) : null}

        {!initialLoading && view === "create" ? (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-blue-600" />
              <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Añadir pregunta
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-gray-900">Tipo</span>
                <select
                  value={type}
                  onChange={(e) => {
                    const next = e.target.value as QType;
                    setType(next);
                    setCorrectIndex(0);

                    if (next === "MULTIPLE_CHOICE")
                      setOptionsText("Opción A\nOpción B\nOpción C\nOpción D");
                    if (next === "TRUE_FALSE") setOptionsText("");
                    if (next === "OPEN") setOptionsText("");
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                  <option value="TRUE_FALSE">True/False</option>
                  <option value="OPEN">Open</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Dificultad
                </span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </label>
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-sm font-semibold text-gray-900">Enunciado</span>
              <textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                className="min-h-[96px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            {type === "MULTIPLE_CHOICE" ? (
              <>
                <label className="mt-4 grid gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Opciones (una por línea)
                  </span>
                  <textarea
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    className="min-h-[110px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>

                <label className="mt-4 grid gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Índice correcto (0 a {Math.max(0, (options?.length ?? 0) - 1)})
                  </span>
                  <input
                    type="number"
                    value={correctIndex}
                    onChange={(e) => setCorrectIndex(Number(e.target.value))}
                    min={0}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
              </>
            ) : null}

            {type === "TRUE_FALSE" ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">
                  Respuesta correcta
                </div>

                <div className="mt-3 grid gap-2 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={correctIndex === 0}
                      onChange={() => setCorrectIndex(0)}
                    />
                    Verdadero
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={correctIndex === 1}
                      onChange={() => setCorrectIndex(1)}
                    />
                    Falso
                  </label>
                </div>
              </div>
            ) : null}

            <label className="mt-4 grid gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Respuesta modelo (opcional)
              </span>
              <textarea
                value={modelAnswer}
                onChange={(e) => setModelAnswer(e.target.value)}
                className="min-h-[88px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createQuestion}
                disabled={!canCreate || loading}
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Creando..." : "Crear"}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setError("");
                  setView("summary");
                }}
                className="inline-flex h-10 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </section>
        ) : null}

        {!initialLoading && view === "list" ? (
          <>
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-blue-600" />
                <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  Listado de preguntas
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-gray-900">Tipo</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ALL">Todos</option>
                    <option value="MULTIPLE_CHOICE">Multiple choice</option>
                    <option value="TRUE_FALSE">True/False</option>
                    <option value="OPEN">Open</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Dificultad
                  </span>
                  <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value as any)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ALL">Todas</option>
                    <option value="easy">easy</option>
                    <option value="medium">medium</option>
                    <option value="hard">hard</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Buscar enunciado
                  </span>
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Ej: músculos, capital, fracciones..."
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
              </div>

              <div className="mt-4 text-sm text-gray-600">
                Mostrando{" "}
                <span className="font-semibold text-gray-900">
                  {filteredQuestions.length}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-gray-900">
                  {questions.length}
                </span>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
              {filteredQuestions.length === 0 ? (
                <div className="px-6 py-8 text-sm text-gray-600">
                  No hay preguntas con esos filtros.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredQuestions.map((q, idx) => {
                    const open = openQuestionId === q.id;

                    return (
                      <div
                        key={q.id}
                        ref={(el) => {
                          questionRefs.current[q.id] = el;
                        }}
                        className="px-6 py-5"
                      >
                        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm text-gray-500">#{idx + 1}</div>

                              <div className="mt-1 text-sm font-semibold text-gray-900">
                                {highlight(q.statement, searchText)}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge tone="gray">{labelType(q.type)}</Badge>
                                <Badge tone="gray">
                                  {labelDifficulty(q.difficulty)}
                                </Badge>
                                <span className="ml-1"></span>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleQuestion(q.id)}
                                aria-expanded={open}
                                className={cn(
                                  "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition",
                                  open
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                                )}
                              >
                                <span>{open ? "Menos" : "Más"}</span>
                                <Chevron open={open} />
                              </button>
                            </div>
                          </div>

                          <div
                            className={cn(
                              "grid overflow-hidden border-t border-gray-100 transition-[grid-template-rows] duration-300 ease-out",
                              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                            )}
                          >
                            <div className="min-h-0">
                              <div
                                className={cn(
                                  "px-5 py-4 transition-all duration-200",
                                  open
                                    ? "opacity-100 translate-y-0"
                                    : "opacity-0 -translate-y-1"
                                )}
                              >
                                {q.options?.length ? (
                                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="text-sm font-semibold text-gray-900">
                                      Opciones
                                    </div>
                                    <ul className="mt-2 grid gap-2 text-sm text-gray-700">
                                      {q.options.map((opt, oIdx) => {
                                        const isCorrect =
                                          typeof q.correctIndex === "number" &&
                                          q.correctIndex === oIdx;

                                        return (
                                          <li
                                            key={`${q.id}-${oIdx}`}
                                            className={cn(
                                              "flex items-start gap-2 rounded-md border px-3 py-2",
                                              isCorrect
                                                ? "border-green-200 bg-green-50"
                                                : "border-gray-200 bg-white"
                                            )}
                                          >
                                            <span className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-xs text-gray-600">
                                              {oIdx + 1}
                                            </span>
                                            <span className="text-sm text-gray-800">
                                              {opt}
                                            </span>
                                            {isCorrect ? (
                                              <span className="ml-auto">
                                                <Badge tone="green">Correcta</Badge>
                                              </span>
                                            ) : null}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                ) : null}

                                {q.type === "TRUE_FALSE" &&
                                typeof q.correctIndex === "number" ? (
                                  <div className="mt-4 text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">
                                      Respuesta correcta:
                                    </span>{" "}
                                    {q.correctIndex === 0 ? "Verdadero" : "Falso"}
                                  </div>
                                ) : null}

                                {q.type === "MULTIPLE_CHOICE" &&
                                typeof q.correctIndex === "number" ? (
                                  <div className="mt-4 text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">
                                      Opción correcta:
                                    </span>{" "}
                                    {q.correctIndex + 1}
                                  </div>
                                ) : null}

                                {q.modelAnswer ? (
                                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="text-sm font-semibold text-gray-900">
                                      Respuesta modelo
                                    </div>
                                    <div className="mt-2 text-sm text-gray-700">
                                      {q.modelAnswer}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}