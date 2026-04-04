"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg items-center px-4 py-10">
      <SurfaceCard className="w-full space-y-5" variant="soft">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Mis Finanzas</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="text-sm text-neutral-600">Entra para ver tus finanzas privadas.</p>
        </div>

        <Button
          className="w-full rounded-full"
          variant="secondary"
          onClick={() => signIn("google", { callbackUrl: "/inicio" })}
        >
          Continuar con Google
        </Button>

        <div className="h-px w-full bg-white/70" />

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const result = await signIn("credentials", {
                email,
                password,
                callbackUrl: "/inicio",
                redirect: false
              });
              if (!result || result.error) {
                setError("Email o contraseña inválidos.");
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
              autoComplete="current-password"
              placeholder="********"
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
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-sm text-neutral-600">
          <a
            href="/forgot-password"
            className="font-semibold text-slate-900 underline underline-offset-4"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </p>

        <p className="text-sm text-neutral-600">
          ¿No tienes cuenta?{" "}
          <a href="/register" className="font-semibold text-slate-900 underline underline-offset-4">
            Crear cuenta
          </a>
        </p>
      </SurfaceCard>
    </div>
  );
}
