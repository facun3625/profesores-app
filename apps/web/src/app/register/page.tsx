"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/auth";

export default function Page() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Poné tu nombre.");
    if (!institutionName.trim()) return setError("Poné el nombre de la institución.");
    if (!email.trim()) return setError("Poné tu email.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");

    setLoading(true);
    try {
      await register(email.trim(), password, name.trim(), institutionName.trim());
      router.push("/"); // ✅ al root (y ya pasa middleware por cookie)
    } catch (e: any) {
      setError(e?.message ?? "Error registrando usuario");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1>Crear cuenta</h1>

      {error && (
        <div style={{ border: "1px solid red", padding: 10, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Institución
          <input
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Creando..." : "Registrarme"}
        </button>

        <div style={{ fontSize: 13, opacity: 0.8 }}>
          ¿Ya tenés cuenta? <a href="/login">Iniciar sesión</a>
        </div>
      </form>
    </main>
  );
}