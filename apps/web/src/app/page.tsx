export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Profesores App</h1>

      <p style={{ marginBottom: 20, opacity: 0.8 }}>
        Panel principal
      </p>

      <ul style={{ display: "grid", gap: 12, maxWidth: 320 }}>
        <li>
          <a href="/institutions">Instituciones</a>
        </li>
        <li>
          <a href="/subjects">Materias</a>
        </li>
        <li>
          <a href="/exams/builder">Crear examen</a>
        </li>
      </ul>
    </main>
  );
}
