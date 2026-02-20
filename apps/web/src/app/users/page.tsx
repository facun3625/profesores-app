"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Subject = { id: string; name: string };
type Institution = { id: string; name: string };
type AccessEntry = { institution: Institution; subjects: Subject[] };
type Professor = {
    id: string;
    email: string;
    name: string | null;
    lastName: string | null;
    status: "active" | "suspended";
    mustChangePassword: boolean;
    createdAt: string;
    access: AccessEntry[];
};

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

function Badge({
    children,
    tone = "neutral",
}: {
    children: React.ReactNode;
    tone?: "neutral" | "blue" | "green" | "red" | "gray" | "yellow";
}) {
    const cls =
        tone === "blue"
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : tone === "green"
                ? "border-green-200 bg-green-50 text-green-700"
                : tone === "red"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : tone === "yellow"
                        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
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

// Simple multi-select for subjects within an institution
function SubjectMultiSelect({
    institutionId,
    selected,
    onChange,
}: {
    institutionId: string;
    selected: string[];
    onChange: (ids: string[]) => void;
}) {
    const [subjects, setSubjects] = useState<Subject[]>([]);

    useEffect(() => {
        if (!institutionId) return;
        api<Subject[]>(`/subjects?institutionId=${institutionId}`)
            .then((data) => setSubjects(Array.isArray(data) ? data : []))
            .catch(() => setSubjects([]));
    }, [institutionId]);

    if (!subjects.length) {
        return <p className="text-xs text-gray-400 mt-1">Sin materias disponibles</p>;
    }

    return (
        <div className="mt-2 grid grid-cols-2 gap-1">
            {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        onChange={(e) => {
                            if (e.target.checked) onChange([...selected, s.id]);
                            else onChange(selected.filter((id) => id !== s.id));
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 truncate">{s.name}</span>
                </label>
            ))}
        </div>
    );
}

type AccessForm = {
    institutionId: string;
    subjectIds: string[];
};

function ProfessorForm({
    institutions,
    initial,
    onSave,
    onCancel,
    loading,
}: {
    institutions: Institution[];
    initial?: Partial<{
        name: string;
        lastName: string;
        email: string;
        password: string;
        access: AccessForm[];
    }>;
    onSave: (data: any) => void;
    onCancel: () => void;
    loading: boolean;
}) {
    const [name, setName] = useState(initial?.name ?? "");
    const [lastName, setLastName] = useState(initial?.lastName ?? "");
    const [email, setEmail] = useState(initial?.email ?? "");
    const [password, setPassword] = useState(initial?.password ?? "");
    const [access, setAccess] = useState<AccessForm[]>(initial?.access ?? []);

    function addInstitution() {
        if (!institutions.length) return;
        const unused = institutions.find((i) => !access.find((a) => a.institutionId === i.id));
        if (!unused) return;
        setAccess([...access, { institutionId: unused.id, subjectIds: [] }]);
    }

    function removeInstitution(idx: number) {
        setAccess(access.filter((_, i) => i !== idx));
    }

    function updateAccess(idx: number, patch: Partial<AccessForm>) {
        setAccess(access.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
    }

    const canSave =
        name.trim() &&
        email.trim() &&
        (!initial?.email ? password.length >= 6 : true) &&
        access.length > 0 &&
        access.every((a) => a.institutionId && a.subjectIds.length > 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Juan"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Apellido</label>
                    <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Pérez"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="juan@escuela.com"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Contraseña {!initial?.email ? "* (mín. 6 caracteres)" : "(dejar vacío para no cambiar)"}
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-gray-700">Acceso a instituciones y materias *</div>
                    <button
                        type="button"
                        onClick={addInstitution}
                        className="text-xs text-blue-600 hover:underline"
                        disabled={access.length >= institutions.length}
                    >
                        + Agregar institución
                    </button>
                </div>

                {access.length === 0 && (
                    <p className="text-xs text-gray-400">
                        Agregá al menos una institución con sus materias.
                    </p>
                )}

                {access.map((a, idx) => (
                    <div key={idx} className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center gap-2">
                            <select
                                value={a.institutionId}
                                onChange={(e) => updateAccess(idx, { institutionId: e.target.value, subjectIds: [] })}
                                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                            >
                                {institutions.map((i) => (
                                    <option key={i.id} value={i.id}>
                                        {i.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => removeInstitution(idx)}
                                className="text-xs text-red-500 hover:text-red-700 shrink-0"
                            >
                                Quitar
                            </button>
                        </div>

                        <SubjectMultiSelect
                            institutionId={a.institutionId}
                            selected={a.subjectIds}
                            onChange={(ids) => updateAccess(idx, { subjectIds: ids })}
                        />

                        {a.subjectIds.length === 0 && (
                            <p className="mt-1 text-xs text-red-500">Seleccioná al menos una materia</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex gap-2 pt-2">
                <button
                    type="button"
                    disabled={!canSave || loading}
                    onClick={() =>
                        onSave({
                            name: name.trim(),
                            lastName: lastName.trim() || undefined,
                            email: email.trim(),
                            ...(password ? { password } : {}),
                            access,
                        })
                    }
                    className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                    {loading ? "Guardando..." : "Guardar"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}

export default function UsersPage() {
    const [professors, setProfessors] = useState<Professor[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    async function load() {
        setError("");
        try {
            const [profsData, instData] = await Promise.all([
                api<Professor[]>("/users/professors"),
                api<Institution[]>("/institutions"),
            ]);
            setProfessors(Array.isArray(profsData) ? profsData : []);
            setInstitutions(Array.isArray(instData) ? instData : []);
        } catch (e: any) {
            setError(e?.message || "Error cargando datos");
        } finally {
            setInitialLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function handleCreate(data: any) {
        setLoading(true);
        setError("");
        try {
            await api("/users/professors", {
                method: "POST",
                body: JSON.stringify(data),
            });
            setShowCreate(false);
            await load();
        } catch (e: any) {
            setError(e?.message || "Error creando profesor");
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdate(id: string, data: any) {
        setLoading(true);
        setError("");
        try {
            await api(`/users/professors/${id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            });
            setEditingId(null);
            await load();
        } catch (e: any) {
            setError(e?.message || "Error actualizando profesor");
        } finally {
            setLoading(false);
        }
    }

    async function toggleStatus(p: Professor) {
        setLoading(true);
        try {
            const action = p.status === "active" ? "suspend" : "activate";
            await api(`/users/professors/${p.id}/${action}`, { method: "PATCH" });
            await load();
        } catch (e: any) {
            setError(e?.message || "Error");
        } finally {
            setLoading(false);
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return professors;
        return professors.filter(
            (p) =>
                (p.name ?? "").toLowerCase().includes(q) ||
                (p.lastName ?? "").toLowerCase().includes(q) ||
                p.email.toLowerCase().includes(q)
        );
    }, [professors, search]);

    return (
        <main className="min-h-[calc(100vh-64px)] px-6 py-8">
            <div className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-50 via-white to-gray-100" />

            <div className="mx-auto w-full max-w-6xl">
                {/* Header */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-blue-900">
                            Profesores
                        </h1>
                        <p className="mt-1 text-sm text-gray-600">
                            Gestioná el acceso de tus profesores a instituciones y materias.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge tone="blue">{professors.length} total</Badge>
                        {!showCreate && (
                            <button
                                type="button"
                                onClick={() => { setShowCreate(true); setEditingId(null); }}
                                className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                + Nuevo profesor
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Create form */}
                {showCreate && (
                    <section className="mt-6 rounded-2xl border border-blue-200 bg-white/90 p-6 shadow-sm">
                        <div className="mb-4 text-sm font-semibold text-gray-900">Nuevoprofesor</div>
                        <ProfessorForm
                            institutions={institutions}
                            onSave={handleCreate}
                            onCancel={() => setShowCreate(false)}
                            loading={loading}
                        />
                    </section>
                )}

                {/* List */}
                <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-1 rounded-full bg-blue-600" />
                            <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                                Tus Profesores
                            </div>
                        </div>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nombre o email…"
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:w-[280px]"
                        />
                    </div>

                    {initialLoading ? (
                        <div className="px-6 py-8 text-sm text-gray-500">Cargando…</div>
                    ) : filtered.length === 0 ? (
                        <div className="px-6 py-8 text-sm text-gray-500">
                            No hay profesores todavía. Creá uno con el botón de arriba.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filtered.map((p) => {
                                const isEditing = editingId === p.id;
                                const fullName = [p.name, p.lastName].filter(Boolean).join(" ") || p.email;

                                return (
                                    <div key={p.id} className="px-6 py-4">
                                        {isEditing ? (
                                            <div>
                                                <div className="mb-3 text-sm font-semibold text-gray-900">
                                                    Editando: {fullName}
                                                </div>
                                                <ProfessorForm
                                                    institutions={institutions}
                                                    initial={{
                                                        name: p.name ?? "",
                                                        lastName: p.lastName ?? "",
                                                        email: p.email,
                                                        access: p.access.map((a) => ({
                                                            institutionId: a.institution.id,
                                                            subjectIds: a.subjects.map((s) => s.id),
                                                        })),
                                                    }}
                                                    onSave={(data) => handleUpdate(p.id, data)}
                                                    onCancel={() => setEditingId(null)}
                                                    loading={loading}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            {fullName}
                                                        </span>
                                                        <Badge tone={p.status === "active" ? "green" : "red"}>
                                                            {p.status === "active" ? "Activo" : "Suspendido"}
                                                        </Badge>
                                                        {p.mustChangePassword && (
                                                            <Badge tone="yellow">Debe cambiar contraseña</Badge>
                                                        )}
                                                    </div>

                                                    <div className="mt-0.5 text-xs text-gray-500">{p.email}</div>

                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {p.access.map((a) => (
                                                            <div key={a.institution.id} className="text-xs text-gray-600">
                                                                <span className="font-medium text-gray-800">
                                                                    {a.institution.name}:
                                                                </span>{" "}
                                                                {a.subjects.map((s) => s.name).join(", ") || "—"}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingId(p.id); setShowCreate(false); }}
                                                        className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleStatus(p)}
                                                        disabled={loading}
                                                        className={cn(
                                                            "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium disabled:opacity-60",
                                                            p.status === "active"
                                                                ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                                                : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                                        )}
                                                    >
                                                        {p.status === "active" ? "Suspender" : "Activar"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
