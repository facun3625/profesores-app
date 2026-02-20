"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useIsAdmin } from "@/lib/hooks";
import { toast } from "sonner";
import ConfirmModal from "@/components/ConfirmModal";

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
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : tone === "green"
        ? "border-green-200 bg-green-50 text-green-700"
        : tone === "gray"
          ? "border-gray-200 bg-gray-50 text-gray-700"
          : tone === "emerald"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
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

export default function SubjectsPage() {
  const isAdmin = useIsAdmin();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    subject: Subject | null;
  }>({ isOpen: false, subject: null });

  async function load() {
    setError("");

    try {
      const subjectsData = await api<Subject[]>("/subjects");
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
    } catch (e: any) {
      setError(e?.message || "Error cargando materias");
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createSubject() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      await api("/subjects", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });

      setName("");
      setInitialLoading(true);
      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando materia");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(s: Subject) {
    setEditingId(s.id);
    setEditingName(s.name);
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
      await api(`/subjects/${editingId}`, {
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

  async function onDeleteConfirm() {
    const s = confirmDelete.subject;
    if (!s) return;

    setLoading(true);
    setConfirmDelete({ isOpen: false, subject: null });

    try {
      await api(`/subjects/${s.id}`, { method: "DELETE" });
      toast.success("Materia eliminada correctamente");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar la materia");
    } finally {
      setLoading(false);
    }
  }

  const canCreate = name.trim().length > 0 && !loading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [subjects, search]);

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
            <h1 className="text-2xl font-semibold tracking-tight text-emerald-900">
              Materias
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Acá se arma el mapa. Después vienen los exámenes a repartir justicia.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="emerald">{subjects.length} total</Badge>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {/* Formulario nueva materia: solo admins */}
        {isAdmin && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Nueva materia</div>
                <div className="mt-1 text-sm text-gray-600">
                  Nombre simple y a otra cosa.
                </div>
              </div>
              <Badge tone="gray">Subjects</Badge>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCreate) createSubject();
                }}
                placeholder="Ej: Matemática"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />

              <button
                type="button"
                disabled={!canCreate}
                onClick={createSubject}
                className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? "Creando..." : "Crear"}
              </button>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-blue-600" />
                <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  Tus Materias
                </div>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Entrá a “Temas” para completar la estructura.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-[320px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o ID…"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <Badge tone="gray">{filtered.length}</Badge>
            </div>
          </div>

          {initialLoading ? (
            <div className="px-6 py-8 text-sm text-gray-600">Cargando…</div>
          ) : filtered.length ? (
            <div className="divide-y divide-gray-100">
              {filtered.map((s) => {
                const isEditing = editingId === s.id;

                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!isEditing ? (
                          <div className="truncate text-sm font-semibold text-gray-900">
                            {highlight(s.name, search)}
                          </div>
                        ) : (
                          <input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-full max-w-[360px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        )}
                      </div>

                      <div className="mt-1">
                        <Mono>{highlight(s.id, search)}</Mono>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={loading || !editingName.trim()}
                            onClick={saveEdit}
                            className="inline-flex h-9 items-center rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={cancelEdit}
                            className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => startEdit(s)}
                            className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            Editar
                          </button>

                          <a
                            href={`/subjects/${s.id}/topics`}
                            className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            Temas →
                          </a>

                          {isAdmin && (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => setConfirmDelete({ isOpen: true, subject: s })}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-white p-0 text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-8 text-sm text-gray-600">
              No hay resultados. Probá con otro nombre o pegá un ID.
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onCancel={() => setConfirmDelete({ isOpen: false, subject: null })}
        onConfirm={onDeleteConfirm}
        title="¿Eliminar materia?"
        message={`Esto es definitivo. Se borrarán todos los temas, preguntas y exámenes asociados a "${confirmDelete.subject?.name}".`}
        confirmLabel="Eliminar permanentemente"
        tone="danger"
        requireConfirmationText={confirmDelete.subject?.name}
      />
    </main>
  );
}