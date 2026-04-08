"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

function mapAuthError(code: string) {
  switch (code) {
    case "OAuthAccountNotLinked":
      return "Este email ya existe con otro método. Entra con tu contraseña o usa recuperación de contraseña.";
    case "OAuthSignin":
    case "OAuthCallback":
      return "No pudimos completar el login con Google. Reintenta en unos segundos.";
    case "Configuration":
      return "Login no configurado correctamente. Intenta más tarde.";
    case "AccessDenied":
      return "Acceso denegado.";
    default:
      return "No pudimos iniciar sesión. Reintenta.";
  }
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg items-center px-4 py-10">
          <SurfaceCard className="w-full space-y-5" variant="soft">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Mis Finanzas</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
              <p className="text-sm text-neutral-600">Cargando...</p>
            </div>
          </SurfaceCard>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [googleEnabled, setGoogleEnabled] = useState<boolean>(true);

  const authErrorMessage = useMemo(() => {
    const code = searchParams.get("error");
    if (!code) return null;
    return mapAuthError(code);
  }, [searchParams]);

  useEffect(() => {
    if (authErrorMessage) setError(authErrorMessage);
  }, [authErrorMessage]);

  useEffect(() => {
    let alive = true;
    async function loadProviders() {
      try {
        const res = await fetch("/api/auth/providers", { cache: "no-store" });
        const providers = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!alive) return;
        setGoogleEnabled(Boolean(providers && typeof providers === "object" && "google" in providers));
      } catch {
        if (!alive) return;
        // Keep enabled on network errors; clicking will still show a clear error if it fails.
        setGoogleEnabled(true);
      }
    }
    void loadProviders();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg items-center px-4 py-10">
      <SurfaceCard className="w-full space-y-5" variant="soft">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Mis Finanzas</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="text-sm text-neutral-600">Entra para ver tus finanzas privadas.</p>
        </div>

        {googleEnabled ? (
          <Button
            className="w-full rounded-full"
            variant="secondary"
            onClick={async () => {
              setError(null);
              const result = await signIn("google", { callbackUrl: "/inicio", redirect: true });
              if (result && "error" in result && result.error) {
                setError("No pudimos iniciar sesión con Google.");
              }
            }}
          >
            Continuar con Google
          </Button>
        ) : (
          <SurfaceCard variant="soft" padding="sm" className="border-slate-200/80 bg-white/70 text-slate-700">
            <p className="text-sm font-medium">Google no está disponible en este entorno.</p>
            <p className="mt-1 text-xs text-slate-500">Ingresa con email y contraseña.</p>
          </SurfaceCard>
        )}

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
