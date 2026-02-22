"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useIsAdmin } from "@/lib/hooks";
import { toast } from "sonner";
import ConfirmModal from "@/components/ConfirmModal";

type Topic = {
  id: string;
  name: string;
  subjectId: string;
};

type Subject = {
  id: string;
  name: string;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "gray" | "emerald";
}) {
  const cls =
    tone === "blue"
      ? "border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
      : tone === "green"
        ? "border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
        : tone === "gray"
          ? "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
          : tone === "emerald"
            ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
            : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300";

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
  return <span className="font-mono text-[12px] text-gray-500 dark:text-slate-500">{children}</span>;
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
      <mark className="rounded bg-yellow-100 dark:bg-yellow-900/40 px-1 text-gray-900 dark:text-yellow-200">{b}</mark>
      {c}
    </>
  );
}

export default function TopicsPage() {
  const params = useParams();
  const subjectId = (params.subjectId as string) || "";

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const isAdmin = useIsAdmin();

  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    topic: Topic | null;
  }>({ isOpen: false, topic: null });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  async function load() {
    setError("");

    if (!subjectId) {
      setSubject(null);
      setTopics([]);
      setError("Materia inválida");
      setInitialLoading(false);
      return;
    }

    try {
      const [topicsData, subjectsData] = await Promise.all([
        api<Topic[]>(`/topics/subject/${subjectId}`),
        api<Subject[]>("/subjects"),
      ]);

      setTopics(Array.isArray(topicsData) ? topicsData : []);
      const list = Array.isArray(subjectsData) ? subjectsData : [];
      setSubject(list.find((s) => s.id === subjectId) || null);
    } catch (e: any) {
      setError(e?.message || "Error cargando temas");
      setTopics([]);
      setSubject(null);
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    setInitialLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  async function createTopic() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      await api("/topics", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, subjectId }),
      });

      setName("");
      setInitialLoading(true);
      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando tema");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmDelete() {
    const t = confirmDelete.topic;
    if (!t) return;

    setLoading(true);
    setConfirmDelete({ isOpen: false, topic: null });

    try {
      await api(`/topics/${t.id}`, { method: "DELETE" });
      toast.success("Tema archivado correctamente");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al archivar el tema");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(t: Topic) {
    setEditingId(t.id);
    setEditingName(t.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveEdit() {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      await api(`/topics/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      cancelEdit();
      await load();
    } catch (e: any) {
      setError(e?.message || "Error guardando cambios");
    } finally {
      setLoading(false);
    }
  }

  const canCreate = name.trim().length > 0 && !loading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    );
  }, [topics, search]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <a
            href="/subjects"
            className="text-sm font-medium text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Volver a materias
          </a>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
            Temas
          </h1>

          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Materia:{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {subject?.name || "—"}
            </span>{" "}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="blue">{topics.length} total</Badge>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Nuevo tema</div>
            <div className="mt-1 text-sm text-gray-600">
              Poné el nombre y seguí. Después vienen las preguntas.
            </div>
          </div>

          <Badge tone="gray">Topics</Badge>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) createTopic();
            }}
            placeholder="Ej: Fracciones"
            className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />

          <button
            type="button"
            disabled={!canCreate}
            onClick={createTopic}
            className="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-md bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-blue-600" />
              <div className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                Tus temas
              </div>
            </div>
            <div className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              Entrá a gestionar preguntas para armar el banco.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[320px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre…"
                className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <Badge tone="gray">{filtered.length}</Badge>
          </div>
        </div>

        {initialLoading ? (
          <div className="px-6 py-8 text-sm text-gray-600 dark:text-slate-400">Cargando…</div>
        ) : filtered.length ? (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  {!editingId || editingId !== t.id ? (
                    <>
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {highlight(t.name, search)}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="w-full max-w-[360px] rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {editingId === t.id ? (
                    <>
                      <button
                        type="button"
                        disabled={loading || !editingName.trim()}
                        onClick={saveEdit}
                        className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={cancelEdit}
                        className="inline-flex h-9 items-center rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => startEdit(t)}
                        className="inline-flex h-9 items-center rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60"
                      >
                        Editar
                      </button>

                      <a
                        href={`/topics/${t.id}/questions?subjectId=${subjectId}`}
                        className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Gestionar preguntas →
                      </a>

                      {isAdmin && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => setConfirmDelete({ isOpen: true, topic: t })}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-100 bg-white p-0 text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                          title="Archivar tema"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-sm text-gray-600 dark:text-slate-400">
            No hay resultados. Probá con otro nombre.
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="¿Archivar tema?"
        message={`Estás por archivar el tema "${confirmDelete.topic?.name}". Todas las preguntas asociadas también se archivarán y no podrán usarse en nuevos exámenes.`}
        confirmLabel="Sí, archivar"
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, topic: null })}
        tone="warning"
      />
    </div>
  );
}