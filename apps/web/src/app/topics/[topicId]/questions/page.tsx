"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ConfirmModal from "@/components/ConfirmModal";

type Difficulty = "easy" | "medium" | "hard";
type QType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_TRUE_FALSE" | "OPEN" | "FILL_IN";

type MultiTfOption = {
  statement: string;
  isCorrect: boolean;
  requiresJustification: boolean;
  openLines: number;
};

type Question = {
  id: string;
  type: QType;
  difficulty: Difficulty;
  statement: string;
  options?: Array<string | MultiTfOption> | null;
  correctIndex?: number | null;
  modelAnswer?: string | null;
  openLines?: number | null;
  requiresJustification?: boolean;
  createdAt?: string | null;
  createdBy?: { id: string; name: string; lastName: string } | null;
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
  tone?: "neutral" | "blue" | "green" | "gray" | "red";
}) {
  const cls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : tone === "green"
        ? "border-green-200 bg-green-50 text-green-700"
        : tone === "gray"
          ? "border-gray-200 bg-gray-50 text-gray-700"
          : tone === "red"
            ? "border-red-200 bg-red-50 text-red-700"
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

function labelType(t: QType | 'MULTI_TRUE_FALSE') {
  if (t === "MULTIPLE_CHOICE") return "Opción múltiple";
  if (t === "TRUE_FALSE") return "Verdadero / Falso (único)";
  if (t === "MULTI_TRUE_FALSE") return "Múltiple Verdadero / Falso";
  if (t === "FILL_IN") return "Completar";
  return "A desarrollar";
}

function labelDifficulty(d: Difficulty) {
  if (d === "easy") return "Fácil";
  if (d === "medium") return "Medio";
  return "Difícil";
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

function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso);
  }
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


