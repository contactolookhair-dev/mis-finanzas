"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

export default function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tokenMissing = !token || token.trim().length < 16;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg items-center px-4 py-10">
      <SurfaceCard className="w-full space-y-5" variant="soft">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Mis Finanzas</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Restablecer contraseña</h1>
          <p className="text-sm text-neutral-600">Crea una nueva contraseña para tu cuenta.</p>
        </div>

        {tokenMissing ? (
          <SurfaceCard
            variant="soft"
            padding="sm"
            className="border-rose-200/80 bg-rose-50/80 text-rose-700"
          >
            <p className="text-sm font-medium">El link no es válido o está incompleto.</p>
          </SurfaceCard>
        ) : done ? (
          <SurfaceCard
            variant="soft"
            padding="sm"
            className="border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
          >
            <p className="text-sm font-medium">Contraseña actualizada. Ya puedes iniciar sesión.</p>
          </SurfaceCard>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);

              if (password.length < 8) {
                setError("La contraseña debe tener al menos 8 caracteres.");
                return;
              }
              if (password !== confirm) {
                setError("Las contraseñas no coinciden.");
                return;
              }

              setLoading(true);
              try {
                const res = await fetch("/api/auth/reset-password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token, password })
                });
                const payload = (await res.json().catch(() => null)) as { message?: string } | null;
                if (!res.ok) {
                  setError(payload?.message ?? "No se pudo restablecer la contraseña.");
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
                Nueva contraseña
              </label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Confirmar contraseña
              </label>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
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
              {loading ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
        )}

        <p className="text-sm text-neutral-600">
          <a href="/login" className="font-semibold text-slate-900 underline underline-offset-4">
            Volver a iniciar sesión
          </a>
        </p>
      </SurfaceCard>
    </div>
  );
}

