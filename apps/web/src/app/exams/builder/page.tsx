"use client";

import { useEffect, useMemo, useState } from "react";
import { api, apiBlob } from "@/lib/api";
import { toast } from "sonner";
import PdfCustomizeModal, { PdfOptions } from "@/components/PdfCustomizeModal";

/* =====================
   Types
===================== */

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subjectId: string };

type Difficulty = "easy" | "medium" | "hard";
type QType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_TRUE_FALSE" | "OPEN" | "FILL_IN";

type Question = {
  id: string;
  type: QType;
  difficulty: Difficulty;
  statement: string;
  options?: string[] | null;
  requiresJustification?: boolean;
  openLines?: number | null;
};

type PreviewQuestionsResponse = {
  questions: Question[];
};

type GenerateOrReuseResponse = {
  mode: "created" | "reused";
  exam: { id: string; title: string; createdAt: string };
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
  if (t === "MULTIPLE_CHOICE") return "Opción múltiple";
  if (t === "TRUE_FALSE") return "Verdadero / Falso";
  if (t === "MULTI_TRUE_FALSE") return "Múltiple Verdadero / Falso";
  if (t === "FILL_IN") return "Completar";
  return "A desarrollar";
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeName(name: string) {
  return (name || "exam").replace(/[^a-z0-9\\-_ ]/gi, "").trim() || "exam";
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
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
        className="h-10 w-full appearance-none rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-11 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

  // Wizard step
  const [step, setStep] = useState(1);

  /* ---------- base state ---------- */
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicIds, setTopicIds] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [mc, setMc] = useState(0);
  const [tf, setTf] = useState(0);
  const [mtf, setMtf] = useState(0);
  const [op, setOp] = useState(0);
  const [fi, setFi] = useState(0);

  const totalQuestions = useMemo(() => mc + tf + mtf + op + fi, [mc, tf, mtf, op, fi]);

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
  const [loading, setLoading] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  /* =====================
     Load subjects / topics
  ===================== */

  useEffect(() => {
    api<Subject[]>("/subjects")
      .then(setSubjects)
      .catch((e) => toast.error(e.message));
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
      .catch((e) => toast.error(e.message));
  }, [subjectId]);

  /* =====================
     Toggles
  ===================== */

  function toggleTopic(id: string) {
    setTopicIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleDifficulty(d: Difficulty) {
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

        const types: QType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTI_TRUE_FALSE", "OPEN", "FILL_IN"];
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

    const types: QType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTI_TRUE_FALSE", "OPEN", "FILL_IN"];
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
     Validation (Variante A2: Inteligente)
  ===================== */

  function validateDifficulties(): { valid: boolean; message?: string; warnings?: string[] } {
    if (!stockByType || difficulties.length === 0) return { valid: true };

    const issues: string[] = [];
    const suggestions: string[] = [];
    const warnings: string[] = [];

    // Verificar cada tipo de pregunta
    if (mc > 0) {
      const mcStock = stockByType.find(s => s.type === "MULTIPLE_CHOICE");
      if (mcStock) {
        const available = difficulties.reduce((sum, d) => sum + mcStock.byDiff[d], 0);
        if (available < mc) {
          issues.push(`Multiple choice: necesitás ${mc}, solo hay ${available} en las dificultades seleccionadas`);

          // Sugerir dificultades con stock
          const missing = (["easy", "medium", "hard"] as Difficulty[])
            .filter(d => !difficulties.includes(d) && mcStock.byDiff[d] > 0)
            .map(d => `${d === "easy" ? "Fácil" : d === "medium" ? "Medio" : "Difícil"} (${mcStock.byDiff[d]} disponibles)`);

          if (missing.length > 0) {
            suggestions.push(`Agregá estas dificultades para Multiple choice: ${missing.join(", ")}`);
          }
        } else if (available === mc) {
          warnings.push(`Multiple choice: usarás todas las ${mc} preguntas disponibles`);
        }
      }
    }

    if (tf > 0) {
      const tfStock = stockByType.find(s => s.type === "TRUE_FALSE");
      if (tfStock) {
        const available = difficulties.reduce((sum, d) => sum + tfStock.byDiff[d], 0);
        if (available < tf) {
          issues.push(`Verdadero/Falso: necesitás ${tf}, solo hay ${available} en las dificultades seleccionadas`);

          const missing = (["easy", "medium", "hard"] as Difficulty[])
            .filter(d => !difficulties.includes(d) && tfStock.byDiff[d] > 0)
            .map(d => `${d === "easy" ? "Fácil" : d === "medium" ? "Medio" : "Difícil"} (${tfStock.byDiff[d]} disponibles)`);

          if (missing.length > 0) {
            suggestions.push(`Agregá estas dificultades para Verdadero/Falso: ${missing.join(", ")}`);
          }
        } else if (available === tf) {
          warnings.push(`Verdadero/Falso: usarás todas las ${tf} preguntas disponibles`);
        }
      }
    }

    if (mtf > 0) {
      const mtfStock = stockByType.find(s => s.type === "MULTI_TRUE_FALSE");
      if (mtfStock) {
        const available = difficulties.reduce((sum, d) => sum + mtfStock.byDiff[d], 0);
        if (available < mtf) {
          issues.push(`Múltiple V/F: necesitás ${mtf}, solo hay ${available} en las dificultades seleccionadas`);

          const missing = (["easy", "medium", "hard"] as Difficulty[])
            .filter(d => !difficulties.includes(d) && mtfStock.byDiff[d] > 0)
            .map(d => `${d === "easy" ? "Fácil" : d === "medium" ? "Medio" : "Difícil"} (${mtfStock.byDiff[d]} disponibles)`);

          if (missing.length > 0) {
            suggestions.push(`Agregá estas dificultades para Múltiple V/F: ${missing.join(", ")}`);
          }
        } else if (available === mtf) {
          warnings.push(`Múltiple V/F: usarás todas las ${mtf} preguntas disponibles`);
        }
      }
    }

    if (op > 0) {
      const opStock = stockByType.find(s => s.type === "OPEN");
      if (opStock) {
        const available = difficulties.reduce((sum, d) => sum + opStock.byDiff[d], 0);
        if (available < op) {
          issues.push(`De desarrollo: necesitás ${op}, solo hay ${available} en las dificultades seleccionadas`);

          const missing = (["easy", "medium", "hard"] as Difficulty[])
            .filter(d => !difficulties.includes(d) && opStock.byDiff[d] > 0)
            .map(d => `${d === "easy" ? "Fácil" : d === "medium" ? "Medio" : "Difícil"} (${opStock.byDiff[d]} disponibles)`);

          if (missing.length > 0) {
            suggestions.push(`Agre gá estas dificultades para De desarrollo: ${missing.join(", ")}`);
          }
        } else if (available === op) {
          warnings.push(`De desarrollo: usarás todas las ${op} preguntas disponibles`);
        }
      }
    }

    if (fi > 0) {
      const fiStock = stockByType.find(s => s.type === "FILL_IN");
      if (fiStock) {
        const available = difficulties.reduce((sum, d) => sum + fiStock.byDiff[d], 0);
        if (available < fi) {
          issues.push(`Completar: necesitás ${fi}, solo hay ${available} en las dificultades seleccionadas`);

          const missing = (["easy", "medium", "hard"] as Difficulty[])
            .filter(d => !difficulties.includes(d) && fiStock.byDiff[d] > 0)
            .map(d => `${d === "easy" ? "Fácil" : d === "medium" ? "Medio" : "Difícil"} (${fiStock.byDiff[d]} disponibles)`);

          if (missing.length > 0) {
            suggestions.push(`Agre gá estas dificultades para Completar: ${missing.join(", ")}`);
          }
        } else if (available === fi) {
          warnings.push(`Completar: usarás todas las ${fi} preguntas disponibles`);
        }
      }
    }

    if (issues.length > 0) {
      let message = "⚠️ Problema detectado:\n\n" + issues.join("\n");

      if (suggestions.length > 0) {
        message += "\n\n💡 Solución:\n" + suggestions.join("\n");
      }

      return { valid: false, message };
    }

    return { valid: true, warnings };
  }

  const typeCounts = {
    MULTIPLE_CHOICE: mc,
    TRUE_FALSE: tf,
    MULTI_TRUE_FALSE: mtf,
    OPEN: op,
    FILL_IN: fi,
  };

  /* =====================
     Actions
  ===================== */

  async function previewRequest() {
    setError("");
    setPreviewQuestions(null);
    setResult(null);

    // Validar dificultades
    const validation = validateDifficulties();
    if (!validation.valid) {
      setError(validation.message || "Stock insuficiente");
      toast.error("No hay suficientes preguntas");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      topicIds,
      totalQuestions,
      typeCounts,
      difficulties,
      shuffle: true,
    };

    setLoading(true);
    try {
      const res = await api<PreviewQuestionsResponse>("/exams/preview-questions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPreviewQuestions(res.questions ?? []);
      toast.success(`Preview generado: ${res.questions.length} preguntas`);
      setStep(6); // Ir a paso de preview
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateOrReuse() {
    setError("");
    setResult(null);

    // Validar dificultades
    const validation = validateDifficulties();
    if (!validation.valid) {
      setError(validation.message || "Stock insuficiente");
      toast.error("No hay suficientes preguntas");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      topicIds,
      totalQuestions,
      typeCounts,
      difficulties,
      shuffle: true,
    };

    setLoading(true);
    try {
      const res = await api<GenerateOrReuseResponse>("/exams/generate-or-reuse", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(res);
      toast.success(
        res.mode === "created" ? "Examen creado" : "Examen reutilizado"
      );
      setStep(7); // Ir a paso de resultado
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf(options?: PdfOptions) {
    setError("");
    if (!result) return;

    try {
      // Construir query params si hay opciones
      let url = result.exportPdfUrl;
      if (options) {
        const params = new URLSearchParams({
          boldStatement: String(options.boldStatement),
          fontFamily: options.fontFamily,
          questionSize: String(options.questionSize),
          answerSize: String(options.answerSize),
          lineSpacing: String(options.lineSpacing),
          showAnswers: String(options.showAnswers),
        });
        url = `${url}?${params.toString()}`;
      }

      const blob = await apiBlob(url);

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const downloadName = `${safeName(title)}.pdf`;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success("PDF descargado");
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Error descargando PDF";
      setError(msg);
      toast.error(msg);
    }
  }

  function resetWizard() {
    setStep(1);
    setSubjectId("");
    setTopicIds([]);
    setTitle("");
    setDescription("");
    setMc(0);
    setTf(0);
    setMtf(0);
    setOp(0);
    setFi(0);
    setDifficulties(["easy", "medium", "hard"]);
    setPreviewQuestions(null);
    setResult(null);
    setError("");
  }

  /* =====================
     UI
  ===================== */

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Generador IA
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Creá exámenes automáticamente desde tu banco de preguntas.
          </p>
        </div>

        {step > 1 && step < 7 && (
          <button
            onClick={resetWizard}
            className="inline-flex h-9 items-center rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            Reiniciar
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="mb-4 flex items-center justify-between">
        {[
          { num: 1, label: "Materia" },
          { num: 2, label: "Temas" },
          { num: 3, label: "Cantidades" },
          { num: 4, label: "Dificultades" },
          { num: 5, label: "Generar" },
        ].map((s, idx) => (
          <div key={s.num} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${step >= s.num
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-500"
                  }`}
              >
                {s.num}
              </div>
              <span className="mt-1 text-[10px] font-medium text-gray-500 dark:text-slate-500">{s.label}</span>
            </div>
            {idx < 4 && (
              <div
                className={`mx-2 mb-4 h-1 flex-1 rounded transition ${step > s.num ? "bg-blue-600" : "bg-gray-200 dark:bg-slate-800"
                  }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 whitespace-pre-line">
          {error}
        </div>
      )}

      {/* Step 1: Subject */}
      {step === 1 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/50 backdrop-blur p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Paso 1: Configuración inicial</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Ingresá los datos básicos del examen y elegí la materia.</p>

          <div className="space-y-4 mb-6">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-500">Título del examen</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Ej: Examen de Matemática - Unidad 1"
              />
            </label>

            {(!subjectId || !title.trim()) && (
              <div className="flex items-start gap-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/20 p-4 transition-all animate-in fade-in slide-in-from-top-2">
                <div className="flex shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-800/40 p-2 text-blue-600 dark:text-blue-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 14" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Configuración requerida</p>
                  <p className="text-sm text-blue-700/80 dark:text-blue-400/80">Asigná un <strong>título</strong> y elegí una <strong>materia</strong> para habilitar el generador.</p>
                </div>
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-500">Descripción (opcional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 block w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Ej: Examen de repaso para el primer trimestre"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-500">Materia</span>
              <div className="mt-2">
                <SelectPretty
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  <option value="">— Seleccionar materia —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </SelectPretty>
              </div>
            </label>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!subjectId || !title.trim()}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Continuar
          </button>
        </div>
      )}

      {/* Step 2: Topics */}
      {step === 2 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/50 backdrop-blur p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Paso 2: Seleccioná los temas</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Elegí uno o más temas que querés incluir en el examen.</p>

          <div className="space-y-2 mb-6">
            {topics.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-slate-800 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition"
              >
                <input
                  type="checkbox"
                  checked={topicIds.includes(t.id)}
                  onChange={() => toggleTopic(t.id)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-sm text-gray-900 dark:text-white">{t.name}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={topicIds.length === 0}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Question Counts */}
      {step === 3 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/50 backdrop-blur p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Paso 3: Cantidad de preguntas</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Indicá cuántas preguntas de cada tipo querés incluir.</p>

          <div className="space-y-4 mb-6">
            {/* Multiple Choice */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-500">Opción múltiple</label>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {stockByType?.find(s => s.type === "MULTIPLE_CHOICE")?.total || 0} disponibles
                </span>
              </div>
              <input
                type="number"
                min="0"
                max={stockByType?.find(s => s.type === "MULTIPLE_CHOICE")?.total || 0}
                value={mc}
                onChange={(e) => {
                  const max = stockByType?.find(s => s.type === "MULTIPLE_CHOICE")?.total || 0;
                  const val = Math.min(Math.max(0, +e.target.value), max);
                  setMc(val);
                }}
                className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0"
              />
            </div>

            {/* True/False */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-500">Verdadero / Falso</label>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {stockByType?.find(s => s.type === "TRUE_FALSE")?.total || 0} disponibles
                </span>
              </div>
              <input
                type="number"
                min="0"
                max={stockByType?.find(s => s.type === "TRUE_FALSE")?.total || 0}
                value={tf}
                onChange={(e) => {
                  const max = stockByType?.find(s => s.type === "TRUE_FALSE")?.total || 0;
                  const val = Math.min(Math.max(0, +e.target.value), max);
                  setTf(val);
                }}
                className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0"
              />
            </div>

            {/* Múltiple Verdadero / Falso */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-500">Múltiple Verdadero / Falso</label>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {stockByType?.find(s => s.type === "MULTI_TRUE_FALSE")?.total || 0} disponibles
                </span>
              </div>
              <input
                type="number"
                min="0"
                max={stockByType?.find(s => s.type === "MULTI_TRUE_FALSE")?.total || 0}
                value={mtf}
                onChange={(e) => {
                  const max = stockByType?.find(s => s.type === "MULTI_TRUE_FALSE")?.total || 0;
                  const val = Math.min(Math.max(0, +e.target.value), max);
                  setMtf(val);
                }}
                className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0"
              />
            </div>

            {/* Open */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-500">A desarrollar</label>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {stockByType?.find(s => s.type === "OPEN")?.total || 0} disponibles
                </span>
              </div>
              <input
                type="number"
                min="0"
                max={stockByType?.find(s => s.type === "OPEN")?.total || 0}
                value={op}
                onChange={(e) => {
                  const max = stockByType?.find(s => s.type === "OPEN")?.total || 0;
                  const val = Math.min(Math.max(0, +e.target.value), max);
                  setOp(val);
                }}
                className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0"
              />
            </div>

            {/* Fill In */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-500">Completar</label>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {stockByType?.find(s => s.type === "FILL_IN")?.total || 0} disponibles
                </span>
              </div>
              <input
                type="number"
                min="0"
                max={stockByType?.find(s => s.type === "FILL_IN")?.total || 0}
                value={fi}
                onChange={(e) => {
                  const max = stockByType?.find(s => s.type === "FILL_IN")?.total || 0;
                  const val = Math.min(Math.max(0, +e.target.value), max);
                  setFi(val);
                }}
                className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="0"
              />
            </div>
          </div>

          <div className="mb-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 p-4">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Total: <span className="text-lg">{totalQuestions}</span> preguntas seleccionadas
            </p>
            {totalQuestions > 0 && (
              <div className="mt-2 text-xs text-blue-700 space-y-1">
                {mc > 0 && <div>• {mc} Opción múltiple</div>}
                {tf > 0 && <div>• {tf} Verdadero/Falso</div>}
                {mtf > 0 && <div>• {mtf} Múltiple V/F</div>}
                {op > 0 && <div>• {op} A desarrollar</div>}
                {fi > 0 && <div>• {fi} Completar</div>}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Atrás
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={totalQuestions === 0}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Difficulties */}
      {step === 4 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/50 backdrop-blur p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Paso 4: Dificultades</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Seleccioná qué niveles de dificultad querés incluir.</p>

          <div className="space-y-3 mb-6">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <label
                key={d}
                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-slate-800 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition"
              >
                <input
                  type="checkbox"
                  checked={difficulties.includes(d)}
                  onChange={() => toggleDifficulty(d)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-sm text-gray-900 dark:text-white capitalize">
                  {d === "easy" ? "Fácil" : d === "medium" ? "Medio" : "Difícil"}
                </span>
              </label>
            ))}
          </div>


          {/* Validación en tiempo real */}
          {difficulties.length > 0 && (() => {
            const validation = validateDifficulties();

            // Mostrar ERROR si no es válido
            if (!validation.valid && validation.message) {
              return (
                <div className="mb-6 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
                  <div className="text-sm text-red-700 dark:text-red-400 whitespace-pre-line">
                    {validation.message}
                  </div>
                </div>
              );
            }

            // Mostrar WARNINGS si es válido pero hay advertencias
            if (validation.warnings && validation.warnings.length > 0) {
              return (
                <div className="mb-6 rounded-lg border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                  <div className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">⚠️ Advertencias:</div>
                  <div className="space-y-1 text-xs text-yellow-800 dark:text-yellow-400/80">
                    {validation.warnings.map((w, idx) => (
                      <div key={idx}>• {w}</div>
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })()}


          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Atrás
            </button>
            <button
              onClick={() => setStep(5)}
              disabled={difficulties.length === 0}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Generate */}
      {step === 5 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/50 backdrop-blur p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Paso 5: Generar examen</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Revisá la configuración y generá tu examen.</p>

          <div className="mb-6 space-y-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-slate-400">Materia:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {subjects.find(s => s.id === subjectId)?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-slate-400">Temas:</span>
              <span className="font-medium text-gray-900 dark:text-white">{topicIds.length} seleccionados</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-slate-400">Total preguntas:</span>
              <span className="font-medium text-gray-900 dark:text-white">{totalQuestions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-slate-400">Dificultades:</span>
              <span className="font-medium text-gray-900 dark:text-white">{difficulties.length} niveles</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={previewRequest}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Cargando..." : "Ver Preview"}
            </button>
            <button
              onClick={generateOrReuse}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Generando..." : "Generar Examen"}
            </button>
            <button
              onClick={() => setStep(4)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Atrás
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Preview */}
      {step === 6 && previewQuestions && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/50 backdrop-blur p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Preview ({previewQuestions.length} preguntas)
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Estas son las preguntas que se incluirán en el examen.</p>

          <div className="mb-6 max-h-96 overflow-y-auto">
            <ol className="space-y-3">
              {previewQuestions.map((q, idx) => (
                <li key={q.id} className="flex gap-3 rounded-lg border border-gray-200 dark:border-slate-800 p-3">
                  <span className="font-semibold text-gray-500 dark:text-slate-500">{idx + 1}.</span>
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white">{q.statement}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">
                      {labelType(q.type)} · {q.difficulty === "easy" ? "Fácil" : q.difficulty === "medium" ? "Medio" : "Difícil"}
                    </p>
                    {q.type === "MULTI_TRUE_FALSE" && Array.isArray(q.options) && (
                      <ul className="mt-2 space-y-1 pl-4">
                        {(q.options as any[]).map((opt, i) => (
                          <li key={i} className="text-xs text-gray-600 dark:text-slate-400">
                            {i + 1}. {typeof opt === 'string' ? opt : opt.statement}
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.requiresJustification && (
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full w-fit">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        Requiere justificación ({q.openLines || 2} renglones)
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-3">
            <button
              onClick={generateOrReuse}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Generando..." : "Generar Examen"}
            </button>
            <button
              onClick={() => setStep(5)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Atrás
            </button>
          </div>
        </div>
      )}

      {/* Step 7: Result */}
      {step === 7 && result && (
        <div className={cn(
          "rounded-2xl border backdrop-blur p-8 shadow-sm",
          result.mode === "created"
            ? "border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/20"
            : "border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20"
        )}>
          <h2 className={cn(
            "text-lg font-semibold mb-2",
            result.mode === "created" ? "text-green-900 dark:text-green-400" : "text-blue-900 dark:text-blue-400"
          )}>
            {result.mode === "created" ? "¡Examen generado con éxito!" : "Examen reutilizado"}
          </h2>

          {result.mode === "reused" ? (
            <p className="text-sm text-blue-800 dark:text-blue-300/80 mb-6">
              El sistema agotó las combinaciones únicas posibles con estas preguntas.
              Se muestra un examen existente creado el <b>{formatDate(result.exam.createdAt)}</b>.
            </p>
          ) : (
            <p className="text-sm text-green-800 dark:text-green-300/80 mb-6">{result.exam.title}</p>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => downloadPdf()}
              className="w-full rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 transition"
            >
              Descargar PDF estándar
            </button>
            <button
              type="button"
              onClick={() => setShowCustomizeModal(true)}
              className="w-full rounded-lg border border-green-600 dark:border-green-800 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition"
            >
              Personalizar y descargar
            </button>
            <button
              onClick={resetWizard}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Crear otro examen
            </button>
          </div>
        </div>
      )}

      {/* PDF Customize Modal */}
      <PdfCustomizeModal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onDownload={(options) => downloadPdf(options)}
      />
    </div>
  );
}