function SelectPretty({
  value,
  onChange,
  disabled,
  className,
  children,
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative", disabled && "opacity-60", className)}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="h-9 w-full appearance-none rounded-md border border-gray-300 bg-white px-3 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        {children}
      </select>

      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="text-gray-500"
          aria-hidden="true"
        >
          <path d="M5.5 7.5a1 1 0 0 1 1.6-.8L10 9.1l2.9-2.4a1 1 0 1 1 1.2 1.6l-3.5 2.9a1 1 0 0 1-1.2 0l-3.5-2.9a1 1 0 0 1-.4-.8z" />
        </svg>
      </div>
    </div>
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
  const [type, setType] = useState<QType | "">("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [optionsText, setOptionsText] = useState(
    "Opción A\nOpción B\nOpción C\nOpción D"
  );
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [modelAnswer, setModelAnswer] = useState("");
  const [openLines, setOpenLines] = useState<number>(4);
  const [requiresJustification, setRequiresJustification] = useState<boolean>(false);

  // Estados para MULTI_TRUE_FALSE
  const [multiTfOptions, setMultiTfOptions] = useState<Array<{
    statement: string;
    isCorrect: boolean;
    requiresJustification: boolean;
    openLines: number;
  }>>([{ statement: "", isCorrect: true, requiresJustification: false, openLines: 4 }]);

  // Selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetTopicId, setTargetTopicId] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [topicsInSubject, setTopicsInSubject] = useState<TopicInfo[]>([]);

  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    question: Question | null;
  }>({ isOpen: false, question: null });

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTimers = useRef<Record<string, number[]>>({});

  const options = useMemo(() => {
    if (type === "TRUE_FALSE") return ["Verdadero", "Falso"];
    if (type === "OPEN") return null;
    if (type === "FILL_IN") return null;

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
        await Promise.all([load(), loadTopicInfo(), loadTopicsInSubject()]);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, subjectId]);

  async function loadTopicsInSubject() {
    if (!subjectId) return;
    try {
      const r = await api<TopicInfo[]>(`/topics/subject/${subjectId}`);
      setTopicsInSubject(r.filter(t => t.id !== topicId));
    } catch {
      setTopicsInSubject([]);
    }
  }

  function handlePaste(e: React.ClipboardEvent, setter: (val: string) => void, currentVal: string) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    // Insertar en la posición del cursor si fuera posible, pero para simplificar concatenamos o reemplazamos
    // Aquí implementamos reemplazo simple por ahora para asegurar limpieza de formato
    setter(text);
  }

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

  function loadForEdit(question: Question) {
    // Seteamos todos los campos
    setStatement(question.statement);
    setType(question.type);
    setDifficulty(question.difficulty);
    setModelAnswer(question.modelAnswer ?? "");
    setOpenLines(question.openLines ?? 4);
    setRequiresJustification(question.requiresJustification ?? false);

    if (question.type === "MULTIPLE_CHOICE") {
      setOptionsText((question.options as string[])?.join("\n") ?? "");
      setCorrectIndex(question.correctIndex ?? 0);
    } else if (question.type === "TRUE_FALSE") {
      setCorrectIndex(question.correctIndex ?? 0);
      setOptionsText("");
    } else if (question.type === "MULTI_TRUE_FALSE") {
      setMultiTfOptions((question.options as MultiTfOption[]) || [{ statement: "", isCorrect: true, requiresJustification: false, openLines: 4 }]);
      setOptionsText("");
      setCorrectIndex(0);
    } else {
      // OPEN / FILL_IN
      setOptionsText("");
      setCorrectIndex(0);
    }

    setEditingQuestionId(question.id);
    setView("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateCreate(): string | null {
    if (!subjectId) return "Falta subjectId (entrar desde Temas).";
    if (!topicId) return "Falta topicId.";
    if (!type) return "Seleccioná el tipo de pregunta.";
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
        payload.requiresJustification = requiresJustification;
      }

      if (type === ("MULTI_TRUE_FALSE" as any)) {
        payload.options = multiTfOptions;
      }

      if (type === "OPEN") {
        payload.openLines = openLines;
      }

      if (editingQuestionId) {
        // UPDATE
        await api(`/questions/${editingQuestionId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        // CREATE
        await api("/questions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setStatement("");
      setModelAnswer("");
      setCorrectIndex(0);
      setOpenLines(4);
      setRequiresJustification(false);
      setEditingQuestionId(null); // Limpiar
      setType(""); // Reset to empty for step-by-step

      if (type === "MULTIPLE_CHOICE")
        setOptionsText("Opción A\nOpción B\nOpción C\nOpción D");

      setMultiTfOptions([{ statement: "", isCorrect: true, requiresJustification: false, openLines: 4 }]);

      await load();
      toast.success(editingQuestionId ? "✨ ¡Pregunta actualizada con éxito! ✨" : "🚀 ¡Pregunta añadida correctamente! Seguí sumando más. 🦾");
      setView("create");
    } catch (e: any) {
      setError(e?.message || "Error guardando pregunta");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmDelete() {
    const q = confirmDelete.question;
    if (!q) return;

    setLoading(true);
    setConfirmDelete({ isOpen: false, question: null });

    try {
      await api(`/questions/${q.id}`, { method: "DELETE" });
      toast.success("Pregunta archivada correctamente");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Error al archivar la pregunta");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const byType: Record<QType, number> = {
      MULTIPLE_CHOICE: 0,
      TRUE_FALSE: 0,
      MULTI_TRUE_FALSE: 0,
      OPEN: 0,
      FILL_IN: 0,
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

  const canCreate = !!type && statement.trim().length > 0 && !loading;

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

  function toggleSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
    }
  }

  async function bulkMove() {
    if (selectedIds.size === 0 || !targetTopicId || isMoving) return;
    setIsMoving(true);
    try {
      await api("/questions/bulk-move", {
        method: "PATCH",
        body: JSON.stringify({
          questionIds: Array.from(selectedIds),
          targetTopicId
        })
      });
      toast.success(`${selectedIds.size} preguntas movidas correctamente`);
      setSelectedIds(new Set());
      setTargetTopicId("");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Error al mover preguntas");
    } finally {
      setIsMoving(false);
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <a
            href={subjectId ? `/subjects/${subjectId}/topics` : "/subjects"}
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            ← Volver a temas
          </a>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
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
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setError("");
                setView("summary");
              }}
              className={cn(
                "h-10 rounded-xl px-5 text-sm font-bold transition focus:outline-none shadow-sm",
                view === "summary"
                  ? "bg-gray-200 text-gray-800"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              Resumen
            </button>

            <button
              type="button"
              onClick={() => {
                setError("");
                setView("create");
              }}
              className={cn(
                "h-10 rounded-xl px-5 text-sm font-bold transition focus:outline-none shadow-sm",
                view === "create"
                  ? "bg-gray-200 text-gray-800"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              {editingQuestionId ? "Editar pregunta" : "Añadir pregunta"}
            </button>

            <button
              type="button"
              onClick={() => {
                setError("");
                setView("list");
              }}
              className={cn(
                "h-10 rounded-xl px-5 text-sm font-bold transition focus:outline-none shadow-sm",
                view === "list"
                  ? "bg-gray-200 text-gray-800"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              Ver listado
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
                  <span>Opción múltiple</span>
                  <Badge tone="gray">{stats.byType.MULTIPLE_CHOICE}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>V / F (único)</span>
                  <Badge tone="gray">{stats.byType.TRUE_FALSE}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Múltiple V / F</span>
                  <Badge tone="gray">{stats.byType.MULTI_TRUE_FALSE}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>A desarrollar</span>
                  <Badge tone="gray">{stats.byType.OPEN}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Completar</span>
                  <Badge tone="gray">{stats.byType.FILL_IN}</Badge>
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
              {editingQuestionId ? "Editar pregunta" : "Añadir pregunta"}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-900">Tipo</span>
              <SelectPretty
                value={type}
                onChange={(e) => {
                  const next = e.target.value as QType;
                  setType(next);
                  setCorrectIndex(0);

                  if (next === "MULTIPLE_CHOICE")
                    setOptionsText("Opción A\nOpción B\nOpción C\nOpción D");
                  if (next === "TRUE_FALSE") setOptionsText("");
                  if (next === "MULTI_TRUE_FALSE") setOptionsText("");
                  if (next === "OPEN") setOptionsText("");
                  if (next === "FILL_IN") { setOptionsText(""); setRequiresJustification(false); }
                }}
              >
                <option value="" disabled>Seleccionar tipo...</option>
                <option value="MULTIPLE_CHOICE">Opción múltiple</option>
                <option value="TRUE_FALSE">Verdadero / Falso (único)</option>
                <option value="MULTI_TRUE_FALSE">Múltiple Verdadero / Falso</option>
                <option value="OPEN">A desarrollar</option>
                <option value="FILL_IN">Completar</option>
              </SelectPretty>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Dificultad
              </span>
              <SelectPretty
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                <option value="easy">Fácil</option>
                <option value="medium">Medio</option>
                <option value="hard">Difícil</option>
              </SelectPretty>
            </label>
          </div>

          {type ? (
            <label className="mt-4 grid gap-2">
              <span className="text-sm font-semibold text-gray-900">Enunciado</span>
              <textarea
                value={statement}
                placeholder="Escribí el enunciado de la pregunta aquí..."
                onChange={(e) => setStatement(e.target.value)}
                className="min-h-[96px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          ) : null}

          {type && statement.trim() ? (
            <>
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

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="text-sm font-semibold text-gray-900">
                      Respuesta correcta
                    </div>
                    <div className="mt-3 grid gap-2">
                      {options && options.length > 0 ? (
                        options.map((opt, idx) => (
                          <label
                            key={idx}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition hover:bg-gray-50",
                              correctIndex === idx
                                ? "border-blue-200 bg-blue-50"
                                : "border-gray-200 bg-white"
                            )}
                          >
                            <input
                              type="radio"
                              name="correctIndex"
                              checked={correctIndex === idx}
                              onChange={() => setCorrectIndex(idx)}
                              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                              <span className="font-semibold text-gray-900 mr-1">
                                {String.fromCharCode(65 + idx)})
                              </span>
                              {opt}
                            </span>
                          </label>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          Escribí las opciones arriba para poder seleccionar la correcta acá.
                        </div>
                      )}
                    </div>
                  </div>
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

                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={requiresJustification}
                        onChange={(e) => setRequiresJustification(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        Requiere justificación escrita
                      </span>
                    </label>

                    {requiresJustification ? (
                      <div className="mt-3">
                        <label className="grid gap-2">
                          <span className="text-sm text-gray-700">
                            Renglones para la justificación
                          </span>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={openLines}
                              onChange={(e) =>
                                setOpenLines(Math.max(1, Math.min(50, Number(e.target.value))))
                              }
                              className="w-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                            <span className="text-sm text-gray-500">renglones (default: 4)</span>
                          </div>
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {type === ("MULTI_TRUE_FALSE" as any) ? (
                <div className="mt-4 space-y-4">
                  <div className="text-sm font-semibold text-gray-900">Enunciados Verdadero / Falso</div>
                  {multiTfOptions.map((opt, idx) => (
                    <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-600 uppercase">Item #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setMultiTfOptions(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Eliminar item
                        </button>
                      </div>
                      <textarea
                        placeholder="Escribí el sub-enunciado aquí..."
                        value={opt.statement}
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = e.clipboardData.getData("text/plain");
                          const next = [...multiTfOptions];
                          next[idx].statement = text;
                          setMultiTfOptions(next);
                        }}
                        onChange={(e) => {
                          const next = [...multiTfOptions];
                          next[idx].statement = e.target.value;
                          setMultiTfOptions(next);
                        }}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            checked={opt.isCorrect}
                            onChange={() => {
                              const next = [...multiTfOptions];
                              next[idx].isCorrect = true;
                              setMultiTfOptions(next);
                            }}
                          /> Verdadero
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            checked={!opt.isCorrect}
                            onChange={() => {
                              const next = [...multiTfOptions];
                              next[idx].isCorrect = false;
                              setMultiTfOptions(next);
                            }}
                          /> Falso
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer ml-auto">
                          <input
                            type="checkbox"
                            checked={opt.requiresJustification}
                            onChange={(e) => {
                              const next = [...multiTfOptions];
                              next[idx].requiresJustification = e.target.checked;
                              setMultiTfOptions(next);
                            }}
                          /> Requiere justificación
                        </label>
                      </div>
                      {opt.requiresJustification && (
                        <div className="mt-2 flex items-center gap-3 border-t border-gray-50 pt-2">
                          <span className="text-xs font-medium text-gray-500">Renglones para justificación:</span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={opt.openLines}
                            onChange={(e) => {
                              const next = [...multiTfOptions];
                              next[idx].openLines = Math.max(1, Math.min(50, Number(e.target.value)));
                              setMultiTfOptions(next);
                            }}
                            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMultiTfOptions(prev => [...prev, { statement: "", isCorrect: true, requiresJustification: false, openLines: 4 }])}
                    className="w-full rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-500 hover:border-blue-200 hover:text-blue-600 transition-colors"
                  >
                    + Añadir otro enunciado V/F
                  </button>
                </div>
              ) : null}

              {type === "OPEN" ? (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-900">
                    Espacio para la respuesta
                  </div>
                  <div className="mt-3">
                    <label className="grid gap-2">
                      <span className="text-sm text-gray-700">
                        Cantidad de renglones en el examen impreso
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={openLines}
                          onChange={(e) =>
                            setOpenLines(Math.max(1, Math.min(50, Number(e.target.value))))
                          }
                          className="w-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                        <span className="text-sm text-gray-500">renglones (default: 4)</span>
                      </div>
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
                  {loading ? "Guardando..." : editingQuestionId ? "Guardar cambios" : "Crear"}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setEditingQuestionId(null);
                    setView("summary");
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setError("");
                  setEditingQuestionId(null);
                  setView("summary");
                }}
                className="inline-flex h-10 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          )}
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
                <SelectPretty
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                >
                  <option value="ALL">Todos</option>
                  <option value="MULTIPLE_CHOICE">Opción múltiple</option>
                  <option value="TRUE_FALSE">Verdadero / Falso (único)</option>
                  <option value="MULTI_TRUE_FALSE">Múltiple Verdadero / Falso</option>
                  <option value="OPEN">A desarrollar</option>
                  <option value="FILL_IN">Completar</option>
                </SelectPretty>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Dificultad
                </span>
                <SelectPretty
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value as any)}
                >
                  <option value="ALL">Todas</option>
                  <option value="easy">Fácil</option>
                  <option value="medium">Medio</option>
                  <option value="hard">Difícil</option>
                </SelectPretty>
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

            {selectedIds.size > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">
                  {selectedIds.size} seleccionadas
                </div>
                <div className="h-4 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Mover a:</span>
                  <SelectPretty
                    value={targetTopicId}
                    onChange={(e) => setTargetTopicId(e.target.value)}
                    className="min-w-[180px]"
                  >
                    <option value="">Seleccionar tema...</option>
                    {topicsInSubject.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </SelectPretty>
                  <button
                    onClick={bulkMove}
                    disabled={!targetTopicId || isMoving}
                    className="h-9 rounded-md bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isMoving ? "Moviendo..." : "Mover ahora"}
                  </button>
                </div>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Deseleccionar todas
                </button>
              </div>
            )}
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
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(q.id)}
                                onChange={() => toggleSelection(q.id)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="text-sm text-gray-500">#{idx + 1}</div>
                            </div>

                            <div className="mt-1 text-sm font-semibold text-gray-900">
                              {highlight(q.statement, searchText)}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge tone="gray">{labelType(q.type)}</Badge>
                              <Badge tone="gray">
                                {labelDifficulty(q.difficulty)}
                              </Badge>
                              {q.createdAt && (
                                <Badge tone="gray">{formatDate(q.createdAt)}</Badge>
                              )}
                              {q.createdBy && (
                                <Badge tone="blue">
                                  Por: {q.createdBy.name} {q.createdBy.lastName}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadForEdit(q);
                              }}
                              className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete({ isOpen: true, question: q });
                              }}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-100 bg-white p-0 text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>

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
                                      const isString = typeof opt === "string";
                                      const statement = isString ? opt : (opt as any).statement;
                                      const isCorrect = isString
                                        ? typeof q.correctIndex === "number" && q.correctIndex === oIdx
                                        : (opt as any).isCorrect;

                                      return (
                                        <li
                                          key={`${q.id}-${oIdx}`}
                                          className={cn(
                                            "flex items-start gap-2 rounded-md border px-3 py-2 transition hover:bg-gray-50",
                                            isCorrect
                                              ? "border-green-200 bg-green-50"
                                              : "border-gray-200 bg-white"
                                          )}
                                        >
                                          <span className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[10px] font-bold text-blue-700 shadow-sm border-blue-200">
                                            {oIdx + 1}
                                          </span>
                                          <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-800">
                                              {statement}
                                            </div>
                                            {!isString && (opt as MultiTfOption).requiresJustification && (
                                              <div className="mt-1">
                                                <Badge tone="gray">Justificación: {(opt as MultiTfOption).openLines} renglones</Badge>
                                              </div>
                                            )}
                                          </div>
                                          {isString && isCorrect ? (
                                            <span className="ml-auto shrink-0">
                                              <Badge tone="green">Correcta</Badge>
                                            </span>
                                          ) : null}
                                          {!isString && (
                                            <span className="ml-auto shrink-0">
                                              <Badge tone={isCorrect ? "green" : "red"}>
                                                {isCorrect ? "Verdadero" : "Falso"}
                                              </Badge>
                                            </span>
                                          )}
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
                                  {q.requiresJustification ? (
                                    <span className="ml-2 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                                      Requiere justificación
                                    </span>
                                  ) : null}
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

                              {q.type === "OPEN" && q.openLines ? (
                                <div className="mt-4 text-sm text-gray-700">
                                  <span className="font-semibold text-gray-900">
                                    Renglones para respuesta:
                                  </span>{" "}
                                  {q.openLines}
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

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="¿Archivar pregunta?"
        message="Esta pregunta dejará de estar disponible para nuevos exámenes, pero seguirá apareciendo en los exámenes generados anteriormente."
        confirmLabel="Sí, archivar"
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, question: null })}
        tone="warning"
      />
    </div>
  );
}
