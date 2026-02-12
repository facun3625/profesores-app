"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, apiBlob } from "@/lib/api";
import { toast } from "sonner";
import PdfCustomizeModal, { PdfOptions } from "@/components/PdfCustomizeModal";

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

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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
        className="h-10 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
  if (t === "TRUE_FALSE") return "Verdadero / Falso";
  return "De desarrollo";
}

function labelDifficulty(d?: Difficulty) {
  if (!d) return "—";
  if (d === "easy") return "Fácil";
  if (d === "medium") return "Medio";
  return "Difícil";
}

function safeName(name: string) {
  return (name || "exam").replace(/[^a-z0-9\\-_ ]/gi, "").trim() || "exam";
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

  const [createdExamId, setCreatedExamId] = useState<string | null>(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

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
    if (err) {
      setError(err);
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        questionIds: selectedIds,
      };

      const created = await tryCreateExam(payload);
      setCreatedExamId(created.id);
      toast.success(isDuplicate ? "Examen duplicado" : "Examen creado");
    } catch (e: any) {
      setError(e?.message ?? "Error creando examen");
      setCreatedExamId(null);
      toast.error(e?.message ?? "Error creando examen");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf(options?: PdfOptions) {
    setError("");
    if (!createdExamId) return;

    try {
      // Construir query params si hay opciones
      let url = `/exams/${createdExamId}/export/pdf`;
      if (options) {
        const params = new URLSearchParams({
          boldStatement: String(options.boldStatement),
          fontFamily: options.fontFamily,
          questionSize: String(options.questionSize),
          answerSize: String(options.answerSize),
          lineSpacing: String(options.lineSpacing),
        });
        url = `${url}?${params.toString()}`;
      }

      const blob = await apiBlob(url);
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${safeName(title)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success("PDF descargado");
    } catch (e: any) {
      setError(e?.message ?? "Error descargando PDF");
      toast.error(e?.message ?? "Error descargando PDF");
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-50 via-white to-gray-100" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.10) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {isDuplicate ? "Duplicar examen" : "Crear examen manual"}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Seleccioná preguntas manualmente desde tu banco.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/exams"
              className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Volver
            </a>
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? "Procesando..." : isDuplicate ? "Duplicar" : "Crear"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Success */}
        {createdExamId && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-blue-900">
                <b>Examen creado:</b>{" "}
                <span className="font-mono text-xs">{createdExamId}</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadPdf()}
                  className="inline-flex h-8 items-center rounded-md border border-blue-300 bg-white px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 transition"
                >
                  PDF estándar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomizeModal(true)}
                  className="inline-flex h-8 items-center rounded-md border border-blue-300 bg-white px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 transition"
                >
                  Personalizar
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/exams")}
                  className="inline-flex h-8 items-center rounded-md border border-blue-300 bg-white px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 transition"
                >
                  Ir a exámenes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-xs font-medium text-gray-500">Título</span>
              <input
                value={title}
                onChange={(e) => {
                  touch();
                  setTitle(e.target.value);
                }}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-xs font-medium text-gray-500">Descripción</span>
              <input
                value={description}
                onChange={(e) => {
                  touch();
                  setDescription(e.target.value);
                }}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-medium text-gray-500">Materia</span>
              <SelectPretty
                value={subjectId}
                onChange={(e) => {
                  touch();
                  setSubjectId(e.target.value);
                }}
              >
                <option value="">— Seleccionar —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectPretty>
            </label>
          </div>
        </section>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Bank */}
          <section className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Banco de preguntas</h2>

            {/* Topics */}
            {topics.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Temas</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {topics.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={topicIds.includes(t.id)}
                        onChange={() => toggleTopic(t.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs font-medium text-gray-500">Buscar</span>
                <input
                  value={search}
                  onChange={(e) => {
                    touch();
                    setSearch(e.target.value);
                  }}
                  placeholder="Escribí y filtra..."
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-medium text-gray-500">Tipo</span>
                <SelectPretty
                  value={typeFilter}
                  onChange={(e) => {
                    touch();
                    setTypeFilter(e.target.value as any);
                  }}
                >
                  <option value="ALL">Todos</option>
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                  <option value="TRUE_FALSE">Verdadero / Falso</option>
                  <option value="OPEN">De desarrollo</option>
                </SelectPretty>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-medium text-gray-500">Dificultad</span>
                <SelectPretty
                  value={diffFilter}
                  onChange={(e) => {
                    touch();
                    setDiffFilter(e.target.value as any);
                  }}
                >
                  <option value="ALL">Todas</option>
                  <option value="easy">Fácil</option>
                  <option value="medium">Medio</option>
                  <option value="hard">Difícil</option>
                </SelectPretty>
              </label>
            </div>

            {/* Questions */}
            {bankLoading ? (
              <div className="text-sm text-gray-600">Cargando preguntas...</div>
            ) : (
              <div className="grid gap-2 max-h-[600px] overflow-y-auto">
                {filteredBank.map((q) => (
                  <label
                    key={q.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{q.statement}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {labelType(q.type)} · {labelDifficulty(q.difficulty)} · {q.id}
                      </div>
                    </div>
                  </label>
                ))}
                {filteredBank.length === 0 && (
                  <div className="text-sm text-gray-600">No hay preguntas con esos filtros.</div>
                )}
              </div>
            )}
          </section>

          {/* Selected */}
          <section className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Seleccionadas ({selectedIds.length})
            </h2>

            {selectedIds.length === 0 ? (
              <div className="text-sm text-gray-600">Elegí preguntas del banco.</div>
            ) : (
              <ol className="grid gap-3 max-h-[600px] overflow-y-auto">
                {selectedQuestions.map((q: any, idx) => (
                  <li key={q.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {idx + 1}. {q.statement ?? "(sin enunciado)"}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 font-mono">{q.id}</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveSelected(q.id, -1)}
                        disabled={idx === 0}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSelected(q.id, 1)}
                        disabled={idx === selectedIds.length - 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSelected(q.id)}
                        className="inline-flex h-7 items-center rounded border border-red-300 bg-white px-2 text-xs font-medium text-red-700 hover:bg-red-50 transition"
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      {/* PDF Customize Modal */}
      <PdfCustomizeModal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onDownload={(options) => downloadPdf(options)}
      />
    </main>
  );
}