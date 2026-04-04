"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg items-center px-4 py-10">
      <SurfaceCard className="w-full space-y-5" variant="soft">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Mis Finanzas</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Crear cuenta</h1>
          <p className="text-sm text-neutral-600">Tus datos quedan privados por usuario.</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: name.trim() || undefined,
                  email,
                  password
                })
              });
              const payload = (await res.json().catch(() => null)) as { message?: string } | null;
              if (!res.ok) {
                setError(payload?.message ?? "No se pudo crear la cuenta.");
                return;
              }

              const result = await signIn("credentials", {
                email,
                password,
                callbackUrl: "/inicio",
                redirect: false
              });
              if (!result || result.error) {
                setError("Cuenta creada, pero no pudimos iniciar sesión automáticamente.");
                return;
              }

              window.location.href = result.url ?? "/inicio";
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Nombre (opcional)
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </div>
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
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Contraseña
            </label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
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
            {loading ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>

        <p className="text-sm text-neutral-600">
          ¿Ya tienes cuenta?{" "}
          <a href="/login" className="font-semibold text-slate-900 underline underline-offset-4">
            Iniciar sesión
          </a>
        </p>
      </SurfaceCard>
    </div>
  );
}

