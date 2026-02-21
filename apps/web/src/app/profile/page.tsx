"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout } from "@/lib/auth";
import { api } from "@/lib/api";

type MeResponse = {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    lastName?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    activeInstitutionId?: string | null;
  };
};

type FieldKey = "name" | "lastName" | "city" | "province" | "country";

function ProflyMark() {
  return (
    <div className="select-none">
      <div
        className="text-xl font-semibold tracking-tight text-blue-600"
        style={{
          fontFamily:
            "'Montserrat Alternates','Inter','Helvetica Neue',Arial,sans-serif",
        }}
      >
        profly
      </div>
      <div className="mt-0.5 text-xs text-gray-500">Perfil</div>
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

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function FieldRowPro({
  label,
  value,
  editing,
  draft,
  onEdit,
  onCancel,
  onSave,
  onDraftChange,
  saving,
}: {
  label: string;
  value: string;
  editing: boolean;
  draft: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDraftChange: (v: string) => void;
  saving: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-white/70 px-4 py-3 sm:grid-cols-[180px_1fr_auto] sm:items-center">
      <div className="text-xs font-medium text-gray-500">{label}</div>

      {!editing ? (
        <div className="text-sm font-medium text-gray-900">
          {value.trim() ? value : <span className="text-gray-400">—</span>}
        </div>
      ) : (
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          autoFocus
        />
      )}

      <div className="flex gap-2 sm:justify-end">
        {!editing ? (
          <button
            type="button"
            onClick={onEdit}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Editar
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={cn(
                "h-9 rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700",
                saving && "opacity-60"
              )}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className={cn(
                "h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50",
                saving && "opacity-60"
              )}
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const user = me?.user;

  const avatarLabel = useMemo(() => {
    const base = user?.name?.trim() || user?.email || "";
    return initials(base);
  }, [user?.name, user?.email]);

  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState<Record<FieldKey, string>>({
    name: "",
    lastName: "",
    city: "",
    province: "",
    country: "",
  });
  const [savingField, setSavingField] = useState<FieldKey | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = (await getMe()) as any;
        if (cancelled) return;
        setMe(r);
        setErr(null);

        const u = r?.user;
        setDraft({
          name: u?.name ?? "",
          lastName: u?.lastName ?? "",
          city: u?.city ?? "",
          province: u?.province ?? "",
          country: u?.country ?? "",
        });

        try {
          localStorage.setItem("me", JSON.stringify(r));
        } catch { }
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

  function onLogout() {
    logout();
    router.push("/login");
  }

  function startEdit(k: FieldKey) {
    if (!user) return;
    setErr(null);
    setEditing(k);
    setDraft((p) => ({
      ...p,
      [k]: (user as any)[k] ?? "",
    }));
  }

  function cancelEdit() {
    if (!user) {
      setEditing(null);
      return;
    }
    const k = editing;
    if (!k) return;

    setDraft((p) => ({
      ...p,
      [k]: (user as any)[k] ?? "",
    }));
    setEditing(null);
  }

  async function saveField(k: FieldKey) {
    if (!user) return;

    const value = draft[k].trim();

    try {
      setSavingField(k);
      setErr(null);

      const updated = await api(`/auth/me`, {
        method: "PATCH",
        body: JSON.stringify({
          [k]: value ? value : null,
        }),
      });

      setMe((prev) => {
        if (!prev) return prev;

        const next = {
          ...prev,
          user: prev.user ? { ...prev.user, ...(updated as any) } : prev.user,
        };

        // ✅ Esto hace que la barra/header se entere (y pueda re-leer)
        try {
          localStorage.setItem("me", JSON.stringify(next));
          window.dispatchEvent(new Event("me:updated"));
        } catch { }

        return next;
      });

      setEditing(null);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo guardar el perfil");
    } finally {
      setSavingField(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {err ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {err}
        </div>
      ) : null}

      <div className="mt-6">
        <section className="rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Cuenta</div>
              <div className="mt-1 text-sm text-gray-600">
                Edición por campo (sin romper nada).
              </div>
            </div>
            <ProflyMark />
          </div>

          <div className="mt-5 grid gap-3">
            <FieldRowPro
              label="Nombre"
              value={user?.name ?? ""}
              editing={editing === "name"}
              draft={draft.name}
              onEdit={() => startEdit("name")}
              onCancel={cancelEdit}
              onSave={() => saveField("name")}
              onDraftChange={(v) => setDraft((p) => ({ ...p, name: v }))}
              saving={savingField === "name"}
            />
            <FieldRowPro
              label="Apellido"
              value={user?.lastName ?? ""}
              editing={editing === "lastName"}
              draft={draft.lastName}
              onEdit={() => startEdit("lastName")}
              onCancel={cancelEdit}
              onSave={() => saveField("lastName")}
              onDraftChange={(v) =>
                setDraft((p) => ({ ...p, lastName: v }))
              }
              saving={savingField === "lastName"}
            />
            <FieldRowPro
              label="Ciudad"
              value={user?.city ?? ""}
              editing={editing === "city"}
              draft={draft.city}
              onEdit={() => startEdit("city")}
              onCancel={cancelEdit}
              onSave={() => saveField("city")}
              onDraftChange={(v) => setDraft((p) => ({ ...p, city: v }))}
              saving={savingField === "city"}
            />
            <FieldRowPro
              label="Provincia"
              value={user?.province ?? ""}
              editing={editing === "province"}
              draft={draft.province}
              onEdit={() => startEdit("province")}
              onCancel={cancelEdit}
              onSave={() => saveField("province")}
              onDraftChange={(v) =>
                setDraft((p) => ({ ...p, province: v }))
              }
              saving={savingField === "province"}
            />
            <FieldRowPro
              label="País"
              value={user?.country ?? ""}
              editing={editing === "country"}
              draft={draft.country}
              onEdit={() => startEdit("country")}
              onCancel={cancelEdit}
              onSave={() => saveField("country")}
              onDraftChange={(v) =>
                setDraft((p) => ({ ...p, country: v }))
              }
              saving={savingField === "country"}
            />

            <div className="mt-2 grid gap-2 rounded-xl border border-gray-200 bg-white/70 px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-xs font-medium text-gray-500">Email</div>
                <div className="text-sm font-medium text-gray-900">
                  {user?.email || "—"}
                </div>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-xs font-medium text-gray-500">User ID</div>
                <div className="font-mono text-[12px] text-gray-700">
                  {user?.id || "—"}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm">
        <div>
          <div className="text-sm font-semibold text-gray-900">Acciones</div>
          <div className="mt-1 text-sm text-gray-600">Lo justo y necesario.</div>
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
        © {new Date().getFullYear()} profly
      </div>
    </div>
  );
}