"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/auth";

function ProflyLogo() {
  return (
    <div className="select-none text-center">
      <div
        className="text-4xl font-semibold tracking-tight text-blue-600 font-[family-name:var(--font-logo)]"
      >
        profly
      </div>
      <div className="mt-1 text-xs text-gray-500">
        Instituciones · Exámenes · Gestión
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Poné tu nombre.");
    if (!lastName.trim()) return setError("Poné tu apellido.");
    if (!institutionName.trim()) return setError("Poné el nombre de la institución.");
    if (!email.trim()) return setError("Poné tu email.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");

    setLoading(true);
    try {
      await register(email.trim(), password, name.trim(), lastName.trim(), institutionName.trim());
      router.push("/");
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("already exists") || msg.includes("Conflict")) {
        setError("Ese email ya está registrado.");
      } else if (msg.includes("Network Error") || msg.includes("fetch")) {
        setError("Error de conexión. Verificá tu internet.");
      } else {
        setError(msg || "Ocurrió un error al intentar registrarte.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4">
      {/* Fondo con gradient + grid sutil */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-50 via-white to-gray-100" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="min-h-screen flex justify-center pt-[60px] md:pt-32">
        <div className="w-full max-w-md px-4">
          <div className="mb-6">
            <ProflyLogo />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-6 shadow-sm">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
              <p className="mt-1 text-sm text-gray-500">
                Creá tu usuario y tu institución inicial
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800">Apellido</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tu apellido"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800">Institución</label>
                <input
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Nombre de la institución"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-xs text-gray-500">
                  Podés cambiarla o sumar más instituciones después.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="email@ejemplo.com"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800">Contraseña</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Creando..." : "Registrarme"}
              </button>

              <div className="text-center text-sm text-gray-600">
                ¿Ya tenés cuenta?{" "}
                <a href="/login" className="font-medium text-blue-600 hover:underline">
                  Iniciar sesión
                </a>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500 font-[family-name:var(--font-logo)]">
            © {new Date().getFullYear()} profly
          </div>
        </div>
      </div>
    </main>
  );
}