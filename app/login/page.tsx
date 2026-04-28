"use client";

import { useState } from "react";

export default function LoginPage() {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  async function loginAs(role: "admin" | "scanner") {
    setLoadingRole(role);
    try {
      await fetch("/api/auth/dev-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      window.location.href = role === "admin" ? "/admin" : "/scanner";
    } finally {
      setLoadingRole(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-10">
      <div className="card space-y-4 p-6">
        <h1 className="text-3xl font-bold text-slate-900">Login</h1>
        <p className="text-slate-600">
          Supabase Auth is wired for next step integration. Add your keys in `.env.local` and replace this
          placeholder page with email/password or magic-link auth.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => loginAs("admin")}
            className="btn-primary"
            disabled={loadingRole !== null}
          >
            {loadingRole === "admin" ? "Signing in..." : "Login as Admin"}
          </button>
          <button
            onClick={() => loginAs("scanner")}
            className="btn-secondary"
            disabled={loadingRole !== null}
          >
            {loadingRole === "scanner" ? "Signing in..." : "Login as Scanner"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          For now, this is a dev role login helper. Enable real auth by setting `ENABLE_AUTH=true` and
          integrating Supabase session checks.
        </p>
      </div>
    </div>
  );
}
