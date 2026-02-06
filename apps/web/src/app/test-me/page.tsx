"use client";

import { useEffect } from "react";
import { login } from "@/lib/auth";
import { getMe } from "@/lib/auth";

export default function TestMePage() {
  useEffect(() => {
    async function run() {
      await login("TU_EMAIL", "TU_PASSWORD");
      const me = await getMe();
      console.log("ME:", me);
    }

    run().catch(console.error);
  }, []);

  return <div>Login + /auth/me (mirá la consola)</div>;
}