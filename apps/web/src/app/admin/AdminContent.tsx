"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";

function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(" ");
}

type GlobalStats = {
    totalUsers: number;
    totalInstitutions: number;
    totalExams: number;
    totalQuestions: number;
};

type InstitutionStats = {
    id: string;
    name: string;
    plan: string;
    status: string;
    subjectsCount: number;
    topicsCount: number;
    questionsCount: number;
    membersCount: number;
    admin: {
        id: string;
        name: string;
        lastName: string;
        email: string;
        plan: string;
    } | null;
};


type UserStats = {
    id: string;
    email: string;
    name: string;
    lastName: string;
    status: string;
    globalRole: string;
    plan: string;
    memberships: Array<{
        institution: { id: string, name: string };
        role: string;
    }>;
};

const AdminIcons = {
    Users: () => (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        </div>
    ),
    Institutions: () => (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
            </svg>
        </div>
    ),
    Exams: () => (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        </div>
    ),
    Questions: () => (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        </div>
    ),
};

export function AdminContent() {
    const queryClient = useQueryClient();
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'institutions' | 'users'>('users');
    const [planFilter, setPlanFilter] = useState<'ALL' | 'FREE' | 'FULL' | 'PREMIUM'>('ALL');

    const { data: stats } = useQuery<GlobalStats>({
        queryKey: ["admin", "stats"],
        queryFn: () => api("/admin/stats"),
    });

    const { data: institutions } = useQuery<InstitutionStats[]>({
        queryKey: ["admin", "institutions"],
        queryFn: () => api("/admin/institutions"),
    });

    const { data: users } = useQuery<UserStats[]>({
        queryKey: ["admin", "users"],
        queryFn: () => api("/admin/users"),
    });

    const updatePlan = useMutation({
        mutationFn: ({ userId, plan }: { userId: string; plan: string }) =>
            api(`/admin/users/${userId}/plan`, {
                method: "PATCH",
                body: JSON.stringify({ plan }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "institutions"] });
            queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
            setUpdatingId(null);
            // Notificar al layout para que refresque el plan en el header si el admin es el usuario actual
            window.dispatchEvent(new CustomEvent("me:updated"));
        },
    });

    const updateInstStatus = useMutation({
        mutationFn: ({ institutionId, status }: { institutionId: string; status: string }) =>
            api(`/admin/institutions/${institutionId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "institutions"] });
        },
    });

    const updateUserStatus = useMutation({
        mutationFn: ({ userId, status }: { userId: string; status: string }) =>
            api(`/admin/users/${userId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
            // Notificar al layout para que refresque el plan en el header
            window.dispatchEvent(new CustomEvent("me:updated"));
        },
    });

    const deleteInstitution = useMutation({
        mutationFn: (institutionId: string) =>
            api(`/admin/institutions/${institutionId}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "institutions"] });
            queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        },
    });

    const deleteUser = useMutation({
        mutationFn: (userId: string) =>
            api(`/admin/users/${userId}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
            queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
        },
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: "Usuarios Sistema", value: stats?.totalUsers, icon: AdminIcons.Users },
                    { label: "Instituciones", value: stats?.totalInstitutions, icon: AdminIcons.Institutions },
                    { label: "Exámenes Generales", value: stats?.totalExams, icon: AdminIcons.Exams },
                    { label: "Bancos de Preguntas", value: stats?.totalQuestions, icon: AdminIcons.Questions },
                ].map((s) => (
                    <div key={s.label} className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <s.icon />
                            <div className="h-2 w-2 rounded-full bg-blue-500/20 group-hover:bg-blue-500 transition-colors" />
                        </div>
                        <div className="mt-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">{s.label}</p>
                            <p className="mt-1 text-4xl font-black text-gray-900 dark:text-white tracking-tighter">
                                {s.value !== undefined ? s.value : "..."}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content Tabs */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex gap-2 p-1 rounded-xl bg-gray-100/50 dark:bg-slate-800/50">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'users'
                                ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-white'
                                : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                                }`}
                        >
                            Usuarios Directos
                        </button>
                        <button
                            onClick={() => setActiveTab('institutions')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'institutions'
                                ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-white'
                                : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                                }`}
                        >
                            Instituciones
                        </button>
                    </div>

                    {activeTab === 'users' && (
                        <div className="flex gap-1.5 p-1 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800">
                            {['ALL', 'FREE', 'FULL', 'PREMIUM'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPlanFilter(p as any)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all",
                                        planFilter === p
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                            : "text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                                    )}
                                >
                                    {p === 'ALL' ? 'Todos' : p}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {activeTab === 'institutions' ? (
                    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all animate-in slide-in-from-bottom-2">
                        <div className="border-b border-gray-100 bg-gray-50/50 px-8 py-5 dark:border-slate-800 dark:bg-slate-800/30">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">Gestión Global de Clientes</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/20 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:border-slate-800 dark:bg-slate-900/50">
                                        <th className="px-8 py-4">Suscripción / Admin</th>
                                        <th className="px-8 py-4 text-center">Snapshot de Uso</th>
                                        <th className="px-8 py-4">Estado Operativo</th>
                                        <th className="px-8 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {institutions?.map((inst: InstitutionStats) => (
                                        <tr key={inst.id} className="group transition-colors hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{inst.name}</span>
                                                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-tighter">
                                                        {inst.admin ? `${inst.admin.name} ${inst.admin.lastName} • ${inst.admin.email}` : "SIN ADMINISTRADOR"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex justify-center gap-2">
                                                    <div className="flex flex-col items-center p-2 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 min-w-[60px]">
                                                        <span className="text-xs font-black text-blue-700 dark:text-blue-400">{inst.subjectsCount}</span>
                                                        <span className="text-[8px] font-bold text-blue-400 uppercase">Materias</span>
                                                    </div>
                                                    <div className="flex flex-col items-center p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 min-w-[60px]">
                                                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">{inst.topicsCount}</span>
                                                        <span className="text-[8px] font-bold text-emerald-400 uppercase">Temas</span>
                                                    </div>
                                                    <div className="flex flex-col items-center p-2 rounded-xl bg-purple-50/50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/10 min-w-[60px]">
                                                        <span className="text-xs font-black text-purple-700 dark:text-purple-400">{inst.questionsCount}</span>
                                                        <span className="text-[8px] font-bold text-purple-400 uppercase">Preguntas</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <button
                                                    onClick={() => updateInstStatus.mutate({
                                                        institutionId: inst.id,
                                                        status: inst.status === 'active' ? 'inactive' : 'active'
                                                    })}
                                                    className={`inline-flex rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] transition-all hover:scale-105 active:scale-95 shadow-sm ${inst.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                                        }`}
                                                >
                                                    {inst.status === 'active' ? '● En Línea' : '○ Suspendida'}
                                                </button>
                                            </td>
                                            <td className="px-8 py-5 text-right text-xs font-bold text-gray-400 dark:text-slate-600">
                                                Gestión vía Usuario
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all animate-in slide-in-from-bottom-2">
                        <div className="border-b border-gray-100 bg-gray-50/50 px-8 py-5 dark:border-slate-800 dark:bg-slate-800/30">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">Control de Usuarios Registrados</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">Nombre / Email</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">Institucional</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">Gestión de Plan</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">Estado</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">Borrado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {users?.filter(u => {
                                        if (planFilter === 'ALL') return true;
                                        return u.plan === planFilter;
                                    }).map((u: UserStats) => (
                                        <tr key={u.id} className="group transition-colors hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{u.name} {u.lastName}</span>
                                                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-tighter">{u.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col gap-1.5">
                                                    {u.memberships.map((m: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-1.5">
                                                            <span className="inline-flex h-5 px-1.5 items-center rounded bg-blue-50 text-[8px] font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
                                                                {m.institution.name}
                                                            </span>
                                                            <span className="inline-flex h-4 px-1 items-center rounded bg-gray-100 text-[6px] font-black text-gray-400 dark:bg-slate-800 dark:text-slate-500 uppercase tracking-tighter">
                                                                {m.role}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {u.globalRole === 'ADMIN' && (
                                                        <span className="w-fit inline-flex h-5 px-1.5 items-center rounded bg-amber-100 text-[8px] font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">SUPER ADMIN</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex gap-1">
                                                    {[
                                                        { id: 'FREE', color: 'blue', label: 'FREE' },
                                                        { id: 'FULL', color: 'emerald', label: 'FULL' },
                                                        { id: 'PREMIUM', color: 'amber', label: 'PREM' }
                                                    ].map((p) => (
                                                        <button
                                                            key={p.id}
                                                            disabled={updatingId === u.id}
                                                            onClick={() => {
                                                                setUpdatingId(u.id);
                                                                updatePlan.mutate({ userId: u.id, plan: p.id });
                                                            }}
                                                            className={cn(
                                                                "h-6 px-2 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all border",
                                                                u.plan === p.id
                                                                    ? p.color === 'blue' ? "bg-blue-600 text-white border-blue-700 shadow-sm" :
                                                                        p.color === 'emerald' ? "bg-emerald-600 text-white border-emerald-700 shadow-sm" :
                                                                            "bg-amber-500 text-white border-amber-600 shadow-sm"
                                                                    : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 dark:hover:bg-slate-700"
                                                            )}
                                                        >
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <button
                                                    onClick={() => updateUserStatus.mutate({
                                                        userId: u.id,
                                                        status: u.status === 'active' ? 'suspended' : 'active'
                                                    })}
                                                    className={`inline-flex rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] transition-all hover:scale-105 active:scale-95 shadow-sm ${u.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                                        }`}
                                                >
                                                    {u.status === 'active' ? '● ACTIVO' : '○ SUSPENDIDO'}
                                                </button>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={() => {
                                                        if (confirm("🚨 PELIGRO: ¿Borrar usuario? Esto eliminará PERMANENTEMENTE su cuenta y TODA su actividad. No hay vuelta atrás.")) {
                                                            deleteUser.mutate(u.id);
                                                        }
                                                    }}
                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-all dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
