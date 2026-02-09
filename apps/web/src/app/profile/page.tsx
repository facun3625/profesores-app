"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout } from "@/lib/auth";

type MeResponse = {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    activeInstitutionId?: string | null;
  };
  activeInstitution?: { id: string; name: string } | null;
  activeInstitutionId?: string | null;
  institution?: { id: string; name: string } | null;
};

function FluxMark() {
  return (
    <div className="select-none">
      <div
        className="text-xl font-semibold tracking-tight text-blue-600"
        style={{
          fontFamily:
            "'Montserrat Alternates','Inter','Helvetica Neue',Arial,sans-serif",
        }}
      >
        flux
      </div>
      <div className="mt-0.5 text-xs text-gray-500">Perfil</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={[
          "text-sm font-medium text-gray-900 sm:max-w-[60%] sm:text-right",
          mono ? "font-mono text-[12px] font-normal text-gray-700" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function initials(nameOrEmail: string) {
  const s = (nameOrEmail || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = (await getMe()) as any;
        if (cancelled) return;
        setMe(r);
        setErr(null);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "No se pudo cargar el perfil");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const user = me?.user;

  useEffect(() => {
    if (user?.name && !editingName) {
      setNameDraft(user.name);
    }
  }, [user?.name, editingName]);

  const avatarLabel = useMemo(() => {
    const base = user?.name?.trim() || user?.email || "";
    return initials(base);
  }, [user?.name, user?.email]);

  async function saveName() {
    const nextName = nameDraft.trim();
    if (!nextName) return;

    try {
      setSaving(true);

      // TODO: cuando quieras lo conectamos al backend con un PATCH /me
      // await api("/me", { method: "PATCH", body: JSON.stringify({ name: nextName }) });

      setMe((prev) =>
        prev
          ? {
              ...prev,
              user: prev.user ? { ...prev.user, name: nextName } : prev.user,
            }
          : prev
      );

      setEditingName(false);
    } finally {
      setSaving(false);
    }
  }

  function onLogout() {
    logout();
    router.push("/login");
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

      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white/90 text-sm font-semibold text-gray-800 shadow-sm">
              {avatarLabel}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Perfil
                </h1>
                <span className="rounded-full border border-gray-200 bg-white/80 px-2.5 py-1 text-xs text-gray-600">
                  Cuenta
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">Datos de tu usuario.</p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Cargando…
                </div>
                <div className="mt-1 text-sm text-gray-600">Traemos tu info.</div>
              </div>
              <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
            </div>
          </div>
        )}

        {err && !loading && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            <div className="text-base font-semibold">Ups.</div>
            <div className="mt-1">{err}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Volver al dashboard
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {!loading && !err && (
          <>
            <div className="mt-6">
              <section className="rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Cuenta
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      Lo básico (pero importante).
                    </div>
                  </div>
                  <FluxMark />
                </div>

                <div className="mt-5 space-y-4">
                  {/* Nombre editable */}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="text-xs text-gray-500">Nombre</div>

                    {!editingName ? (
                      <div className="flex items-center gap-2 sm:justify-end">
                        <div className="text-sm font-medium text-gray-900">
                          {user?.name?.trim() || "—"}
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingName(true)}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 sm:justify-end">
                        <input
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          className="h-8 w-48 rounded-md border border-gray-300 px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={saveName}
                          disabled={saving}
                          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {saving ? "Guardando…" : "Guardar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingName(false);
                            setNameDraft(user?.name || "");
                          }}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  <Row label="Email" value={user?.email || "—"} />
                  <Row label="User ID" value={user?.id || "—"} mono />
                </div>
              </section>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm">
              <div>
                <div className="text-sm font-semibold text-gray-900">Acciones</div>
                <div className="mt-1 text-sm text-gray-600">
                  Lo justo y necesario.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Volver al dashboard
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex h-9 items-center rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              © {new Date().getFullYear()} Flux
            </div>
          </>
        )}
      </div>
    </main>
  );
}