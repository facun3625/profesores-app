"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/auth";


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
    <main className="min-h-screen flex">
      {/* Panel Izquierdo: Branding (Solo en Desktop) */}
      <div className="hidden lg:flex lg:w-[40%] flex-col items-center justify-center bg-blue-600 p-12 text-white relative h-screen sticky top-0 shadow-2xl z-10">
        <div className="max-w-md text-center space-y-3">
          <div className="text-5xl font-medium font-logo">
            profly
          </div>
          <p className="text-lg font-medium opacity-80">
            Gestión Inteligente de Exámenes
          </p>
        </div>

        {/* Decoración sutil */}
        <div className="absolute inset-x-0 bottom-12 text-center text-sm opacity-60 font-[family-name:var(--font-logo)]">
          © {new Date().getFullYear()} profly
        </div>
      </div>

      {/* Panel Derecho: Formulario Estilo DonWeb */}
      <div className="flex-1 flex flex-col justify-center items-center relative overflow-hidden bg-white">
        <div className="w-full max-w-md px-8 pb-12 -mt-12">
          {/* Logo móvil (Solo visible en pantallas pequeñas) */}
          <div className="mb-10 lg:hidden text-center">
            <span className="text-4xl font-medium text-blue-600 font-logo">profly</span>
          </div>

          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Crear cuenta</h1>
              <p className="mt-2 text-sm text-gray-500">
                ¿Ya tienes cuenta?{" "}
                <a href="/login" className="text-blue-600 font-semibold hover:underline">
                  Iniciá sesión aquí
                </a>
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-50 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full h-12 rounded-xl border border-gray-100 bg-gray-50/50 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900"
                  />
                </div>

                <div className="space-y-1">
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Tu apellido"
                    className="w-full h-12 rounded-xl border border-gray-100 bg-gray-50/50 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <input
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Nombre de la institución"
                  className="w-full h-12 rounded-xl border border-gray-100 bg-gray-50/50 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900"
                />
                <p className="text-[11px] text-gray-400 mt-1 pl-1">
                  Ej: Colegio San José, Instituto Técnico, etc.
                </p>
              </div>

              <div className="space-y-1">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Email institucional o personal"
                  className="w-full h-12 rounded-xl border border-gray-100 bg-gray-50/50 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900"
                />
              </div>

              <div className="space-y-1">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Elegí una contraseña (mín. 8 caracteres)"
                  className="w-full h-12 rounded-xl border border-gray-100 bg-gray-50/50 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/10 transition-all hover:bg-blue-700 hover:shadow-blue-500/20 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none mt-2"
              >
                {loading ? "Creando..." : "Crear mi cuenta"}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center lg:hidden">
            <p className="text-xs text-gray-400 font-[family-name:var(--font-logo)]">
              © {new Date().getFullYear()} profly
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}