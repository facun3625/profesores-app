"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDashboardData } from "@/lib/hooks";
import { StatCardSkeleton } from "@/components/Skeleton";

function safeLSGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function StatCard({
  title,
  value,
  href,
  subtitle,
  context,
}: {
  title: string;
  value: number | string;
  href: string;
  subtitle?: string;
  context?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-gray-500">{title}</div>
        {context ? (
          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
            {context}
          </span>
        ) : null}
      </div>

      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
        {value}
      </div>

      {subtitle ? <div className="mt-1 text-xs text-gray-500">{subtitle}</div> : null}

      <div className="mt-4 text-sm font-medium text-blue-600 group-hover:underline">
        Ver {title.toLowerCase()} →
      </div>
    </Link>
  );
}

function ActionCard({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="text-base font-semibold tracking-tight text-gray-900">
        {title}
      </div>
      <div className="mt-1 text-sm text-gray-600">{desc}</div>
      <div className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Empezar
      </div>
    </Link>
  );
}

export default function Home() {
  const { data, isLoading, error } = useDashboardData();

  const activeInstitutionName = useMemo(() => {
    return (safeLSGet("activeInstitutionName") || "").trim();
  }, []);

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
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Panel de control con datos en tiempo real.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error instanceof Error ? error.message : "No se pudo cargar el dashboard"}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                subtitle="Sedes y acceso"
              />
              <StatCard
                title="Materias"
                value={data?.subjects.length ?? 0}
                href="/subjects"
                subtitle="Materias + temas"
                context={activeInstitutionName ? `en ${activeInstitutionName}` : undefined}
              />
              <StatCard
                title="Exámenes"
                value={data?.exams.length ?? 0}
                href="/exams"
                subtitle="Listos y generados"
                context={activeInstitutionName ? `en ${activeInstitutionName}` : undefined}
              />
            </>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">
            Acciones rápidas
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Lo que más se usa, a dos clicks.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ActionCard
              title="Crear examen automático"
              desc="Elegí materia/temas y generalo desde el banco."
              href="/exams/builder"
            />
            <ActionCard
              title="Crear examen manual"
              desc="Control total sobre cada pregunta."
              href="/exams/manual"
            />
          </div>
        </section>
      </div>
    </main>
  );
}