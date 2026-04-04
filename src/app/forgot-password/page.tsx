"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg items-center px-4 py-10">
      <SurfaceCard className="w-full space-y-5" variant="soft">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Mis Finanzas</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Recuperar contraseña</h1>
          <p className="text-sm text-neutral-600">
            Ingresa tu email y te enviaremos un link para restablecer tu contraseña.
          </p>
        </div>

        {done ? (
          <SurfaceCard
            variant="soft"
            padding="sm"
            className="border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
          >
            <p className="text-sm font-medium">
              Si el email existe, te enviamos un link para restablecer tu contraseña.
            </p>
          </SurfaceCard>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              try {
                const res = await fetch("/api/auth/forgot-password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email })
                });
                const payload = (await res.json().catch(() => null)) as { message?: string } | null;
                if (!res.ok) {
                  setError(payload?.message ?? "No se pudo procesar la solicitud.");
                  return;
                }
                setDone(true);
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Email
              </label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
              />
            </div>

            {error ? (
              <SurfaceCard
                variant="soft"
                padding="sm"
                className="border-rose-200/80 bg-rose-50/80 text-rose-700"
              >
                <p className="text-sm font-medium">{error}</p>
              </SurfaceCard>
            ) : null}

            <Button className="w-full rounded-full" type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
          </form>
        )}

        <p className="text-sm text-neutral-600">
          ¿Recordaste tu contraseña?{" "}
          <a href="/login" className="font-semibold text-slate-900 underline underline-offset-4">
            Volver a iniciar sesión
          </a>
        </p>
      </SurfaceCard>
    </div>
  );
}

