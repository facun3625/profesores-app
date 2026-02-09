"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Institution = {
  id: string;
  name: string;
};

type MeAny =
  | {
      activeInstitutionId?: string | null;
      user?: { activeInstitutionId?: string | null } | null;
    }
  | null;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "gray" | "indigo";
}) {
  const cls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : tone === "green"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "gray"
      ? "border-gray-200 bg-gray-50 text-gray-700"
      : tone === "indigo"
      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
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

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [activeInstitutionId, setActiveInstitutionId] = useState<string | null>(
    null
  );

  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  async function load() {
    setError("");

    try {
      const list = await api<Institution[]>("/institutions");
      setInstitutions(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || "Error cargando instituciones");
    }

    let me: MeAny = null;
    try {
      me = await api<MeAny>("/auth/me");
    } catch {
      try {
        me = await api<MeAny>("/me");
      } catch {
        me = null;
      }
    }

    const activeId =
      me?.user?.activeInstitutionId ?? me?.activeInstitutionId ?? null;
    setActiveInstitutionId(activeId);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setInitialLoading(true);
      try {
        await load();
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createInstitution() {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await api("/institutions", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      setName("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando institución");
    } finally {
      setLoading(false);
    }
  }

  async function activateInstitution(institutionId: string) {
    setError("");
    setLoading(true);
    try {
      await api("/institutions/active", {
        method: "POST",
        body: JSON.stringify({ institutionId }),
      });

      setActiveInstitutionId(institutionId);
      window.dispatchEvent(new Event("active-institution-changed"));

      await load();
    } catch (e: any) {
      setError(e?.message || "Error activando institución");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(inst: Institution) {
    if (inst.id === activeInstitutionId) return; // 🔒 no editar activa
    setEditingId(inst.id);
    setEditingName(inst.name);
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
      await api(`/institutions/${editingId}`, {
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
    if (!q) return institutions;
    return institutions.filter(
      (i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
    );
  }, [institutions, search]);

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
            <h1 className="text-2xl font-semibold tracking-tight text-indigo-900">
              Instituciones
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Creá y elegí tu contexto de trabajo. Sin drama.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="green">{institutions.length} total</Badge>
            {activeInstitutionId ? (
              <Badge tone="green">Activa configurada</Badge>
            ) : (
              <Badge tone="neutral">Sin activa</Badge>
            )}
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
              <div className="text-sm font-semibold text-gray-900">
                Nueva institución
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Un nombre simple. Después afinamos.
              </div>
            </div>

            <Badge tone="gray">{institutions.length} total</Badge>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) createInstitution();
              }}
              placeholder="Ej: Instituto San Martín"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />

            <button
              type="button"
              disabled={!canCreate}
              onClick={createInstitution}
              className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Creando..." : "Crear"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
             <div className="flex items-center gap-2">
  <div className="h-5 w-1 rounded-full bg-blue-600" />
  <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">
    Tus Instituciones
  </div>
</div>
              <div className="mt-1 text-sm text-gray-600">
                Activá una para trabajar (materias, exámenes, etc.).
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-[320px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o ID…"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <Badge tone="gray">{filtered.length}</Badge>
            </div>
          </div>

          {initialLoading ? (
            <div className="px-6 py-8 text-sm text-gray-600">Cargando…</div>
          ) : filtered.length ? (
            <div className="divide-y divide-gray-100">
              {filtered.map((inst) => {
                const isActive = inst.id === activeInstitutionId;
                const isEditing = editingId === inst.id;

                return (
                  <div
                    key={inst.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!isEditing ? (
                          <div className="truncate text-sm font-semibold text-gray-900">
                            {highlight(inst.name, search)}
                          </div>
                        ) : (
                          <input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-full max-w-[360px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          />
                        )}

                        {isActive ? <Badge tone="green">Activa</Badge> : null}
                      </div>

                      <div className="mt-1">
                        <Mono>{highlight(inst.id, search)}</Mono>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={loading || !editingName.trim()}
                            onClick={saveEdit}
                            className="inline-flex h-9 items-center rounded-md bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
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
                          {!isActive && (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => startEdit(inst)}
                              className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                              Editar
                            </button>
                          )}

                          {isActive ? (
                            <button
                              type="button"
                              disabled
                              className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-green-50 px-3 text-sm font-medium text-gray-500"
                            >
                              Activa
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => activateInstitution(inst.id)}
                              className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {loading ? "Activando..." : "Activar"}
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
    </main>
  );
}