"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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

function Pill({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "blue";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium",
        tone === "blue"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-gray-50 text-gray-700"
      )}
    >
      {children}
    </span>
  );
}

function ExamiaMark() {
  return (
    <div className="select-none text-right">
      <div
        className="text-xl font-semibold tracking-tight text-blue-600"
        style={{
          fontFamily:
            "'Montserrat Alternates','Inter','Helvetica Neue',Arial,sans-serif",
        }}
      >
        examia
      </div>
      <div className="mt-0.5 text-xs text-gray-500">Exámenes</div>
    </div>
  );
}

function SelectPretty({
  value,
  onChange,
  disabled,
  size = "md",
  className,
  children,
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  size?: "md" | "sm";
  className?: string;
  children: React.ReactNode;
}) {
  const height = size === "sm" ? "h-9" : "h-10";

  return (
    <div className={cn("relative", disabled && "opacity-60", className)}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          height,
          "w-full appearance-none rounded-md border border-gray-300 bg-white px-3 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        )}
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

function Pagination({
  page,
  totalPages,
  onPage,
  pageSize,
  onPageSize,
  totalItems,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  totalItems: number;
}) {
  // si no hay paginación, no mostramos nada
  if (totalPages <= 1) return null;

  const clamped = Math.max(1, Math.min(page, totalPages));
  const from = (clamped - 1) * pageSize + 1;
  const to = Math.min(clamped * pageSize, totalItems);

  const pages: number[] = [];
  const windowSize = 2;
  const start = Math.max(1, clamped - windowSize);
  const end = Math.min(totalPages, clamped + windowSize);

  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 shadow-sm">
      <div className="text-sm text-gray-600">
        Mostrando <span className="font-medium text-gray-900">{from}</span>–
        <span className="font-medium text-gray-900">{to}</span> de{" "}
        <span className="font-medium text-gray-900">{totalItems}</span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <span className="text-xs font-medium text-gray-500">Por página</span>
          <div className="w-[92px]">
            <SelectPretty
              size="sm"
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
            >
              {[6, 9, 12, 18, 24].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectPretty>
          </div>
        </label>

        <button
          type="button"
          onClick={() => onPage(clamped - 1)}
          disabled={clamped <= 1}
          className={cn(
            "inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50",
            clamped <= 1 && "opacity-50"
          )}
        >
          ← Prev
        </button>

        {start > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPage(1)}
              className={cn(
                "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium",
                clamped === 1
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              )}
            >
              1
            </button>
            {start > 2 ? <span className="px-1 text-gray-400">…</span> : null}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className={cn(
              "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium",
              clamped === p
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
            )}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 ? (
              <span className="px-1 text-gray-400">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPage(totalPages)}
              className={cn(
                "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium",
                clamped === totalPages
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              )}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onPage(clamped + 1)}
          disabled={clamped >= totalPages}
          className={cn(
            "inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50",
            clamped >= totalPages && "opacity-50"
          )}
        >
          Next →
        </button>
      </div>
    </div>
  );
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    setPage(1);
    setOpenExamId(null);
    setOpenExamQuestions([]);
  }, [dq, subjectId, topicId, sort]);

  const examRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTimers = useRef<Record<string, number[]>>({});

  function ensureCardFullyVisible(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const topPadding = 12;
    const bottomPadding = 16;

    if (rect.top < topPadding) {
      window.scrollBy({ top: rect.top - topPadding, behavior: "smooth" });
      return;
    }

    const overflowBottom = rect.bottom - (window.innerHeight - bottomPadding);
    if (overflowBottom > 0) {
      window.scrollBy({ top: overflowBottom, behavior: "smooth" });
    }
  }

  function clearTimersFor(id: string) {
    const list = scrollTimers.current[id];
    if (!list?.length) return;
    for (const t of list) window.clearTimeout(t);
    scrollTimers.current[id] = [];
  }

  function scrollToExam(id: string) {
    clearTimersFor(id);

    requestAnimationFrame(() => {
      const el = examRefs.current[id];
      if (!el) return;

      el.scrollIntoView({ behavior: "smooth", block: "start" });

      const t = window.setTimeout(() => {
        const el2 = examRefs.current[id];
        if (!el2) return;
        ensureCardFullyVisible(el2);
      }, 340);

      scrollTimers.current[id] = [t];
    });
  }

  useEffect(() => {
    return () => {
      const map = scrollTimers.current;
      for (const key of Object.keys(map)) {
        for (const t of map[key]) window.clearTimeout(t);
      }
      scrollTimers.current = {};
    };
  }, []);

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

      scrollToExam(exam.id);
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
      list.sort((a, b) =>
        String(a.title ?? "").localeCompare(String(b.title ?? ""))
      );
    } else {
      const dir = sort === "newest" ? -1 : 1;
      list.sort(
        (a, b) =>
          (new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime()) *
          dir
      );
    }

    return list;
  }, [exams, subjectId, topicId, dq, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.max(1, Math.min(page, totalPages));

  useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, pageSize, filtered.length]);

  const paged = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, clampedPage, pageSize]);

  useEffect(() => {
    if (!openExamId) return;
    const existsInPage = paged.some((e) => e.id === openExamId);
    if (!existsInPage) {
      setOpenExamId(null);
      setOpenExamQuestions([]);
    }
  }, [paged, openExamId]);

  const openFilteredQuestions = useMemo(() => {
    const needle = dOpenQ.trim();
    if (!needle) return openExamQuestions;
    return openExamQuestions.filter((qq) =>
      contains(`${qq.statement ?? ""} ${qq.id}`, needle)
    );
  }, [openExamQuestions, dOpenQ]);

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
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Exámenes guardados
              </h1>
              <Pill tone="gray">
                {filtered.length} / {exams.length}
              </Pill>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Buscá, filtrá por materia/tema y descargá el PDF cuando quieras.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/exams/manual"
              className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              + Nuevo examen manual
            </a>

            <a
              href="/exams/builder"
              className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Crear examen automático
            </a>

            <button
              onClick={loadExams}
              disabled={loading}
              className={cn(
                "inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50",
                loading && "opacity-60"
              )}
            >
              {loading ? "Actualizando…" : "Refrescar"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Filtros</div>
              <div className="mt-1 text-sm text-gray-600">
                Afiná la búsqueda sin volverte loco.
              </div>
            </div>
            <ExamiaMark />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-xs font-medium text-gray-500">
                Buscar (título/desc/id)
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej: fracciones, cml..., prueba..."
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-medium text-gray-500">Materia</span>
              <SelectPretty
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">— todas —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectPretty>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-medium text-gray-500">Tema</span>
              <SelectPretty
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                disabled={!subjectId}
              >
                <option value="">— todos —</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectPretty>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Orden</span>
              <div className="min-w-[220px]">
                <SelectPretty
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                >
                  <option value="newest">Más nuevo</option>
                  <option value="oldest">Más viejo</option>
                  <option value="az">A-Z</option>
                </SelectPretty>
              </div>
            </label>

            {(q.trim() || subjectId || topicId) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setSubjectId("");
                  setTopicId("");
                  setSort("newest");
                }}
                className="text-sm font-medium text-gray-700 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white/90 p-6 text-sm text-gray-600 shadow-sm">
              No hay resultados con los filtros actuales.
            </div>
          ) : (
            paged.map((e) => {
              const r = resolveSubjectTopicIds(e);
              const subjectLabel = r.subjectId
                ? subjectNameById.get(r.subjectId) ?? r.subjectId
                : "(no disponible)";
              const topicLabel = r.topicId
                ? topicNameById.get(r.topicId) ?? r.topicId
                : "(no disponible)";
              const isOpen = openExamId === e.id;

              return (
                <div
                  key={e.id}
                  ref={(el) => {
                    examRefs.current[e.id] = el;
                  }}
                  className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-gray-900">
                          {e.title ?? "Sin título"}
                        </h2>
                        <Pill tone="gray">{subjectLabel}</Pill>
                        <Pill tone="gray">{topicLabel}</Pill>
                        {e.createdAt ? (
                          <Pill tone="gray">{formatDate(e.createdAt)}</Pill>
                        ) : null}
                      </div>

                      {e.description?.trim() ? (
                        <p className="mt-2 text-sm text-gray-600">
                          {e.description}
                        </p>
                      ) : null}

                      <div className="mt-2 font-mono text-[11px] text-gray-500">
                        {e.id}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openExam(e)}
                        disabled={openLoading && !isOpen}
                        className={cn(
                          "inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50",
                          openLoading && !isOpen && "opacity-60"
                        )}
                      >
                        {isOpen ? "Cerrar" : openLoading ? "Cargando…" : "Ver"}
                      </button>

                      <button
                        onClick={() => downloadPdf(e.id, e.title)}
                        className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Descargar PDF
                      </button>

                      <a
                        href={`/exams/manual?from=${e.id}&mode=duplicate`}
                        className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        Duplicar
                      </a>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-white/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">
                          Preguntas{" "}
                          <span className="text-gray-500">
                            ({openExamQuestions.length})
                          </span>
                        </div>

                        <input
                          value={openQ}
                          onChange={(ev) => setOpenQ(ev.target.value)}
                          placeholder="Buscar dentro del examen..."
                          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:w-[360px]"
                        />
                      </div>

                      {openExamQuestions.length === 0 ? (
                        <div className="mt-3 text-sm text-gray-600">
                          No hay preguntas cargadas para este examen (o el backend
                          no las está incluyendo).
                        </div>
                      ) : (
                        <ol className="mt-4 grid gap-2">
                          {openFilteredQuestions.map((qq) => (
                            <li
                              key={qq.id}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {qq.statement ?? "(sin enunciado)"}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5">
                                  {labelType(qq.type)}
                                </span>
                                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5">
                                  {qq.difficulty ?? "—"}
                                </span>
                                <span className="font-mono text-[11px] text-gray-500">
                                  {qq.id}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}

                      <div className="mt-4">
                        <a
                          href={`/exams/manual?from=${e.id}&mode=duplicate`}
                          className="text-sm font-medium text-blue-700 hover:underline"
                        >
                          Duplicar este examen
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        <Pagination
          page={clampedPage}
          totalPages={totalPages}
          onPage={(p) => setPage(Math.max(1, Math.min(p, totalPages)))}
          pageSize={pageSize}
          onPageSize={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          totalItems={filtered.length}
        />
      </div>
    </main>
  );
}