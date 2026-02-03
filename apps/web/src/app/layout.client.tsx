"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Institution = {
  id: string;
  name: string;
};

type MeResponse = {
  user: {
    activeInstitutionId?: string | null;
  };
  institutions: Institution[];
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    api<MeResponse>("/me")
      .then(setMe)
      .catch(() => {});
  }, []);

  const activeInstitution =
    me?.institutions.find(
      (i) => i.id === me.user.activeInstitutionId
    )?.name || "—";

  return (
    <>
      <header
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 700 }}>Profesores App</div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ opacity: 0.8 }}>
            Institución activa: <b>{activeInstitution}</b>
          </span>
          <a href="/institutions">Cambiar</a>
        </div>
      </header>

      <main>{children}</main>
    </>
  );
}
