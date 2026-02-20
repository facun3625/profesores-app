"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDashboardData } from "@/lib/hooks";
import { StatCardSkeleton } from "@/components/Skeleton";

function safeLSGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// --- Dashboard Icons ---
const DashIcons = {
  Institutions: () => (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    </div>
  ),
  Subjects: () => (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    </div>
  ),
  Exams: () => (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    </div>
  ),
  Sparkles: () => (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M12 3l1.912 5.813L21 10.75l-5.813 1.912L12 21l-1.912-5.813L3 13.25l5.813-1.912L12 3z" />
      </svg>
    </div>
  ),
  Hammer: () => (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-700 shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    </div>
  )
};

function StatCard({
  title,
  value,
  href,
  subtitle,
  context,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  href: string;
  subtitle?: string;
  context?: string;
  icon: React.ComponentType;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/50"
    >
      <div>
        <div className="flex items-center justify-between">
          <Icon />
          {context && (
            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {context}
            </span>
          )}
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900">{value}</span>
            {subtitle && <span className="text-xs text-gray-400 font-medium">{subtitle}</span>}
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-1 text-sm font-semibold text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
        Explorar {title.toLowerCase()}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <path d="M5 12h14m-7-7 7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function ActionCard({
  title,
  desc,
  href,
  icon: Icon,
  primary,
}: {
  title: string;
  desc: string;
  href: string;
  icon: React.ComponentType;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-6 transition-all hover:shadow-lg",
        primary
          ? "border-blue-100 bg-blue-50/50 ring-1 ring-blue-100 hover:bg-blue-50"
          : "border-gray-100 bg-white hover:bg-gray-50"
      )}
    >
      <div className="flex items-start gap-5">
        <Icon />
        <div className="flex-1">
          <h4 className="text-lg font-bold text-gray-900">{title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{desc}</p>
          <div className={cn(
            "mt-4 inline-flex items-center gap-2 text-sm font-bold transition-colors",
            primary ? "text-blue-600" : "text-gray-400 group-hover:text-gray-900"
          )}>
            Comenzar ahora
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M5 12h14m-7-7 7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { data, isLoading, error } = useDashboardData();
  const [activeInstitutionName, setActiveInstitutionName] = useState("");

  useEffect(() => {
    setActiveInstitutionName(safeLSGet("activeInstitutionName") || "");
    const sync = () => setActiveInstitutionName(safeLSGet("activeInstitutionName") || "");
    window.addEventListener("active-institution-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("active-institution-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error instanceof Error ? error.message : "No se pudo cargar el dashboard"}
        </div>
      )}

      {/* Stats Section */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Instituciones"
              value={data?.institutions.length ?? 0}
              href="/institutions"
              subtitle="Activas"
              icon={DashIcons.Institutions}
            />
            <StatCard
              title="Materias"
              value={data?.subjects.length ?? 0}
              href="/subjects"
              subtitle="En total"
              context={activeInstitutionName ? activeInstitutionName : undefined}
              icon={DashIcons.Subjects}
            />
            <StatCard
              title="Exámenes"
              value={data?.exams.length ?? 0}
              href="/exams"
              subtitle="Generados"
              context={activeInstitutionName ? activeInstitutionName : undefined}
              icon={DashIcons.Exams}
            />
          </>
        )}
      </section>

      {/* Actions Section */}
      <section className="space-y-6 pt-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Acciones Pro</h2>
          <p className="text-sm text-gray-500">Genera contenido de alta calidad en segundos.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <ActionCard
            primary
            title="Generador IA de Exámenes"
            desc="Ahorra horas de trabajo. Deja que nuestra IA seleccione y organice las mejores preguntas según tus necesidades."
            href="/exams/builder"
            icon={DashIcons.Sparkles}
          />
          <ActionCard
            title="Generador Manual de Exámenes"
            desc="Control absoluto. Elige cada pregunta a mano desde tu repositorio para un examen perfectamente personalizado."
            href="/exams/manual"
            icon={DashIcons.Hammer}
          />
        </div>
      </section>
    </div>
  );
}