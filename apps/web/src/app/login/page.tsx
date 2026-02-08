"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("test+auth8@test.com");
  const [password, setPassword] = useState("12345678");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      router.push("/"); // ✅ al root
    } catch (err: any) {
      setError(err?.message ?? "Login error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 420, fontFamily: "system-ui" }}>
      <h1>Login</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            type="email"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
          />
        </label>

        <button disabled={loading} type="submit">
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        <div style={{ fontSize: 13, opacity: 0.8 }}>
          ¿No tenés cuenta? <a href="/register">Crear cuenta</a>
        </div>
      </form>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}
    </main>
  );
}